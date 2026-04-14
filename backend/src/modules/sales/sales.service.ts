import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { RedisService }    from '../../redis/redis.service';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import PDFDocument = require('pdfkit');

/** Must match sales_orders_status_check in DB (001_initial_schema.sql). */
const SALES_ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const;

function singleLineFooterText(text: string): string {
  return String(text || '')
    .replace(/\r?\n/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/,\s*,/g, ', ')
    .trim();
}

function topAddressTwoLines(address: string): string[] {
  const raw = String(address || '').trim();
  if (!raw) return [''];
  const parts = raw.split(/\r?\n|,/).map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return [''];
  if (parts.length === 1) return [parts[0]];
  const mid = Math.ceil(parts.length / 2);
  return [parts.slice(0, mid).join(', '), parts.slice(mid).join(', ')].filter(Boolean);
}

function fmtInvoiceDate(dt: unknown): string {
  if (!dt) return '—';
  const d = new Date(String(dt));
  if (Number.isNaN(d.getTime())) return String(dt).slice(0, 10);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function stripBankDetailsFromTerms(text: string): string {
  const src = String(text || '');
  if (!src.trim()) return '';
  const lines = src.split(/\r?\n/);
  const keep = lines.filter((line) => {
    const t = line.trim();
    if (!t) return true;
    return !/^(bank\s*name|bank|branch|a\/?c(\s*no)?|account(\s*number)?|ifsc(\s*code)?)[\s.:_-]/i.test(t);
  });
  return keep.join('\n').trim();
}

function formatBankDetailsBlock(company: Record<string, unknown>): string {
  const accountName = String(company.company_name || '').trim();
  const lines: string[] = [];
  if (accountName) lines.push(`Account Name: ${accountName}`);
  if (String(company.bank_name || '').trim()) lines.push(`Bank Name: ${String(company.bank_name).trim()}`);
  if (String(company.bank_account_number || '').trim()) lines.push(`A/C No: ${String(company.bank_account_number).trim()}`);
  if (String(company.bank_ifsc || '').trim()) lines.push(`IFSC Code: ${String(company.bank_ifsc).trim()}`);
  if (String(company.bank_branch || '').trim()) lines.push(`Branch: ${String(company.bank_branch).trim()}`);
  const extra = String(company.invoice_bank_details || '').trim();
  if (extra) lines.push(extra);
  const t = lines.join('\n').trim();
  return t || 'Configure bank details in Settings -> Company';
}

function resolveUploadsFilePath(urlOrPath: string, uploadsRoot: string): string | null {
  const s = String(urlOrPath || '').trim();
  if (!s || /^javascript:/i.test(s)) return null;
  let pathname = s;
  if (/^https?:\/\//i.test(s)) {
    try {
      pathname = new URL(s).pathname;
    } catch {
      return null;
    }
  }
  const p = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (!p.startsWith('/uploads/')) return null;
  const rel = p.slice('/uploads/'.length);
  const local = join(uploadsRoot, rel);
  return existsSync(local) ? local : null;
}

const MAX_REMOTE_LOGO_BYTES = 3 * 1024 * 1024;
const REMOTE_LOGO_FETCH_MS = 12_000;

function isBlockedLogoFetchHostname(hostname: string): boolean {
  const h = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === 'metadata.google.internal') return true;
  if (h === '::1' || h === '::ffff:127.0.0.1') return true;
  if (h.toLowerCase().startsWith('fe80:')) return true;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  return false;
}

function isPdfKitBufferImage(buf: Buffer): boolean {
  if (!buf || buf.length < 4) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8) return true;
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return true;
  return false;
}

/** Load logo bytes for PDFKit (PNG/JPEG buffers only). Skips SVG and unknown formats. */
async function fetchRemoteLogoBuffer(urlStr: string): Promise<Buffer | null> {
  let u: URL;
  try {
    u = new URL(String(urlStr).trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (isBlockedLogoFetchHostname(u.hostname)) return null;
  const pathPart = `${u.pathname}${u.search || ''}`;
  if (/\.svg(\?|$)/i.test(pathPart)) return null;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), REMOTE_LOGO_FETCH_MS);
  try {
    const r = await fetch(u.toString(), {
      signal: ac.signal,
      redirect: 'follow',
      headers: { Accept: 'image/png,image/jpeg;q=0.9,*/*;q=0.1' },
    });
    if (!r.ok || !r.body) return null;
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('svg')) return null;
    const cl = Number(r.headers.get('content-length') || 0);
    if (cl > MAX_REMOTE_LOGO_BYTES) return null;

    const reader = r.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.length) continue;
      total += value.length;
      if (total > MAX_REMOTE_LOGO_BYTES) return null;
      chunks.push(value);
    }
    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)), total);
    if (!isPdfKitBufferImage(buf)) return null;
    return buf;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function lineGstAmountForPdf(it: any): number {
  const base = Number(it.quantity ?? 0) * Number(it.unit_price ?? 0);
  return Math.max(0, Number(it.total ?? 0) - base);
}

function isInterstateForPdf(docData: any, kind: 'quotation' | 'order' | 'invoice'): boolean {
  if (kind !== 'invoice') return false;
  return Number(docData.igst || 0) > 0;
}

type HsnTaxRowPdf = { hsn: string; taxable: number; cgst: number; sgst: number; igst: number; rate: number };

function hsnSummaryRowsForPdf(docData: any, kind: 'quotation' | 'order' | 'invoice'): HsnTaxRowPdf[] {
  const interstate = isInterstateForPdf(docData, kind);
  const byHsn = new Map<string, HsnTaxRowPdf>();
  for (const it of docData.items || []) {
    const hsn = String(it.product_hsn_code || it.hsn_code || '—');
    const taxable = Number(it.quantity || 0) * Number(it.unit_price || 0);
    const gstAmt = lineGstAmountForPdf(it);
    const row = byHsn.get(hsn) || { hsn, taxable: 0, cgst: 0, sgst: 0, igst: 0, rate: Number(it.gst_rate || 0) };
    row.taxable += taxable;
    if (interstate) row.igst += gstAmt;
    else {
      row.cgst += gstAmt / 2;
      row.sgst += gstAmt / 2;
    }
    byHsn.set(hsn, row);
  }
  return [...byHsn.values()];
}

function invoiceBalanceDueForPdf(doc: any): number {
  const paid = (doc.payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
  return Math.max(0, Number(doc.total_amount || 0) - paid);
}

function totalsForSalesPdf(docData: any, kind: 'quotation' | 'order' | 'invoice') {
  if (kind === 'invoice') {
    return {
      subtotal: docData.subtotal != null ? Number(docData.subtotal) : null,
      cgst: Number(docData.cgst || 0),
      sgst: Number(docData.sgst || 0),
      igst: Number(docData.igst || 0),
      total: Number(docData.total_amount || 0),
      balance: invoiceBalanceDueForPdf(docData),
    };
  }
  let subtotal = 0;
  let gst = 0;
  for (const it of docData.items || []) {
    subtotal += Number(it.quantity ?? 0) * Number(it.unit_price ?? 0);
    gst += lineGstAmountForPdf(it);
  }
  return {
    subtotal,
    cgst: gst / 2,
    sgst: gst / 2,
    igst: 0,
    total: Number(docData.total_amount || 0),
    balance: null as number | null,
  };
}

function amountInWordsInr(n: number): string {
  const num = Math.round(Number(n || 0));
  if (num === 0) return 'INR Zero only.';
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const chunk = (x: number): string => {
    let out = '';
    let v = x;
    if (v >= 100) {
      out += `${ones[Math.floor(v / 100)]} Hundred `;
      v %= 100;
    }
    if (v >= 20) {
      out += `${tens[Math.floor(v / 10)]} `;
      v %= 10;
    }
    if (v > 0) out += `${ones[v]} `;
    return out.trim();
  };
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const hundred = num % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${chunk(crore)} Crore`);
  if (lakh) parts.push(`${chunk(lakh)} Lakh`);
  if (thousand) parts.push(`${chunk(thousand)} Thousand`);
  if (hundred) parts.push(chunk(hundred));
  return `INR ${parts.join(' ').replace(/\s+/g, ' ').trim()} only.`;
}

function layoutColsToPageWidth(pageWidth: number, weights: number[]): number[] {
  const wSum = weights.reduce((a, b) => a + b, 0);
  const cols: number[] = [];
  let rem = pageWidth;
  for (let ci = 0; ci < weights.length; ci++) {
    const isLast = ci === weights.length - 1;
    const w = isLast ? rem : Math.floor((weights[ci] / wSum) * pageWidth);
    cols.push(w);
    rem -= w;
  }
  return cols;
}

function normalizeOrderStatus(status: unknown): string {
  const s = String(status ?? 'pending')
    .trim()
    .toLowerCase();
  return (SALES_ORDER_STATUSES as readonly string[]).includes(s) ? s : 'pending';
}

@Injectable()
export class SalesService {
  constructor(private readonly db: DatabaseService, private readonly cache: RedisService) {}

  // ─── Customers ────────────────────────────────────────────
  async listCustomers(search?: string) {
    const cached = await this.cache.get<any[]>(`customers:${search||''}`);
    if (cached) return cached;
    const vals = search ? [`%${search}%`] : [];
    const where = search ? 'WHERE c.name ILIKE $1 OR c.email ILIKE $1 OR c.phone ILIKE $1' : '';
    const res = await this.db.query(
      `SELECT c.*, u.name AS created_by_name
       FROM customers c
       LEFT JOIN users u ON u.id = c.created_by
       ${where}
       ORDER BY c.name`,
      vals,
    );
    await this.cache.set(`customers:${search||''}`, res.rows, 120);
    return res.rows;
  }

  async getCustomer(id: number) {
    return (
      await this.db.query(
        `SELECT c.*, u.name AS created_by_name
         FROM customers c
         LEFT JOIN users u ON u.id = c.created_by
         WHERE c.id=$1`,
        [id],
      )
    ).rows[0];
  }
  async createCustomer(d: any) {
    const res = await this.db.query(
      'INSERT INTO customers (name,email,phone,gstin,address,lead_id,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [d.name, d.email, d.phone, d.gstin, d.address, d.lead_id, d.created_by ?? null],
    );
    await this.cache.delPattern('customers:*');
    return res.rows[0];
  }
  async updateCustomer(id: number, d: any) {
    const fields = ['name','email','phone','gstin','address','is_active'];
    const sets: string[] = []; const vals: any[] = []; let i = 1;
    for (const f of fields) { if(d[f]!==undefined){ sets.push(`${f}=$${i++}`); vals.push(d[f]); } }
    if(!sets.length) return null;
    vals.push(id);
    const res = await this.db.query(`UPDATE customers SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals);
    await this.cache.delPattern('customers:*');
    return res.rows[0];
  }

  /** Active users who can own quotes/orders/invoices (sales module filters). */
  async listSalesExecutives() {
    return (
      await this.db.query(
        `SELECT DISTINCT u.id, u.name
         FROM users u
         INNER JOIN roles r ON r.id = u.role_id
         WHERE u.is_active = TRUE
           AND r.name IN ('Sales Executive', 'Sales Manager', 'Admin', 'Super Admin')
         ORDER BY u.name`,
      )
    ).rows;
  }

  /** Whether this user may be stored as document owner (created_by). */
  private async isAssignableSalesUser(userId: number): Promise<boolean> {
    const r = await this.db.query(
      `SELECT 1 FROM users u
       INNER JOIN roles ro ON ro.id = u.role_id
       WHERE u.id = $1 AND u.is_active = TRUE
         AND ro.name IN ('Sales Executive', 'Sales Manager', 'Admin', 'Super Admin')
       LIMIT 1`,
      [userId],
    );
    return r.rows.length > 0;
  }

  /**
   * Pick `created_by` for a new/patched sales document.
   * Admins / Super Admins / Sales Managers may assign another sales user; others always self.
   */
  async resolveDocumentCreatedBy(actor: { id: number; role?: string }, requested: unknown): Promise<number> {
    const self = Number(actor.id);
    if (requested === undefined || requested === null || requested === '') return self;
    const rid = Number(requested);
    if (!Number.isFinite(rid) || rid <= 0) return self;
    if (rid === self) return self;
    const assignerRoles = new Set(['Admin', 'Super Admin', 'Sales Manager']);
    if (!assignerRoles.has(String(actor.role || ''))) return self;
    const ok = await this.isAssignableSalesUser(rid);
    return ok ? rid : self;
  }

  private money(v: unknown): string {
    return Number(v ?? 0).toFixed(2);
  }

  private writePdfToFile(doc: any, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const stream = doc.pipe(createWriteStream(filePath));
      stream.on('finish', () => resolve());
      stream.on('error', (err: unknown) => reject(err));
      doc.end();
    });
  }

  async generateSalesPdfFile(kind: 'quotation' | 'order' | 'invoice', id: number) {
    const company = (await this.db.query('SELECT * FROM company_settings LIMIT 1')).rows[0] || {};
    const docData =
      kind === 'quotation'
        ? await this.getQuotation(id)
        : kind === 'order'
          ? await this.getOrder(id)
          : await this.getInvoice(id);
    if (!docData) return null;

    const uploadsRoot = join(process.cwd(), 'uploads');
    const pdfDir = join(uploadsRoot, 'pdfs');
    if (!existsSync(pdfDir)) mkdirSync(pdfDir, { recursive: true });

    const safeKind = kind;
    const fileName = `${safeKind}-${id}-${Date.now()}.pdf`;
    const filePath = join(pdfDir, fileName);

    const pdf = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    const totalTaxDoc =
      kind === 'invoice'
        ? Number(docData.cgst || 0) + Number(docData.sgst || 0) + Number(docData.igst || 0)
        : 0;
    const title =
      kind === 'quotation'
        ? 'QUOTATION'
        : kind === 'order'
          ? 'SALES ORDER'
          : totalTaxDoc > 0
            ? 'TAX INVOICE'
            : 'INVOICE';
    const docNo =
      kind === 'quotation'
        ? String(docData.quotation_number || `QUOT-${id}`)
        : kind === 'order'
          ? String(docData.order_number || `SO-${id}`)
          : String(docData.invoice_number || `INV-${id}`);

    if (kind === 'quotation' || kind === 'order' || kind === 'invoice') {
      const m = pdf.page.margins;
      const pageLeft = m.left;
      const pageRight = pdf.page.width - m.right;
      const pageWidth = pageRight - pageLeft;
      const footerBand = 42;
      let y = m.top;

      const bumpPage = (need: number) => {
        while (y + need > pdf.page.maxY() - footerBand) {
          pdf.addPage();
          y = pdf.page.margins.top;
        }
      };

      const customerAddress = String(docData.customer_address || '');
      const customerGstin = String(docData.customer_gstin || '');
      const rawTerms = String([docData.notes || '', company.payment_terms || ''].filter(Boolean).join('\n'));
      const terms = stripBankDetailsFromTerms(rawTerms);
      const bankBlock = formatBankDetailsBlock(company as Record<string, unknown>);
      const dd = docData as Record<string, unknown>;
      const execName = String(
        dd.sales_executive_name || dd.sales_executive || dd.sales_person_name || dd.created_by_name || '—',
      );
      const metaNoLabel = kind === 'quotation' ? 'Quotation No' : kind === 'order' ? 'Order No' : 'Invoice No';
      const metaDateLabel =
        kind === 'quotation' ? 'Quotation Date' : kind === 'order' ? 'Order Date' : 'Invoice Date';
      const metaDateRaw =
        (kind === 'order' ? docData.order_date : kind === 'invoice' ? docData.invoice_date : docData.created_at) ||
        docData.created_at ||
        '';
      const metaDateValue = fmtInvoiceDate(metaDateRaw);
      const secondaryLabel = kind === 'quotation' ? 'Valid Until' : kind === 'invoice' ? 'Due Date' : '';
      const secondaryValue =
        kind === 'quotation'
          ? fmtInvoiceDate(docData.valid_until)
          : kind === 'invoice'
            ? fmtInvoiceDate(docData.due_date)
            : '';

      const logoUrl = String((company as { invoice_logo_url?: string }).invoice_logo_url || company.logo_url || '').trim();
      const logoPath = resolveUploadsFilePath(logoUrl, uploadsRoot);
      let logoBuffer: Buffer | null = null;
      if (!logoPath && /^https?:\/\//i.test(logoUrl)) {
        logoBuffer = await fetchRemoteLogoBuffer(logoUrl);
      }
      const hasLogo = Boolean(logoPath || logoBuffer);
      const logoColW = 110;
      const addrLinesComp = topAddressTwoLines(String(company.address || ''));
      let headerH = 22 + addrLinesComp.length * 11 + (company.gstin ? 12 : 0) + 8;
      if (hasLogo) headerH = Math.max(headerH, 80);
      bumpPage(headerH + 36);
      const headerTop = y;
      pdf.save().lineWidth(1).strokeColor('#333333');
      pdf.moveTo(pageLeft, headerTop).lineTo(pageRight, headerTop).stroke();
      pdf.moveTo(pageLeft, headerTop).lineTo(pageLeft, headerTop + headerH).stroke();
      pdf.moveTo(pageRight, headerTop).lineTo(pageRight, headerTop + headerH).stroke();
      pdf.restore();
      if (logoPath) {
        try {
          pdf.image(logoPath, pageLeft + 5, headerTop + 6, { fit: [100, 72] });
        } catch {
          /* optional logo */
        }
      } else if (logoBuffer) {
        try {
          pdf.image(logoBuffer, pageLeft + 5, headerTop + 6, { fit: [100, 72] });
        } catch {
          /* optional logo */
        }
      }
      pdf
        .moveTo(pageLeft + logoColW, headerTop)
        .lineTo(pageLeft + logoColW, headerTop + headerH)
        .stroke('#333333');
      let hy = headerTop + 6;
      const rightBlkW = pageWidth - logoColW - 12;
      const rightX = pageLeft + logoColW + 6;
      pdf
        .fontSize(15)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text(String(company.company_name || 'Company'), rightX, hy, { width: rightBlkW, align: 'right' });
      hy += 18;
      pdf.fontSize(9).font('Helvetica');
      for (const ln of addrLinesComp) {
        pdf.text(ln, rightX, hy, { width: rightBlkW, align: 'right' });
        hy += 11;
      }
      if (company.gstin) {
        pdf.text(`GSTIN: ${String(company.gstin)}`, rightX, hy, { width: rightBlkW, align: 'right' });
        hy += 12;
      }
      y = headerTop + headerH;

      bumpPage(36);
      pdf.rect(pageLeft, y, pageWidth, 24).stroke('#333333');
      pdf.fontSize(12).font('Helvetica-Bold').text(title, pageLeft, y + 7, { width: pageWidth, align: 'center' });
      y += 32;

      const leftW = pageWidth / 2;
      const metaH = 56;
      bumpPage(metaH + 8);
      pdf.rect(pageLeft, y, pageWidth, metaH).stroke('#333333');
      pdf.moveTo(pageLeft + leftW, y).lineTo(pageLeft + leftW, y + metaH).stroke('#333333');
      pdf.fontSize(9).font('Helvetica-Bold').text(metaNoLabel, pageLeft + 8, y + 8);
      pdf.font('Helvetica').text(`: ${docNo}`, pageLeft + 95, y + 8);
      pdf.font('Helvetica-Bold').text(metaDateLabel, pageLeft + 8, y + 22);
      pdf.font('Helvetica').text(`: ${metaDateValue}`, pageLeft + 95, y + 22);
      if (secondaryLabel) {
        pdf.font('Helvetica-Bold').text(secondaryLabel, pageLeft + 8, y + 36);
        pdf.font('Helvetica').text(`: ${secondaryValue}`, pageLeft + 95, y + 36);
      }

      pdf.font('Helvetica-Bold').text('Sales Executive', pageLeft + leftW + 8, y + 8);
      pdf.font('Helvetica').text(`: ${execName}`, pageLeft + leftW + 92, y + 8);
      pdf.font('Helvetica-Bold').text('Created By', pageLeft + leftW + 8, y + 22);
      pdf.font('Helvetica').text(`: ${docData.created_by_name || '—'}`, pageLeft + leftW + 92, y + 22);
      y += metaH + 8;

      const boxH = 76;
      bumpPage(boxH + 8);
      pdf.rect(pageLeft, y, leftW, boxH).stroke('#333333');
      pdf.rect(pageLeft + leftW, y, leftW, boxH).stroke('#333333');
      pdf.rect(pageLeft, y, leftW, 16).fillAndStroke('#eaeaea', '#999999');
      pdf.rect(pageLeft + leftW, y, leftW, 16).fillAndStroke('#eaeaea', '#999999');
      pdf.fillColor('#000000').font('Helvetica-Bold').fontSize(9).text('Billing Address', pageLeft + 6, y + 4);
      pdf.text('Delivery Address', pageLeft + leftW + 6, y + 4);
      pdf.font('Helvetica').fontSize(8.5);
      pdf.text(String(docData.customer_name || '—'), pageLeft + 6, y + 22, { width: leftW - 12 });
      pdf.text(customerAddress, pageLeft + 6, y + 34, { width: leftW - 12, height: 26 });
      if (customerGstin) pdf.text(`GSTIN : ${customerGstin}`, pageLeft + 6, y + 62, { width: leftW - 12 });
      pdf.text(String(docData.customer_name || '—'), pageLeft + leftW + 6, y + 22, { width: leftW - 12 });
      pdf.text(customerAddress, pageLeft + leftW + 6, y + 34, { width: leftW - 12, height: 26 });
      if (customerGstin) pdf.text(`GSTIN : ${customerGstin}`, pageLeft + leftW + 6, y + 62, { width: leftW - 12 });
      y += boxH + 8;

      const colWeights = [28, 230, 66, 45, 82, 104];
      const wSum = colWeights.reduce((a, b) => a + b, 0);
      const cols: number[] = [];
      let rem = pageWidth;
      for (let ci = 0; ci < colWeights.length; ci++) {
        const isLast = ci === colWeights.length - 1;
        const w = isLast ? rem : Math.floor((colWeights[ci] / wSum) * pageWidth);
        cols.push(w);
        rem -= w;
      }
      const headers = ['#', 'Item & Description', 'HSN', 'Qty', 'Rate', 'Amount'];
      bumpPage(18);
      let x = pageLeft;
      pdf.rect(pageLeft, y, pageWidth, 18).fillAndStroke('#eaeaea', '#333333');
      headers.forEach((h, i) => {
        pdf
          .fillColor('#000000')
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .text(h, x + 4, y + 5, { width: cols[i] - 8, align: i >= 4 ? 'right' : i === 0 || i === 2 || i === 3 ? 'center' : 'left' });
        x += cols[i];
      });
      y += 18;
      const items = Array.isArray(docData.items) ? docData.items : [];
      if (!items.length) {
        bumpPage(16);
        pdf.rect(pageLeft, y, pageWidth, 16).stroke('#333333');
        pdf.font('Helvetica').fontSize(8.5).text('No line items', pageLeft, y + 4, { width: pageWidth, align: 'center' });
        y += 16;
      } else {
        items.forEach((it: any, idx: number) => {
          const rowH = 16;
          bumpPage(rowH);
          pdf.rect(pageLeft, y, pageWidth, rowH).stroke('#333333');
          let cx = pageLeft;
          const vals = [
            String(idx + 1),
            String(it.description || it.product_name || '—'),
            String(it.product_hsn_code || it.hsn_code || '—'),
            `${Number(it.quantity || 0)}`,
            this.money(it.unit_price),
            this.money(it.total),
          ];
          vals.forEach((v, i) => {
            pdf
              .font('Helvetica')
              .fontSize(8.2)
              .text(v, cx + 4, y + 4, { width: cols[i] - 8, align: i >= 4 ? 'right' : i === 0 || i === 2 || i === 3 ? 'center' : 'left' });
            cx += cols[i];
          });
          y += rowH;
        });
      }

      y += 8;

      const interstate = kind === 'invoice' && Number(docData.igst || 0) > 0;
      const taxRows = hsnSummaryRowsForPdf(docData, kind);
      const displayTaxRows: HsnTaxRowPdf[] = taxRows.length
        ? taxRows
        : [{ hsn: '—', taxable: 0, cgst: 0, sgst: 0, igst: 0, rate: 0 }];
      const taxWeights = interstate ? [90, 230, 195] : [88, 178, 124, 125];
      const taxCols = layoutColsToPageWidth(pageWidth, taxWeights);
      const taxHdrH = 18;
      const taxRowH = 16;
      const taxTableH = taxHdrH + displayTaxRows.length * taxRowH;
      bumpPage(taxTableH + 4);
      pdf.rect(pageLeft, y, pageWidth, taxHdrH).fillAndStroke('#eaeaea', '#333333');
      let taxX = pageLeft;
      const taxHdrs = interstate
        ? ['HSN/SAC', 'Taxable Amount', 'IGST']
        : ['HSN/SAC', 'Taxable Amount', 'CGST', 'SGST'];
      taxHdrs.forEach((h, i) => {
        pdf
          .fillColor('#000000')
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .text(h, taxX + 4, y + 5, { width: taxCols[i] - 8, align: i === 0 ? 'left' : 'right' });
        taxX += taxCols[i];
      });
      y += taxHdrH;
      for (const tr of displayTaxRows) {
        bumpPage(taxRowH);
        pdf.rect(pageLeft, y, pageWidth, taxRowH).stroke('#333333');
        taxX = pageLeft;
        if (interstate) {
          const vals = [tr.hsn, this.money(tr.taxable), `(${tr.rate}%) ${this.money(tr.igst)}`];
          vals.forEach((v, i) => {
            pdf
              .font('Helvetica')
              .fontSize(8.2)
              .text(v, taxX + 4, y + 4, { width: taxCols[i] - 8, align: i === 0 ? 'left' : 'right' });
            taxX += taxCols[i];
          });
        } else {
          const vals = [
            tr.hsn,
            this.money(tr.taxable),
            `(${tr.rate / 2}%) ${this.money(tr.cgst)}`,
            `(${tr.rate / 2}%) ${this.money(tr.sgst)}`,
          ];
          vals.forEach((v, i) => {
            pdf
              .font('Helvetica')
              .fontSize(8.2)
              .text(v, taxX + 4, y + 4, { width: taxCols[i] - 8, align: i === 0 ? 'left' : 'right' });
            taxX += taxCols[i];
          });
        }
        y += taxRowH;
      }

      y += 4;
      const t = totalsForSalesPdf(docData, kind);
      const totalTax = t.cgst + t.sgst + t.igst;
      const subTotal = t.subtotal != null ? t.subtotal : t.total - totalTax;
      const wordsStr = amountInWordsInr(t.total);
      const amtColW = Math.min(230, Math.floor(pageWidth * 0.45));
      const wordsColW = pageWidth - amtColW;
      const boxPad = 8;
      pdf.font('Helvetica').fontSize(11);
      const leftTextH = pdf.heightOfString(wordsStr, { width: wordsColW - boxPad * 2 });
      let rightLineCount = 1;
      if (t.cgst > 0) rightLineCount += 1;
      if (t.sgst > 0) rightLineCount += 1;
      if (t.igst > 0) rightLineCount += 1;
      if (totalTax > 0) rightLineCount += 1;
      rightLineCount += 1;
      if (kind === 'invoice' && t.balance != null) rightLineCount += 1;
      const rightBlockH = boxPad * 2 + rightLineCount * 13 + 6;
      const leftBlockH = boxPad * 2 + 14 + leftTextH;
      const totalsBoxH = Math.max(leftBlockH, rightBlockH, 52);
      bumpPage(totalsBoxH + 8);
      pdf.rect(pageLeft, y, pageWidth, totalsBoxH).stroke('#333333');
      pdf.moveTo(pageLeft + wordsColW, y).lineTo(pageLeft + wordsColW, y + totalsBoxH).stroke('#333333');
      pdf.fillColor('#000000').font('Helvetica-Bold').fontSize(11).text('Total in Words', pageLeft + boxPad, y + boxPad);
      pdf.font('Helvetica').fontSize(11).text(wordsStr, pageLeft + boxPad, y + boxPad + 14, { width: wordsColW - boxPad * 2 });
      const ax = pageLeft + wordsColW + boxPad;
      const aw = amtColW - boxPad * 2;
      let ry = y + boxPad;
      const totalLine = (label: string, val: string, bold = false, red = false) => {
        if (red) pdf.fillColor('#cc0000');
        else pdf.fillColor('#000000');
        pdf.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(11);
        pdf.text(label, ax, ry, { width: aw - 80, align: 'left' });
        pdf.text(`INR ${val}`, ax, ry, { width: aw, align: 'right' });
        ry += 13;
      };
      totalLine('Sub Total', this.money(subTotal));
      if (t.cgst > 0) totalLine('CGST', this.money(t.cgst));
      if (t.sgst > 0) totalLine('SGST', this.money(t.sgst));
      if (t.igst > 0) totalLine('IGST', this.money(t.igst));
      if (totalTax > 0) totalLine('Total Tax Charges', this.money(totalTax));
      totalLine('Total', this.money(t.total), true);
      if (kind === 'invoice' && t.balance != null) totalLine('Balance Due', this.money(t.balance), false, true);
      pdf.fillColor('#000000');
      y += totalsBoxH + 8;

      const colW = (pageWidth - 8) / 2;
      const blockH = 92;
      bumpPage(blockH + 48);
      pdf.rect(pageLeft, y, colW, blockH).stroke('#333333');
      pdf.rect(pageLeft + colW + 8, y, colW, blockH).stroke('#333333');
      pdf.font('Helvetica-Bold').fontSize(9).text('Terms And Conditions:', pageLeft + 6, y + 6);
      pdf.font('Helvetica').fontSize(8).text(terms || '—', pageLeft + 6, y + 18, { width: colW - 12, height: blockH - 24 });
      pdf.font('Helvetica-Bold').fontSize(9).text('Bank Details:', pageLeft + colW + 14, y + 6);
      pdf.font('Helvetica').fontSize(8).text(bankBlock, pageLeft + colW + 14, y + 18, { width: colW - 12, height: blockH - 24 });
      y += blockH + 10;

      bumpPage(56);
      pdf.font('Helvetica-Oblique').fontSize(9).text('Thanks for your business', pageLeft, y);
      y += 28;
      pdf.font('Helvetica-Bold').fontSize(10).text(`For ${company.company_name || 'Company'},`, pageLeft, y);
      y += 24;
    } else {
      pdf.fontSize(18).text(String(company.company_name || 'Company'), { align: 'center' });
      if (company.address) pdf.moveDown(0.2).fontSize(10).text(String(company.address), { align: 'center' });
      if (company.gstin) pdf.moveDown(0.1).fontSize(9).text(`GSTIN: ${company.gstin}`, { align: 'center' });
      pdf.moveDown(0.8).fontSize(14).text(title, { align: 'center' });
      pdf.fontSize(10).text(docNo, { align: 'center' });
      pdf.moveDown(1);

      pdf.fontSize(10).text(`Customer: ${docData.customer_name || '—'}`);
      if (docData.customer_address) pdf.text(`Address: ${docData.customer_address}`);
      if (docData.customer_gstin) pdf.text(`GSTIN: ${docData.customer_gstin}`);
      pdf.moveDown(0.4);
      pdf.text(`Sales Executive: ${docData.created_by_name || '—'}`);
      const docDate = docData.invoice_date || docData.order_date || docData.created_at;
      if (docDate) pdf.text(`Date: ${String(docDate).slice(0, 10)}`);
      if (docData.valid_until) pdf.text(`Valid Until: ${String(docData.valid_until).slice(0, 10)}`);
      if (docData.due_date) pdf.text(`Due Date: ${String(docData.due_date).slice(0, 10)}`);
      pdf.moveDown(0.8);

      pdf.fontSize(10).text('Items', { underline: true });
      pdf.moveDown(0.4);
      const items = Array.isArray(docData.items) ? docData.items : [];
      if (!items.length) {
        pdf.fontSize(9).text('No line items');
      } else {
        items.forEach((it: any, idx: number) => {
          const desc = String(it.description || it.product_name || '—');
          const qty = Number(it.quantity || 0);
          const rate = this.money(it.unit_price);
          const total = this.money(it.total);
          pdf.fontSize(9).text(`${idx + 1}. ${desc}`);
          pdf.fontSize(8).fillColor('gray').text(`Qty: ${qty}  Rate: INR ${rate}  Amount: INR ${total}`);
          pdf.fillColor('black').moveDown(0.3);
        });
      }

      const total = this.money(docData.total_amount);
      pdf.moveDown(0.6).fontSize(11).text(`Total: INR ${total}`, { align: 'right' });
      if (docData.notes) {
        pdf.moveDown(0.8).fontSize(9).text('Terms And Conditions:', { underline: true });
        pdf.fontSize(8).text(String(docData.notes));
      }
      pdf.moveDown(1.2).fontSize(9).text('Thanks for your business');
      pdf.moveDown(1.5).fontSize(10).text(`For ${company.company_name || 'Company'},`);
    }

    {
      const m = pdf.page.margins;
      const pl = m.left;
      const pr = pdf.page.width - m.right;
      const pw = pr - pl;
      const footerBody = singleLineFooterText(
        String(company.address || '').trim() || String(company.company_name || '').trim() || '—',
      );
      const footerLine = `Contact: ${footerBody}`;
      const fr = pdf.bufferedPageRange();
      for (let pi = fr.start; pi < fr.start + fr.count; pi++) {
        pdf.switchToPage(pi);
        pdf.font('Helvetica').fontSize(7.5);
        const lh = pdf.currentLineHeight(true) || 11;
        const fy = pdf.page.maxY() - lh - 6;
        pdf.fillColor('#666666').text(footerLine, pl, fy, {
          width: pw,
          align: 'center',
          height: lh + 1,
          ellipsis: true,
        });
        pdf.fillColor('#000000');
      }
    }

    await this.writePdfToFile(pdf, filePath);
    return {
      url: `/sales/generated-pdfs/${fileName}`,
      file_name: fileName,
      kind,
      id,
    };
  }

  // ─── Proposals ────────────────────────────────────────────
  async listProposals() {
    return (await this.db.query(
      `SELECT p.*,c.name AS customer_name FROM proposals p JOIN customers c ON c.id=p.customer_id ORDER BY p.created_at DESC`
    )).rows;
  }
  async getProposal(id: number) {
    const [p, items] = await Promise.all([
      this.db.query(`SELECT p.*,c.name AS customer_name FROM proposals p JOIN customers c ON c.id=p.customer_id WHERE p.id=$1`, [id]),
      this.db.query(`SELECT pi.*,pr.name AS product_name FROM proposal_items pi LEFT JOIN products pr ON pr.id=pi.product_id WHERE pi.proposal_id=$1`, [id]),
    ]);
    return p.rows[0] ? { ...p.rows[0], items: items.rows } : null;
  }
  async createProposal(data: any, items: any[]) {
    return this.db.transaction(async (client) => {
      const total = items.reduce((s, i) => s + Number(i.total), 0);
      const pn = `PROP-${Date.now()}`;
      const pr = await client.query(
        'INSERT INTO proposals (proposal_number,customer_id,lead_id,status,valid_until,notes,total_amount,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [pn, data.customer_id, data.lead_id, data.status||'draft', data.valid_until, data.notes, total, data.created_by],
      );
      for (const it of items)
        await client.query('INSERT INTO proposal_items (proposal_id,product_id,description,quantity,unit_price,gst_rate,total) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [pr.rows[0].id, it.product_id, it.description, it.quantity, it.unit_price, it.gst_rate||0, it.total]);
      return pr.rows[0];
    });
  }
  async patchProposal(id: number, status: string) {
    return (await this.db.query('UPDATE proposals SET status=$1 WHERE id=$2 RETURNING *', [status, id])).rows[0];
  }

  // ─── Quotations ───────────────────────────────────────────
  async listQuotations(filters?: { customer_id?: number; created_by?: number; status?: string; from?: string; to?: string }) {
    const conds: string[] = [];
    const vals: any[] = [];
    let n = 1;
    if (filters?.customer_id) {
      conds.push(`q.customer_id=$${n++}`);
      vals.push(filters.customer_id);
    }
    if (filters?.created_by) {
      conds.push(`q.created_by=$${n++}`);
      vals.push(filters.created_by);
    }
    if (filters?.status) {
      conds.push(`q.status=$${n++}`);
      vals.push(filters.status);
    }
    if (filters?.from) {
      conds.push(`q.created_at>=$${n++}`);
      vals.push(filters.from);
    }
    if (filters?.to) {
      conds.push(`q.created_at<=$${n++}`);
      vals.push(`${filters.to} 23:59:59`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return (
      await this.db.query(
        `SELECT q.*, c.name AS customer_name, u.name AS created_by_name
         FROM quotations q
         JOIN customers c ON c.id=q.customer_id
         LEFT JOIN users u ON u.id=q.created_by
         ${where} ORDER BY q.created_at DESC`,
        vals,
      )
    ).rows;
  }
  async getQuotation(id: number) {
    const [q, items] = await Promise.all([
      this.db.query(
        `SELECT q.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
                c.gstin AS customer_gstin, c.address AS customer_address,
                cu.name AS created_by_name
           FROM quotations q
           JOIN customers c ON c.id=q.customer_id
           LEFT JOIN users cu ON cu.id=q.created_by
           WHERE q.id=$1`,
        [id],
      ),
      this.db.query(
        `SELECT qi.*, pr.name AS product_name, pr.hsn_code AS product_hsn_code
           FROM quotation_items qi LEFT JOIN products pr ON pr.id=qi.product_id WHERE qi.quotation_id=$1`,
        [id],
      ),
    ]);
    return q.rows[0] ? { ...q.rows[0], items: items.rows } : null;
  }
  async createQuotation(data: any, items: any[]) {
    return this.db.transaction(async (client) => {
      const subtotal = items.reduce((s, i) => s + Number(i.total), 0);
      const cgst = items.reduce((s, i) => s + Number(i.cgst || 0), 0);
      const sgst = items.reduce((s, i) => s + Number(i.sgst || 0), 0);
      const igst = items.reduce((s, i) => s + Number(i.igst || 0), 0);
      const total = subtotal + cgst + sgst + igst;
      const qn = `QUOT-${Date.now()}`;
      const qr = await client.query(
        `INSERT INTO quotations
          (quotation_number,customer_id,proposal_id,status,valid_until,notes,
           gst_type,tax_type,is_interstate,subtotal,cgst,sgst,igst,total_amount,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [qn, data.customer_id, data.proposal_id, data.status||'draft', data.valid_until, data.notes,
         data.gst_type||'intra_state', data.tax_type||'exclusive', data.is_interstate||false,
         subtotal, cgst, sgst, igst, total, data.created_by],
      );
      for (const it of items)
        await client.query(
          'INSERT INTO quotation_items (quotation_id,product_id,description,quantity,unit_price,discount,gst_rate,cgst,sgst,igst,total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
          [qr.rows[0].id, it.product_id||null, it.description, it.quantity, it.unit_price, it.discount||0, it.gst_rate||0, it.cgst||0, it.sgst||0, it.igst||0, it.total]);
      return qr.rows[0];
    });
  }

  // ─── Orders ───────────────────────────────────────────────
  async listOrders(filters?: { customer_id?: number; created_by?: number; status?: string; from?: string; to?: string }) {
    const conds: string[] = [];
    const vals: any[] = [];
    let n = 1;
    if (filters?.customer_id) {
      conds.push(`o.customer_id=$${n++}`);
      vals.push(filters.customer_id);
    }
    if (filters?.created_by) {
      conds.push(`o.created_by=$${n++}`);
      vals.push(filters.created_by);
    }
    if (filters?.status) {
      conds.push(`o.status=$${n++}`);
      vals.push(filters.status);
    }
    if (filters?.from) {
      conds.push(`o.order_date>=$${n++}`);
      vals.push(filters.from);
    }
    if (filters?.to) {
      conds.push(`o.order_date<=$${n++}`);
      vals.push(filters.to);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return (
      await this.db.query(
        `SELECT o.*, c.name AS customer_name, u.name AS created_by_name
         FROM sales_orders o
         JOIN customers c ON c.id=o.customer_id
         LEFT JOIN users u ON u.id=o.created_by
         ${where} ORDER BY o.created_at DESC`,
        vals,
      )
    ).rows;
  }
  async getOrder(id: number) {
    const [o, items] = await Promise.all([
      this.db.query(
        `SELECT o.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
                c.gstin AS customer_gstin, c.address AS customer_address,
                cu.name AS created_by_name
           FROM sales_orders o
           JOIN customers c ON c.id=o.customer_id
           LEFT JOIN users cu ON cu.id=o.created_by
           WHERE o.id=$1`,
        [id],
      ),
      this.db.query(
        `SELECT oi.*, pr.name AS product_name, pr.hsn_code AS product_hsn_code
           FROM sales_order_items oi LEFT JOIN products pr ON pr.id=oi.product_id WHERE oi.order_id=$1`,
        [id],
      ),
    ]);
    return o.rows[0] ? { ...o.rows[0], items: items.rows } : null;
  }
  async createOrder(data: any, items: any[]) {
    return this.db.transaction(async (client) => {
      const subtotal = items.reduce((s, i) => s + Number(i.total), 0);
      const cgst = items.reduce((s, i) => s + Number(i.cgst || 0), 0);
      const sgst = items.reduce((s, i) => s + Number(i.sgst || 0), 0);
      const igst = items.reduce((s, i) => s + Number(i.igst || 0), 0);
      const total = subtotal + cgst + sgst + igst;
      const on = `ORD-${Date.now()}`;
      const or = await client.query(
        `INSERT INTO sales_orders
          (order_number,customer_id,quotation_id,status,order_date,due_date,notes,
           gst_type,tax_type,is_interstate,subtotal,cgst,sgst,igst,total_amount,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
        [on, data.customer_id, data.quotation_id||null, normalizeOrderStatus(data.status),
         data.order_date||new Date().toISOString().split('T')[0], data.due_date||null, data.notes,
         data.gst_type||'intra_state', data.tax_type||'exclusive', data.is_interstate||false,
         subtotal, cgst, sgst, igst, total, data.created_by],
      );
      for (const it of items)
        await client.query(
          'INSERT INTO sales_order_items (order_id,product_id,description,quantity,unit_price,discount,gst_rate,cgst,sgst,igst,total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
          [or.rows[0].id, it.product_id||null, it.description, it.quantity, it.unit_price, it.discount||0, it.gst_rate||0, it.cgst||0, it.sgst||0, it.igst||0, it.total]);
      return or.rows[0];
    });
  }
  async patchOrder(id: number, b: any) {
    if (typeof b === 'string') {
      const st = normalizeOrderStatus(b);
      return (await this.db.query('UPDATE sales_orders SET status=$1 WHERE id=$2 RETURNING *', [st, id])).rows[0];
    }
    if (b?.items !== undefined && Array.isArray(b.items)) {
      return this.db.transaction(async (client) => {
        const ex = await client.query('SELECT id FROM sales_orders WHERE id=$1', [id]);
        if (!ex.rows[0]) return null;
        await client.query('DELETE FROM sales_order_items WHERE order_id=$1', [id]);
        let subtotal = 0, cgst = 0, sgst = 0, igst = 0;
        for (const it of b.items) {
          const lineTotal = Number(it.total ?? 0);
          subtotal += lineTotal;
          cgst += Number(it.cgst || 0);
          sgst += Number(it.sgst || 0);
          igst += Number(it.igst || 0);
          await client.query(
            'INSERT INTO sales_order_items (order_id,product_id,description,quantity,unit_price,discount,gst_rate,cgst,sgst,igst,total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
            [id, it.product_id ?? null, String(it.description ?? ''), Number(it.quantity),
             Number(it.unit_price), Number(it.discount || 0), Number(it.gst_rate ?? 0),
             Number(it.cgst || 0), Number(it.sgst || 0), Number(it.igst || 0), lineTotal],
          );
        }
        const total = subtotal + cgst + sgst + igst;
        const sets = ['subtotal=$1','cgst=$2','sgst=$3','igst=$4','total_amount=$5'];
        const vals: any[] = [subtotal, cgst, sgst, igst, total];
        let n = 6;
        if (b.customer_id !== undefined)  { sets.push(`customer_id=$${n++}`);   vals.push(b.customer_id); }
        if (b.order_date !== undefined)   { sets.push(`order_date=$${n++}`);    vals.push(b.order_date); }
        if (b.due_date !== undefined)     { sets.push(`due_date=$${n++}`);      vals.push(b.due_date); }
        if (b.notes !== undefined)        { sets.push(`notes=$${n++}`);         vals.push(b.notes); }
        if (b.status !== undefined)       { sets.push(`status=$${n++}`);        vals.push(normalizeOrderStatus(b.status)); }
        if (b.gst_type !== undefined)     { sets.push(`gst_type=$${n++}`);      vals.push(b.gst_type); }
        if (b.tax_type !== undefined)     { sets.push(`tax_type=$${n++}`);      vals.push(b.tax_type); }
        if (b.is_interstate !== undefined){ sets.push(`is_interstate=$${n++}`); vals.push(b.is_interstate); }
        if (b.created_by !== undefined)   { sets.push(`created_by=$${n++}`);    vals.push(b.created_by); }
        vals.push(id);
        await client.query(`UPDATE sales_orders SET ${sets.join(', ')} WHERE id=$${n}`, vals);
        return this.getOrder(id);
      });
    }
    const sets: string[] = [];
    const vals: any[] = [];
    let n = 1;
    if (b?.status !== undefined) {
      sets.push(`status=$${n++}`);
      vals.push(normalizeOrderStatus(b.status));
    }
    if (b?.notes !== undefined) {
      sets.push(`notes=$${n++}`);
      vals.push(b.notes);
    }
    if (b?.order_date !== undefined) {
      sets.push(`order_date=$${n++}`);
      vals.push(b.order_date);
    }
    if (b?.due_date !== undefined) {
      sets.push(`due_date=$${n++}`);
      vals.push(b.due_date);
    }
    if (b?.customer_id !== undefined) {
      sets.push(`customer_id=$${n++}`);
      vals.push(b.customer_id);
    }
    if (b?.created_by !== undefined) {
      sets.push(`created_by=$${n++}`);
      vals.push(b.created_by);
    }
    if (!sets.length) {
      return (await this.db.query('SELECT * FROM sales_orders WHERE id=$1', [id])).rows[0];
    }
    vals.push(id);
    return (await this.db.query(`UPDATE sales_orders SET ${sets.join(', ')} WHERE id=$${n} RETURNING *`, vals)).rows[0];
  }

  // ─── Invoices ─────────────────────────────────────────────
  async listInvoices(filters?: { customer_id?: number; created_by?: number; status?: string; from?: string; to?: string }) {
    const conds: string[] = [];
    const vals: any[] = [];
    let n = 1;
    if (filters?.customer_id) {
      conds.push(`i.customer_id=$${n++}`);
      vals.push(filters.customer_id);
    }
    if (filters?.created_by) {
      conds.push(`i.created_by=$${n++}`);
      vals.push(filters.created_by);
    }
    if (filters?.status) {
      conds.push(`i.status=$${n++}`);
      vals.push(filters.status);
    }
    if (filters?.from) {
      conds.push(`i.invoice_date>=$${n++}`);
      vals.push(filters.from);
    }
    if (filters?.to) {
      conds.push(`i.invoice_date<=$${n++}`);
      vals.push(filters.to);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return (
      await this.db.query(
        `SELECT i.*, c.name AS customer_name, c.gstin AS customer_gstin,
                u.name AS created_by_name,
                COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id=i.id),0) AS paid_amount,
                i.total_amount - COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id=i.id),0) AS balance
         FROM invoices i
         JOIN customers c ON c.id=i.customer_id
         LEFT JOIN users u ON u.id=i.created_by
         ${where} ORDER BY i.created_at DESC`,
        vals,
      )
    ).rows;
  }
  async getInvoice(id: number) {
    const [inv, items, pays] = await Promise.all([
      this.db.query(
        `SELECT i.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
                c.gstin AS customer_gstin, c.address AS customer_address,
                cu.name AS created_by_name
           FROM invoices i
           JOIN customers c ON c.id=i.customer_id
           LEFT JOIN users cu ON cu.id=i.created_by
           WHERE i.id=$1`,
        [id],
      ),
      this.db.query(
        `SELECT ii.*, pr.name AS product_name, pr.hsn_code AS product_hsn_code
           FROM invoice_items ii LEFT JOIN products pr ON pr.id=ii.product_id WHERE ii.invoice_id=$1`,
        [id],
      ),
      this.db.query(`SELECT * FROM payments WHERE invoice_id=$1 ORDER BY payment_date`, [id]),
    ]);
    return inv.rows[0] ? { ...inv.rows[0], items: items.rows, payments: pays.rows } : null;
  }
  async createInvoice(data: any, items: any[]) {
    const row = await this.db.transaction(async (client) => {
      let subtotal = 0, cgst = 0, sgst = 0, igst = 0;
      for (const it of items) {
        subtotal += Number(it.unit_price) * Number(it.quantity);
        if (data.is_interstate) igst += Number(it.igst||0);
        else { cgst += Number(it.cgst||0); sgst += Number(it.sgst||0); }
      }
      const total = subtotal + cgst + sgst + igst;
      const inv_no = `INV-${Date.now()}`;
      const ir = await client.query(
        'INSERT INTO invoices (invoice_number,customer_id,order_id,invoice_date,due_date,subtotal,cgst,sgst,igst,total_amount,notes,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *',
        [inv_no, data.customer_id, data.order_id, data.invoice_date||new Date().toISOString().split('T')[0], data.due_date, subtotal, cgst, sgst, igst, total, data.notes, data.created_by],
      );
      for (const it of items)
        await client.query('INSERT INTO invoice_items (invoice_id,product_id,description,quantity,unit_price,gst_rate,cgst,sgst,igst,total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
          [ir.rows[0].id, it.product_id, it.description, it.quantity, it.unit_price, it.gst_rate||0, it.cgst||0, it.sgst||0, it.igst||0, it.total]);
      return ir.rows[0];
    });
    await this.cache.del('dashboard:stats');
    return row;
  }
  async stats() {
    const res = await this.db.query(`
      SELECT
        (SELECT COUNT(*)::int        FROM customers  WHERE is_active=TRUE)                                    AS customers,
        (SELECT COUNT(*)::int        FROM sales_orders WHERE status NOT IN ('delivered','cancelled'))          AS open_orders,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status='paid')                              AS revenue,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status IN ('unpaid','partial'))             AS receivable,
        (SELECT COUNT(*)::int        FROM invoices WHERE status IN ('unpaid','partial') AND due_date < NOW()) AS overdue,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices)                                                  AS total_sales,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status='paid')                              AS paid_amount,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status='unpaid')                            AS unpaid_amount,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status='partial')                           AS partial_amount
    `);
    const r = res.rows[0];
    return {
      customers: r.customers,
      open_orders: r.open_orders,
      revenue: Number(r.revenue),
      receivable: Number(r.receivable),
      overdue: r.overdue,
      total_sales: Number(r.total_sales),
      paid_amount: Number(r.paid_amount),
      unpaid_amount: Number(r.unpaid_amount),
      partial_amount: Number(r.partial_amount),
    };
  }

  // ─── Payments (all invoice receipts) ──────────────────────
  async listPayments(filters?: { customer_id?: number; created_by?: number; from?: string; to?: string }) {
    const conds: string[] = [];
    const vals: any[] = [];
    let n = 1;
    if (filters?.customer_id) {
      conds.push(`i.customer_id=$${n++}`);
      vals.push(filters.customer_id);
    }
    if (filters?.created_by) {
      conds.push(`p.created_by=$${n++}`);
      vals.push(filters.created_by);
    }
    if (filters?.from) {
      conds.push(`p.payment_date>=$${n++}`);
      vals.push(filters.from);
    }
    if (filters?.to) {
      conds.push(`p.payment_date<=$${n++}`);
      vals.push(filters.to);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return (
      await this.db.query(
        `SELECT p.*, i.invoice_number, c.name AS customer_name, u.name AS created_by_name
         FROM payments p
         JOIN invoices i ON i.id=p.invoice_id
         JOIN customers c ON c.id=i.customer_id
         LEFT JOIN users u ON u.id=p.created_by
         ${where} ORDER BY p.payment_date DESC, p.created_at DESC`,
        vals,
      )
    ).rows;
  }

  // ─── Sale returns ─────────────────────────────────────────
  async listReturns(filters?: { customer_id?: number; created_by?: number; from?: string; to?: string }) {
    const conds: string[] = [];
    const vals: any[] = [];
    let n = 1;
    if (filters?.customer_id) {
      conds.push(`r.customer_id=$${n++}`);
      vals.push(filters.customer_id);
    }
    if (filters?.created_by) {
      conds.push(`r.created_by=$${n++}`);
      vals.push(filters.created_by);
    }
    if (filters?.from) {
      conds.push(`r.return_date>=$${n++}`);
      vals.push(filters.from);
    }
    if (filters?.to) {
      conds.push(`r.return_date<=$${n++}`);
      vals.push(filters.to);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return (
      await this.db.query(
        `SELECT r.*, c.name AS customer_name, u.name AS created_by_name,
                r.total_amount - r.paid_amount AS balance
         FROM sale_returns r
         JOIN customers c ON c.id=r.customer_id
         LEFT JOIN users u ON u.id=r.created_by
         ${where} ORDER BY r.created_at DESC`,
        vals,
      )
    ).rows;
  }

  async getReturn(id: number) {
    const [r, items, pays] = await Promise.all([
      this.db.query(
        `SELECT r.*, c.name AS customer_name FROM sale_returns r JOIN customers c ON c.id=r.customer_id WHERE r.id=$1`,
        [id],
      ),
      this.db.query(
        `SELECT ri.*, pr.name AS product_name FROM sale_return_items ri LEFT JOIN products pr ON pr.id=ri.product_id WHERE ri.return_id=$1`,
        [id],
      ),
      this.db.query(`SELECT * FROM sale_return_payments WHERE return_id=$1 ORDER BY payment_date`, [id]),
    ]);
    return r.rows[0] ? { ...r.rows[0], items: items.rows, payments: pays.rows } : null;
  }

  async createReturn(data: any, items: any[]) {
    return this.db.transaction(async (client) => {
      let subtotal = 0;
      let cgst = 0;
      let sgst = 0;
      let igst = 0;
      for (const it of items) {
        const lineBase = Number(it.unit_price) * Number(it.quantity) - Number(it.discount || 0);
        subtotal += lineBase;
        cgst += Number(it.cgst || 0);
        sgst += Number(it.sgst || 0);
        igst += Number(it.igst || 0);
      }
      const discount = Number(data.discount_amount || 0);
      const roundOff = Number(data.round_off || 0);
      const total = subtotal + cgst + sgst + igst - discount + roundOff;
      const rn = `RET-${Date.now()}`;
      const rr = await client.query(
        `INSERT INTO sale_returns
          (return_number,customer_id,reference_no,return_date,state_of_supply,
           exchange_rate,notes,subtotal,cgst,sgst,igst,discount_amount,round_off,total_amount,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [
          rn,
          data.customer_id,
          data.reference_no,
          data.return_date || new Date().toISOString().split('T')[0],
          data.state_of_supply,
          data.exchange_rate || 1,
          data.notes,
          subtotal,
          cgst,
          sgst,
          igst,
          discount,
          roundOff,
          total,
          data.created_by,
        ],
      );
      for (const it of items) {
        await client.query(
          'INSERT INTO sale_return_items (return_id,product_id,description,quantity,unit_price,discount,gst_rate,total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [
            rr.rows[0].id,
            it.product_id,
            it.description,
            it.quantity,
            it.unit_price,
            it.discount || 0,
            it.gst_rate || 0,
            it.total,
          ],
        );
      }
      return rr.rows[0];
    });
  }

  async addReturnPayment(returnId: number, data: any) {
    return this.db.transaction(async (client) => {
      const pr = await client.query(
        'INSERT INTO sale_return_payments (return_id,amount,payment_date,method,reference,notes,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
        [
          returnId,
          data.amount,
          data.payment_date || new Date().toISOString().split('T')[0],
          data.method || 'bank_transfer',
          data.reference,
          data.notes,
          data.created_by,
        ],
      );
      const totPaid = await client.query(
        'SELECT COALESCE(SUM(amount),0) AS paid FROM sale_return_payments WHERE return_id=$1',
        [returnId],
      );
      await client.query('UPDATE sale_returns SET paid_amount=$1 WHERE id=$2', [Number(totPaid.rows[0].paid), returnId]);
      return pr.rows[0];
    });
  }

  async deleteReturn(id: number) {
    await this.db.query('DELETE FROM sale_returns WHERE id=$1', [id]);
  }

  async deleteCustomer(id: number)   { await this.db.query('DELETE FROM customers WHERE id=$1', [id]); await this.cache.delPattern('customers:*'); }
  async deleteQuotation(id: number)  { await this.db.query('DELETE FROM quotations WHERE id=$1', [id]); }
  async deleteOrder(id: number)      { await this.db.query('DELETE FROM sales_orders WHERE id=$1', [id]); }
  async deleteInvoice(id: number) {
    await this.db.query('DELETE FROM invoices WHERE id=$1', [id]);
    await this.cache.del('dashboard:stats');
  }

  /**
   * Partial update. If `items` is an array, line items are replaced and `total_amount` recalculated.
   * Optional fields: `status`, `notes`, `valid_until`, `customer_id`.
   */
  async patchQuotation(id: number, b: any) {
    if (b?.items !== undefined && Array.isArray(b.items)) {
      return this.db.transaction(async (client) => {
        const ex = await client.query('SELECT id FROM quotations WHERE id=$1', [id]);
        if (!ex.rows[0]) return null;
        await client.query('DELETE FROM quotation_items WHERE quotation_id=$1', [id]);
        let subtotal = 0, cgst = 0, sgst = 0, igst = 0;
        for (const it of b.items) {
          const lineTotal = Number(it.total ?? 0);
          subtotal += lineTotal;
          cgst += Number(it.cgst || 0);
          sgst += Number(it.sgst || 0);
          igst += Number(it.igst || 0);
          await client.query(
            'INSERT INTO quotation_items (quotation_id,product_id,description,quantity,unit_price,discount,gst_rate,cgst,sgst,igst,total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
            [id, it.product_id ?? null, String(it.description ?? ''), Number(it.quantity),
             Number(it.unit_price), Number(it.discount || 0), Number(it.gst_rate ?? 0),
             Number(it.cgst || 0), Number(it.sgst || 0), Number(it.igst || 0), lineTotal],
          );
        }
        const total = subtotal + cgst + sgst + igst;
        const sets = ['subtotal=$1','cgst=$2','sgst=$3','igst=$4','total_amount=$5'];
        const vals: any[] = [subtotal, cgst, sgst, igst, total];
        let n = 6;
        if (b.customer_id !== undefined) { sets.push(`customer_id=$${n++}`); vals.push(b.customer_id); }
        if (b.valid_until !== undefined)  { sets.push(`valid_until=$${n++}`); vals.push(b.valid_until); }
        if (b.notes !== undefined)        { sets.push(`notes=$${n++}`);       vals.push(b.notes); }
        if (b.status !== undefined)       { sets.push(`status=$${n++}`);      vals.push(b.status); }
        if (b.gst_type !== undefined)     { sets.push(`gst_type=$${n++}`);    vals.push(b.gst_type); }
        if (b.tax_type !== undefined)     { sets.push(`tax_type=$${n++}`);    vals.push(b.tax_type); }
        if (b.is_interstate !== undefined){ sets.push(`is_interstate=$${n++}`); vals.push(b.is_interstate); }
        if (b.created_by !== undefined)   { sets.push(`created_by=$${n++}`);  vals.push(b.created_by); }
        vals.push(id);
        await client.query(`UPDATE quotations SET ${sets.join(', ')} WHERE id=$${n}`, vals);
        return this.getQuotation(id);
      });
    }
    const sets: string[] = [];
    const vals: any[] = [];
    let n = 1;
    if (b?.status !== undefined) {
      sets.push(`status = $${n++}`);
      vals.push(b.status);
    }
    if (b?.notes !== undefined) {
      sets.push(`notes = $${n++}`);
      vals.push(b.notes);
    }
    if (b?.valid_until !== undefined) {
      sets.push(`valid_until = $${n++}`);
      vals.push(b.valid_until);
    }
    if (b?.customer_id !== undefined) {
      sets.push(`customer_id = $${n++}`);
      vals.push(b.customer_id);
    }
    if (b?.created_by !== undefined) {
      sets.push(`created_by = $${n++}`);
      vals.push(b.created_by);
    }
    if (!sets.length) return this.getQuotation(id);
    vals.push(id);
    await this.db.query(`UPDATE quotations SET ${sets.join(', ')} WHERE id = $${n}`, vals);
    return this.getQuotation(id);
  }

  async patchInvoice(id: number, b: any) {
    if (b?.items !== undefined && Array.isArray(b.items)) {
      const row = await this.db.transaction(async (client) => {
        const ex = await client.query('SELECT id FROM invoices WHERE id=$1', [id]);
        if (!ex.rows[0]) return null;

        await client.query('DELETE FROM invoice_items WHERE invoice_id=$1', [id]);

        let subtotal = 0;
        let cgst = 0;
        let sgst = 0;
        let igst = 0;
        for (const it of b.items) {
          const qty = Number(it.quantity ?? 0);
          const unit = Number(it.unit_price ?? 0);
          const rate = Number(it.gst_rate ?? 0);
          const base = qty * unit;
          const gst = base * rate / 100;
          const lineCgst = Number(it.cgst ?? (b.is_interstate ? 0 : gst / 2));
          const lineSgst = Number(it.sgst ?? (b.is_interstate ? 0 : gst / 2));
          const lineIgst = Number(it.igst ?? (b.is_interstate ? gst : 0));
          const lineTotal = Number(it.total ?? (base + lineCgst + lineSgst + lineIgst));

          subtotal += base;
          cgst += lineCgst;
          sgst += lineSgst;
          igst += lineIgst;

          await client.query(
            'INSERT INTO invoice_items (invoice_id,product_id,description,quantity,unit_price,gst_rate,cgst,sgst,igst,total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
            [
              id,
              it.product_id ?? null,
              String(it.description ?? ''),
              qty,
              unit,
              rate,
              lineCgst,
              lineSgst,
              lineIgst,
              lineTotal,
            ],
          );
        }

        const total = subtotal + cgst + sgst + igst;
        const sets = ['subtotal=$1', 'cgst=$2', 'sgst=$3', 'igst=$4', 'total_amount=$5'];
        const vals: any[] = [subtotal, cgst, sgst, igst, total];
        let n = 6;
        if (b.customer_id !== undefined) { sets.push(`customer_id=$${n++}`); vals.push(b.customer_id); }
        if (b.invoice_date !== undefined) { sets.push(`invoice_date=$${n++}`); vals.push(b.invoice_date); }
        if (b.due_date !== undefined) { sets.push(`due_date=$${n++}`); vals.push(b.due_date); }
        if (b.notes !== undefined) { sets.push(`notes=$${n++}`); vals.push(b.notes); }
        if (b.status !== undefined) { sets.push(`status=$${n++}`); vals.push(b.status); }
        if (b.created_by !== undefined) { sets.push(`created_by=$${n++}`); vals.push(b.created_by); }
        vals.push(id);
        await client.query(`UPDATE invoices SET ${sets.join(', ')} WHERE id=$${n}`, vals);
        return this.getInvoice(id);
      });
      await this.cache.del('dashboard:stats');
      return row;
    }

    const sets: string[] = [];
    const vals: any[] = [];
    let n = 1;
    if (b?.status !== undefined) { sets.push(`status=$${n++}`); vals.push(b.status); }
    if (b?.notes !== undefined) { sets.push(`notes=$${n++}`); vals.push(b.notes); }
    if (b?.invoice_date !== undefined) { sets.push(`invoice_date=$${n++}`); vals.push(b.invoice_date); }
    if (b?.due_date !== undefined) { sets.push(`due_date=$${n++}`); vals.push(b.due_date); }
    if (b?.customer_id !== undefined) { sets.push(`customer_id=$${n++}`); vals.push(b.customer_id); }
    if (b?.created_by !== undefined) { sets.push(`created_by=$${n++}`); vals.push(b.created_by); }
    if (!sets.length) return this.getInvoice(id);
    vals.push(id);
    await this.db.query(`UPDATE invoices SET ${sets.join(', ')} WHERE id=$${n}`, vals);
    await this.cache.del('dashboard:stats');
    return this.getInvoice(id);
  }

  async addPayment(invoiceId: number, data: any) {
    const row = await this.db.transaction(async (client) => {
      const pr = await client.query(
        'INSERT INTO payments (invoice_id,amount,payment_date,method,reference,notes,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
        [invoiceId, data.amount, data.payment_date||new Date().toISOString().split('T')[0], data.method||'bank_transfer', data.reference, data.notes, data.created_by],
      );
      const totPaid = await client.query('SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE invoice_id=$1', [invoiceId]);
      const inv = await client.query('SELECT total_amount FROM invoices WHERE id=$1', [invoiceId]);
      const paid = Number(totPaid.rows[0].paid);
      const total = Number(inv.rows[0].total_amount);
      const status = paid >= total ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
      await client.query('UPDATE invoices SET status=$1 WHERE id=$2', [status, invoiceId]);
      return pr.rows[0];
    });
    await this.cache.del('dashboard:stats');
    return row;
  }
}
