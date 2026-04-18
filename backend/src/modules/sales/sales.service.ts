import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { RedisService }    from '../../redis/redis.service';
import { SalesNotificationsService } from './sales-notifications.service';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { buildSalesDocumentHtml, isEmptySalesLineItem } from './sales-document-print-html';
import PDFDocument = require('pdfkit');

/** Must match sales_orders_status_check in DB (001_initial_schema.sql). */
const SALES_ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const;

function safeFooterValue(value: unknown): string {
  const t = String(value ?? '').trim();
  if (!t) return '';
  if (/^(undefined|null|nan)$/i.test(t)) return '';
  return t;
}

function buildInvoiceFooterContent(company: Record<string, unknown>): string {
  return safeFooterValue(company.invoice_footer_content);
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
  // Normalize variants:
  // - /uploads/...
  // - /api/uploads/...   (common API-prefixed path)
  // - uploads/...
  // - Windows slashes from stored paths
  let p = pathname.replace(/\\/g, '/').trim();
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.startsWith('/api/uploads/')) {
    p = `/uploads/${p.slice('/api/uploads/'.length)}`;
  }
  const uploadsIdx = p.indexOf('/uploads/');
  if (uploadsIdx >= 0 && !p.startsWith('/uploads/')) {
    p = p.slice(uploadsIdx);
  }
  if (!p.startsWith('/uploads/')) return null;
  const rel = decodeURIComponent(p.slice('/uploads/'.length));
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

function lineTaxAmountForPdf(it: any, taxType?: 'exclusive' | 'inclusive' | 'no_tax'): number {
  const cgst = Number(it.cgst || 0);
  const sgst = Number(it.sgst || 0);
  const igst = Number(it.igst || 0);
  if (cgst || sgst || igst) {
    return cgst + sgst + igst;
  }

  const rate = Number(it.gst_rate || 0);
  const qty = Number(it.quantity ?? 0);
  const unitPrice = Number(it.unit_price ?? 0);
  const discount = Number(it.discount || 0);
  const total = Number(it.total ?? 0);
  const base = Math.max(0, qty * unitPrice - discount);
  const mode = taxType || inferTaxTypeFromLineItems([it]);

  if (mode === 'no_tax') {
    return 0;
  }
  if (mode === 'inclusive') {
    if (total > 0) {
      return rate > 0 ? Math.max(0, total * rate / (100 + rate)) : 0;
    }
    return rate > 0 ? Math.max(0, base * rate / (100 + rate)) : 0;
  }

  if (total > 0) {
    return Math.max(0, total - base);
  }
  return rate > 0 ? Math.max(0, base * rate / 100) : 0;
}

function lineTaxableAmountForPdf(it: any, taxType?: 'exclusive' | 'inclusive' | 'no_tax'): number {
  const total = Number(it.total ?? 0);
  const tax = lineTaxAmountForPdf(it, taxType);
  if (Number.isFinite(total) && Number.isFinite(tax)) {
    return Math.max(0, total - tax);
  }
  const qty = Number(it.quantity ?? 0);
  const unitPrice = Number(it.unit_price ?? 0);
  const discount = Number(it.discount || 0);
  return Math.max(0, qty * unitPrice - discount);
}

function inferTaxTypeFromLineItems(items: any[]): 'exclusive' | 'inclusive' | 'no_tax' {
  const lines = items || [];
  let hasTax = false;
  for (const it of lines) {
    const cgst = Number(it.cgst || 0);
    const sgst = Number(it.sgst || 0);
    const igst = Number(it.igst || 0);
    const rate = Number(it.gst_rate || 0);
    const qty = Number(it.quantity ?? 0);
    const unitPrice = Number(it.unit_price ?? 0);
    const discount = Number(it.discount || 0);
    const total = Number(it.total ?? 0);
    const base = Math.max(0, qty * unitPrice - discount);
    const tax = cgst + sgst + igst;
    if (tax > 0) {
      hasTax = true;
      if (Math.abs(total - base) < 0.01 && rate > 0) {
        return 'inclusive';
      }
    }
  }
  return hasTax ? 'exclusive' : 'no_tax';
}

function isInterstateForPdf(docData: any, kind: 'quotation' | 'order' | 'invoice'): boolean {
  if (kind !== 'invoice') return false;
  return Number(docData.igst || 0) > 0;
}

type HsnTaxRowPdf = { hsn: string; taxable: number; cgst: number; sgst: number; igst: number; rate: number };

function hsnSummaryRowsForPdf(docData: any, kind: 'quotation' | 'order' | 'invoice'): HsnTaxRowPdf[] {
  const interstate = isInterstateForPdf(docData, kind);
  const taxType = String(docData.tax_type || inferTaxTypeFromLineItems(docData.items || [])) as 'exclusive' | 'inclusive' | 'no_tax';
  const byHsn = new Map<string, HsnTaxRowPdf>();
  for (const it of docData.items || []) {
    const hsn = String(it.product_hsn_code || it.hsn_code || '—');
    const taxable = lineTaxableAmountForPdf(it, taxType);
    const gstAmt = lineTaxAmountForPdf(it, taxType);
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
    const storedSubtotal = docData.subtotal != null ? Number(docData.subtotal) : null;
    const storedCgst = Number(docData.cgst || 0);
    const storedSgst = Number(docData.sgst || 0);
    const storedIgst = Number(docData.igst || 0);
    const storedTotal = Number(docData.total_amount || 0);
    const storedTax = storedCgst + storedSgst + storedIgst;
    const interstate = isInterstateForPdf(docData, kind);
    const taxType = String(docData.tax_type || inferTaxTypeFromLineItems(docData.items || [])) as 'exclusive' | 'inclusive' | 'no_tax';
    const derived = deriveTotalsFromLineItems(docData.items || [], interstate, taxType);
    const useDerived = !storedSubtotal && storedTotal > 0 && storedTax === 0 && derived.total > 0;
    return {
      subtotal: useDerived ? derived.subtotal : storedSubtotal != null ? storedSubtotal : derived.subtotal,
      cgst: useDerived ? derived.cgst : storedCgst || derived.cgst,
      sgst: useDerived ? derived.sgst : storedSgst || derived.sgst,
      igst: useDerived ? derived.igst : storedIgst || derived.igst,
      total: storedTotal > 0 ? storedTotal : derived.total,
      balance: invoiceBalanceDueForPdf(docData),
    };
  }
  const taxType = String(docData.tax_type || inferTaxTypeFromLineItems(docData.items || [])) as 'exclusive' | 'inclusive' | 'no_tax';
  let subtotal = 0;
  let gst = 0;
  for (const it of docData.items || []) {
    subtotal += lineTaxableAmountForPdf(it, taxType);
    gst += lineTaxAmountForPdf(it, taxType);
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

/** 0–999 in words (Indian invoice style). */
function wordsBelow1000(n: number): string {
  const v = Math.floor(Math.min(999, Math.max(0, n)));
  if (v === 0) return '';
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const parts: string[] = [];
  let x = v;
  if (x >= 100) {
    parts.push(`${ones[Math.floor(x / 100)]} Hundred`);
    x %= 100;
  }
  if (x >= 20) {
    parts.push(tens[Math.floor(x / 10)]);
    x %= 10;
    if (x) parts.push(ones[x]);
  } else if (x > 0) {
    parts.push(ones[x]);
  }
  return parts.join(' ').trim();
}

/**
 * Indian numbering: Crore → Lakh → Thousand → last 3 digits.
 * Recurses for crore part when &gt; 999 so large amounts stay readable.
 */
function amountInWordsIndian(n: number): string {
  const num = Math.round(Number(n || 0));
  if (num <= 0) return 'Zero';
  if (num <= 999) return wordsBelow1000(num);

  let rem = num;
  const parts: string[] = [];

  if (rem >= 10000000) {
    const cro = Math.floor(rem / 10000000);
    rem %= 10000000;
    parts.push(`${amountInWordsIndian(cro)} Crore`);
  }
  if (rem >= 100000) {
    const lak = Math.floor(rem / 100000);
    rem %= 100000;
    parts.push(`${wordsBelow1000(lak)} Lakh`);
  }
  if (rem >= 1000) {
    const th = Math.floor(rem / 1000);
    rem %= 1000;
    parts.push(`${wordsBelow1000(th)} Thousand`);
  }
  if (rem > 0) {
    parts.push(wordsBelow1000(rem));
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function amountInWordsInr(n: number, currencyLabel = 'INR'): string {
  const num = Math.round(Number(n || 0));
  if (num === 0) return `${currencyLabel} Zero only.`;
  const words = amountInWordsIndian(num);
  return `${currencyLabel} ${words} only.`;
}

/** Indian-style grouping: last 3 digits, then pairs (e.g. 12,34,567.89). */
function formatIndianMoney(v: unknown): string {
  const num = Number(v ?? 0);
  if (!Number.isFinite(num)) return '0.00';
  const fixed = num.toFixed(2);
  const neg = num < 0;
  const [intRaw, dec] = fixed.split('.');
  const intPart = intRaw.replace(/^-/, '');
  if (intPart.length <= 3) {
    return `${neg ? '-' : ''}${intPart}.${dec}`;
  }
  const rest = intPart.slice(0, -3);
  const last3 = intPart.slice(-3);
  const groups: string[] = [last3];
  let r = rest;
  while (r.length > 2) {
    groups.unshift(r.slice(-2));
    r = r.slice(0, -2);
  }
  if (r.length > 0) groups.unshift(r);
  return `${neg ? '-' : ''}${groups.join(',')}.${dec}`;
}

type PdfUnicodeFontSet = { regular: string; bold: string; italic: string };

function firstExistingPath(paths: string[]): string | null {
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return null;
}

function resolveNodeModulePath(specifier: string): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require.resolve(specifier);
  } catch {
    return null;
  }
}

function resolvePdfUnicodeFontSet(): PdfUnicodeFontSet | null {
  const bundledRegular = resolveNodeModulePath('dejavu-fonts-ttf/ttf/DejaVuSans.ttf');
  const bundledBold = resolveNodeModulePath('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf');
  const bundledItalic = resolveNodeModulePath('dejavu-fonts-ttf/ttf/DejaVuSans-Oblique.ttf');
  const regular = firstExistingPath([
    ...(bundledRegular ? [bundledRegular] : []),
    'C:/Windows/Fonts/arial.ttf',
    'C:/Windows/Fonts/segoeui.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
    '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
  ]);
  if (!regular) return null;
  const bold = firstExistingPath([
    ...(bundledBold ? [bundledBold] : []),
    'C:/Windows/Fonts/arialbd.ttf',
    'C:/Windows/Fonts/segoeuib.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf',
  ]) ?? regular;
  const italic = firstExistingPath([
    ...(bundledItalic ? [bundledItalic] : []),
    'C:/Windows/Fonts/ariali.ttf',
    'C:/Windows/Fonts/segoeuii.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf',
    '/usr/share/fonts/truetype/noto/NotoSans-Italic.ttf',
    '/usr/share/fonts/truetype/liberation2/LiberationSans-Italic.ttf',
  ]) ?? regular;
  return { regular, bold, italic };
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

const APPROVAL_STATUSES = ['pending', 'approved', 'rejected'] as const;

function normalizeDocApprovalStatus(s: unknown): string {
  const v = String(s ?? 'approved')
    .trim()
    .toLowerCase();
  return (APPROVAL_STATUSES as readonly string[]).includes(v) ? v : 'approved';
}

function initialDocApprovalStatus(role?: string): 'pending' | 'approved' {
  return String(role || '').trim() === 'Sales Executive' ? 'pending' : 'approved';
}

function canApproveSalesDocuments(role?: string): boolean {
  const r = String(role || '').trim();
  return r === 'Admin' || r === 'Super Admin' || r === 'Sales Manager';
}

function deriveTotalsFromLineItems(
  items: any[],
  interstate = false,
  taxType: 'exclusive' | 'inclusive' | 'no_tax' = 'exclusive',
): { subtotal: number; cgst: number; sgst: number; igst: number; total: number } {
  let subtotal = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  for (const it of items || []) {
    let lineTotal = Number(it.total ?? 0);
    let lineCgst = Number(it.cgst || 0);
    let lineSgst = Number(it.sgst || 0);
    let lineIgst = Number(it.igst || 0);
    let lineTax = lineCgst + lineSgst + lineIgst;
    if (!lineTax) {
      const qty = Number(it.quantity ?? 0);
      const unit = Number(it.unit_price ?? 0);
      const rate = Number(it.gst_rate ?? 0);
      const discount = Number(it.discount || 0);
      const base = Math.max(0, qty * unit - discount);
      if (taxType === 'inclusive') {
        lineTax = rate > 0 ? lineTotal * rate / (100 + rate) : 0;
      } else if (taxType === 'no_tax') {
        lineTax = 0;
      } else {
        lineTax = base * rate / 100;
      }
      if (interstate) {
        lineIgst = lineTax;
      } else {
        lineCgst = lineTax / 2;
        lineSgst = lineTax / 2;
      }
      if (!lineTotal) {
        lineTotal = taxType === 'inclusive' ? base : base + lineTax;
      }
    }
    subtotal += lineTotal - lineTax;
    cgst += lineCgst;
    sgst += lineSgst;
    igst += lineIgst;
  }
  const total = subtotal + cgst + sgst + igst;
  return { subtotal, cgst, sgst, igst, total };
}

export type SalesActor = { id?: number; role?: string; tenant_id?: number | null };
type DbTxClient = { query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> };

@Injectable()
export class SalesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly cache: RedisService,
    private readonly salesNotifications: SalesNotificationsService,
  ) {}

  private isSuperAdmin(actor?: SalesActor): boolean {
    return String(actor?.role || '').trim().toLowerCase() === 'super admin';
  }

  private requireTenantId(actor?: SalesActor): number {
    if (this.isSuperAdmin(actor)) return 0;
    const tenantId = Number((actor as any)?.tenant_id);
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      throw new ForbiddenException('Tenant context is required');
    }
    return tenantId;
  }

  private toCustomerApiShape(row: any) {
    if (!row) return row;
    return row;
  }

  // ─── Customers ────────────────────────────────────────────
  async listCustomers(search?: string, actor?: SalesActor) {
    const tenantId = this.requireTenantId(actor);
    const cacheKey = `customers:${tenantId}:${search||''}`;
    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) return cached.map((r) => this.toCustomerApiShape(r));
    const vals: any[] = [tenantId];
    let where = 'WHERE ($1::integer = 0 OR c.tenant_id = $1)';
    if (search) {
      vals.push(`%${search}%`);
      where += ' AND (c.name ILIKE $2 OR c.email ILIKE $2 OR c.phone ILIKE $2)';
    }
    const res = await this.db.query(
      `SELECT c.*, u.name AS created_by_name
       FROM customers c
       LEFT JOIN users u ON u.id = c.created_by
       ${where}
       ORDER BY c.name`,
      vals,
    );
    await this.cache.set(cacheKey, res.rows, 120);
    return res.rows.map((r) => this.toCustomerApiShape(r));
  }

  async getCustomer(id: number, actor?: SalesActor) {
    const tenantId = this.requireTenantId(actor);
    const row = (
      await this.db.query(
        `SELECT c.*, u.name AS created_by_name
         FROM customers c
         LEFT JOIN users u ON u.id = c.created_by
         WHERE c.id=$1 AND ($2::integer = 0 OR c.tenant_id = $2)`,
        [id, tenantId],
      )
    ).rows[0];
    return this.toCustomerApiShape(row);
  }
  async createCustomer(d: any, actor?: SalesActor) {
    const tenantId = this.requireTenantId(actor);
    const billingAddress = d.billing_address ?? null;
    const shippingAddress = d.shipping_address ?? null;
    const res = await this.db.query(
      `INSERT INTO customers
        (name,email,phone,gstin,billing_address,shipping_address,lead_id,created_by,tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        d.name,
        d.email,
        d.phone,
        d.gstin,
        billingAddress,
        shippingAddress,
        d.lead_id,
        d.created_by ?? null,
        tenantId > 0 ? tenantId : null,
      ],
    );
    await this.cache.delPattern('customers:*');
    return this.toCustomerApiShape(res.rows[0]);
  }
  async updateCustomer(id: number, d: any, actor?: SalesActor) {
    const tenantId = this.requireTenantId(actor);
    const patch = { ...d };
    const fields = ['name','email','phone','gstin','billing_address','shipping_address','is_active'];
    const sets: string[] = []; const vals: any[] = []; let i = 1;
    for (const f of fields) { if(patch[f]!==undefined){ sets.push(`${f}=$${i++}`); vals.push(patch[f]); } }
    if(!sets.length) return null;
    vals.push(id, tenantId);
    const res = await this.db.query(
      `UPDATE customers SET ${sets.join(',')} WHERE id=$${i} AND ($${i + 1}::integer = 0 OR tenant_id = $${i + 1}) RETURNING *`,
      vals,
    );
    await this.cache.delPattern('customers:*');
    return this.toCustomerApiShape(res.rows[0]);
  }

  /** Active users who can own quotes/orders/invoices (sales module filters). */
  async listSalesExecutives(actor?: SalesActor) {
    const tenantId = this.requireTenantId(actor);
    return (
      await this.db.query(
        `SELECT DISTINCT u.id, u.name
         FROM users u
         INNER JOIN roles r ON r.id = u.role_id
         WHERE u.is_active = TRUE
           AND r.name IN ('Sales Executive', 'Sales Manager', 'Admin')
           AND ($1::integer = 0 OR u.tenant_id = $1)
         ORDER BY u.name`,
        [tenantId],
      )
    ).rows;
  }

  /** Whether this user may be stored as document owner (created_by). */
  private async isAssignableSalesUser(userId: number, tenantId: number): Promise<boolean> {
    const r = await this.db.query(
      `SELECT 1 FROM users u
       INNER JOIN roles ro ON ro.id = u.role_id
       WHERE u.id = $1 AND u.is_active = TRUE
         AND ($2::integer = 0 OR u.tenant_id = $2)
         AND ro.name IN ('Sales Executive', 'Sales Manager', 'Admin', 'Super Admin')
       LIMIT 1`,
      [userId, tenantId],
    );
    return r.rows.length > 0;
  }

  /**
   * Pick `created_by` for a new/patched sales document.
   * Admins / Super Admins / Sales Managers may assign another sales user; others always self.
   */
  async resolveDocumentCreatedBy(actor: { id: number; role?: string }, requested: unknown): Promise<number> {
    const tenantId = this.requireTenantId(actor as any);
    const self = Number(actor.id);
    if (requested === undefined || requested === null || requested === '') return self;
    const rid = Number(requested);
    if (!Number.isFinite(rid) || rid <= 0) return self;
    if (rid === self) return self;
    const assignerRoles = new Set(['Admin', 'Super Admin', 'Sales Manager']);
    if (!assignerRoles.has(String(actor.role || ''))) return self;
    const ok = await this.isAssignableSalesUser(rid, tenantId);
    return ok ? rid : self;
  }

  private async assertDocumentApprovalPatch(
    table: 'quotations' | 'sales_orders' | 'invoices',
    id: number,
    requested: 'approved' | 'rejected',
    actor: SalesActor,
  ): Promise<void> {
    const tenantId = this.requireTenantId(actor);
    if (!canApproveSalesDocuments(actor?.role)) {
      throw new ForbiddenException('Only Admin, Super Admin, or Sales Manager can approve or reject this document.');
    }
    const cur = await this.db.query(
      `SELECT approval_status FROM ${table} WHERE id=$1 AND ($2::integer = 0 OR tenant_id = $2)`,
      [id, tenantId],
    );
    if (!cur.rows[0]) throw new NotFoundException();
    if (cur.rows[0].approval_status !== 'pending') {
      throw new BadRequestException('Document is not awaiting approval.');
    }
    const ab = Number(actor.id);
    const approver = Number.isFinite(ab) && ab > 0 ? ab : null;
    await this.db.query(
      `UPDATE ${table} SET approval_status=$1, approved_by=$2, approved_at=NOW() WHERE id=$3 AND ($4::integer = 0 OR tenant_id = $4)`,
      [requested, approver, id, tenantId],
    );
  }

  private money(v: unknown): string {
    return formatIndianMoney(v);
  }

  private async nextQuotationNumber(client: DbTxClient): Promise<string> {
    // Avoid duplicate numbers when two quotes are created concurrently.
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('quotations:number'))`);
    const last = await client.query(
      `SELECT quotation_number
         FROM quotations
        WHERE quotation_number ~ '^QUOT-[0-9]{1,6}$'
        ORDER BY CAST(SUBSTRING(quotation_number FROM 'QUOT-([0-9]+)$') AS INTEGER) DESC
        LIMIT 1`,
    );
    const raw = String(last.rows[0]?.quotation_number || '');
    const m = /^QUOT-(\d{1,6})$/.exec(raw);
    const next = (m ? Number(m[1]) : 0) + 1;
    return `QUOT-${String(next).padStart(4, '0')}`;
  }

  private writePdfToFile(doc: any, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const stream = doc.pipe(createWriteStream(filePath));
      stream.on('finish', () => resolve());
      stream.on('error', (err: unknown) => reject(err));
      doc.end();
    });
  }

  async generateSalesPdfFile(kind: 'quotation' | 'order' | 'invoice', id: number, actor?: SalesActor) {
    const company = (await this.db.query('SELECT * FROM company_settings LIMIT 1')).rows[0] || {};
    const docData =
      kind === 'quotation'
        ? await this.getQuotation(id, actor)
        : kind === 'order'
          ? await this.getOrder(id, actor)
          : await this.getInvoice(id, actor);
    if (!docData) return null;
    const ap = String((docData as { approval_status?: string }).approval_status ?? 'approved');
    if (ap === 'pending' && !canApproveSalesDocuments(actor?.role)) {
      throw new ForbiddenException('This document is pending approval and cannot be exported yet.');
    }
    if (ap === 'rejected' && !canApproveSalesDocuments(actor?.role)) {
      throw new ForbiddenException('This document was rejected and cannot be exported.');
    }

    const uploadsRoot = join(process.cwd(), 'uploads');
    const pdfDir = join(uploadsRoot, 'pdfs');
    if (!existsSync(pdfDir)) mkdirSync(pdfDir, { recursive: true });

    const safeKind = kind;
    const fileName = `${safeKind}-${id}-${Date.now()}.pdf`;
    const filePath = join(pdfDir, fileName);

    const useHtmlPrintEngine = process.env.SALES_PDF_ENGINE !== 'pdfkit';
    if (useHtmlPrintEngine) {
      try {
        const { loadInvoiceLogoDataUrl, renderSalesPrintHtmlToPdf } = await import('./sales-html-pdf');
        const logoDataUrl = await loadInvoiceLogoDataUrl(company as Record<string, unknown>, uploadsRoot);
        const html = buildSalesDocumentHtml(
          docData,
          company as Record<string, unknown>,
          logoDataUrl,
          kind,
          { includeSheetFooter: true, rasterLayout: false },
        );
        const buf = await renderSalesPrintHtmlToPdf(html);
        await writeFile(filePath, buf);
        return {
          url: `/sales/generated-pdfs/${fileName}`,
          file_name: fileName,
          kind,
          id,
        };
      } catch (err) {
        console.warn('[SalesService] Print-view HTML PDF failed, falling back to PDFKit:', err);
      }
    }

    const pdfLineItems = (Array.isArray(docData.items) ? docData.items : []).filter(
      (it: Record<string, unknown>) => !isEmptySalesLineItem(it),
    );
    const docDataForPdfKit = { ...docData, items: pdfLineItems };

    const pdf = new PDFDocument({ size: 'A4', margin: 23, bufferPages: true });
    const unicodeFonts = resolvePdfUnicodeFontSet();
    const fontRegular = unicodeFonts ? 'PdfUnicodeRegular' : 'Helvetica';
    const fontBold = unicodeFonts ? 'PdfUnicodeBold' : 'Helvetica-Bold';
    const currencyLabel = unicodeFonts ? '₹' : 'INR';
    if (unicodeFonts) {
      pdf.registerFont(fontRegular, unicodeFonts.regular);
      pdf.registerFont(fontBold, unicodeFonts.bold);
      pdf.registerFont('PdfUnicodeItalic', unicodeFonts.italic);
    }
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
      const pageSidePad = 8;
      const pageLeft = m.left + pageSidePad;
      const pageRight = pdf.page.width - m.right - pageSidePad;
      const pageWidth = pageRight - pageLeft;
      const borderColor = '#B9C3CF';
      const borderColorSoft = '#C7CFD9';
      const borderWidth = 0.6;

      const footerBaseText = buildInvoiceFooterContent(company as Record<string, unknown>);
      const footerText = footerBaseText ? `${footerBaseText}\nPage 1 of 1` : 'Page 1 of 1';
      pdf.font('Helvetica').fontSize(7);
      const footerHeight = pdf.heightOfString(footerText, { width: pageWidth, align: 'center' });
      const footerBand = Math.max(footerHeight + 18, 44);
      let y = m.top;
      const bottomLimit = pdf.page.height - m.bottom - footerBand;

      const bumpPage = (need: number) => {
        while (y + need > bottomLimit) {
          pdf.addPage();
          y = pdf.page.margins.top;
        }
      };

      const customerBillingAddress = String(docData.customer_billing_address || docData.customer_address || '');
      const customerShippingAddress = String(docData.customer_shipping_address || docData.customer_address || '');
      const customerGstin = String(docData.customer_gstin || '');
      const rawTerms = String([docData.notes || '', company.payment_terms || ''].filter(Boolean).join('\n'));
      const terms = stripBankDetailsFromTerms(rawTerms);
      const bankBlock = formatBankDetailsBlock(company as Record<string, unknown>);
      const dd = docData as Record<string, unknown>;
      const execName = String(
        dd.sales_executive_name || dd.sales_executive || dd.sales_person_name || dd.created_by_name || '—',
      );
      const creatorName = String(dd.creator_name || dd.created_by_name || '—');
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
      // Header: left ~65% (logo), right 35% (company name / address / GSTIN); no inner vertical line
      const rightColPct = 0.35;
      const rightBlkW = Math.floor(pageWidth * rightColPct);
      const leftColW = pageWidth - rightBlkW;
      const rightTextW = Math.max(40, rightBlkW - 12);
      const addrLinesComp = topAddressTwoLines(String(company.address || ''));
      const companyName = String(company.company_name || 'Company');
      const headerCompanyFontSize = 13;
      const headerAddressFontSize = 8;
      // Measure right-column text with real wrapping to avoid overlaps.
      pdf.font('Helvetica-Bold').fontSize(headerCompanyFontSize);
      const companyNameH = pdf.heightOfString(companyName, { width: rightTextW, align: 'right' });
      pdf.font('Helvetica').fontSize(headerAddressFontSize);
      const addrHeights = addrLinesComp.map((ln) => pdf.heightOfString(ln, { width: rightTextW, align: 'right' }));
      const addrTotalH = addrHeights.reduce((sum, h) => sum + h, 0);
      const addrGapH = addrLinesComp.length > 1 ? (addrLinesComp.length - 1) * 2 : 0;
      const gstText = company.gstin ? `GSTIN: ${String(company.gstin)}` : '';
      const headerGstH = gstText.length === 0 ? 0 : pdf.heightOfString(gstText, { width: rightTextW, align: 'right' });
      let headerH = Math.ceil(6 + companyNameH + 4 + addrTotalH + addrGapH + (headerGstH > 0 ? 2 + headerGstH : 0) + 6);
      if (hasLogo) headerH = Math.max(headerH, 80);
      bumpPage(headerH + 36);
      const headerTop = y;
      pdf.save().lineWidth(borderWidth).strokeColor(borderColor);
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
      let hy = headerTop + 6;
      const rightX = pageLeft + leftColW + 6;
      pdf
        .fontSize(headerCompanyFontSize)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text(companyName, rightX, hy, { width: rightTextW, align: 'right' });
      hy += companyNameH + 4;
      pdf.fontSize(headerAddressFontSize).font('Helvetica');
      for (let i = 0; i < addrLinesComp.length; i++) {
        const ln = addrLinesComp[i];
        pdf.text(ln, rightX, hy, { width: rightTextW, align: 'right' });
        hy += addrHeights[i] + 2;
      }
      if (gstText.length > 0) {
        pdf.text(gstText, rightX, hy, { width: rightTextW, align: 'right' });
        hy += headerGstH;
      }
      y = headerTop + headerH;

      bumpPage(36);
      pdf.rect(pageLeft, y, pageWidth, 24).lineWidth(borderWidth).stroke(borderColor);
      pdf.fontSize(12).font('Helvetica-Bold').text(title, pageLeft, y + 7, { width: pageWidth, align: 'center' });
      y += 32;

      const leftW = pageWidth / 2;
      const metaH = 56;
      bumpPage(metaH + 8);
      pdf.rect(pageLeft, y, pageWidth, metaH).lineWidth(borderWidth).stroke(borderColor);
      pdf.moveTo(pageLeft + leftW, y).lineTo(pageLeft + leftW, y + metaH).lineWidth(borderWidth).stroke(borderColor);
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
      pdf.font('Helvetica').text(`: ${creatorName}`, pageLeft + leftW + 92, y + 22);
      y += metaH + 8;

      // Address blocks: use dynamic height to prevent overlap for long/wrapped addresses.
      const addrPadX = 6;
      const addrColW = leftW - addrPadX * 2;
      const addrHeaderH = 16;
      const addrTopPad = 6;
      const addrNameY = y + addrHeaderH + addrTopPad;
      const addrName = String(docData.customer_name || '—');
      pdf.font('Helvetica').fontSize(8.5);
      const nameH = pdf.heightOfString(addrName, { width: addrColW });
      const billH = pdf.heightOfString(customerBillingAddress, { width: addrColW });
      const shipH = pdf.heightOfString(customerShippingAddress, { width: addrColW });
      const gstH = customerGstin ? pdf.heightOfString(`GSTIN : ${customerGstin}`, { width: addrColW }) : 0;
      const contentH = Math.max(nameH + 4 + billH + (customerGstin ? 4 + gstH : 0), nameH + 4 + shipH + (customerGstin ? 4 + gstH : 0));
      const boxH = Math.max(76, addrHeaderH + addrTopPad + contentH + 8);
      bumpPage(boxH + 8);

      pdf.rect(pageLeft, y, leftW, boxH).lineWidth(borderWidth).stroke(borderColor);
      pdf.rect(pageLeft + leftW, y, leftW, boxH).lineWidth(borderWidth).stroke(borderColor);
      pdf.rect(pageLeft, y, leftW, addrHeaderH).lineWidth(borderWidth).fillAndStroke('#eaeaea', borderColorSoft);
      pdf.rect(pageLeft + leftW, y, leftW, addrHeaderH).lineWidth(borderWidth).fillAndStroke('#eaeaea', borderColorSoft);
      pdf.fillColor('#000000').font('Helvetica-Bold').fontSize(9).text('Billing Address', pageLeft + addrPadX, y + 4);
      pdf.text('Delivery Address', pageLeft + leftW + addrPadX, y + 4);

      pdf.font('Helvetica').fontSize(8.5);
      // Left (billing)
      let addrLy = addrNameY;
      pdf.text(addrName, pageLeft + addrPadX, addrLy, { width: addrColW, ellipsis: true });
      addrLy += nameH + 4;
      pdf.text(customerBillingAddress, pageLeft + addrPadX, addrLy, { width: addrColW, height: boxH - (addrLy - y) - 10, ellipsis: true });
      if (customerGstin) {
        // Place GSTIN at bottom of the box to avoid overlapping wrapped address.
        pdf.text(`GSTIN : ${customerGstin}`, pageLeft + addrPadX, y + boxH - 14, { width: addrColW, ellipsis: true });
      }

      // Right (shipping)
      let addrRy = addrNameY;
      pdf.text(addrName, pageLeft + leftW + addrPadX, addrRy, { width: addrColW, ellipsis: true });
      addrRy += nameH + 4;
      pdf.text(customerShippingAddress, pageLeft + leftW + addrPadX, addrRy, { width: addrColW, height: boxH - (addrRy - y) - 10, ellipsis: true });
      if (customerGstin) {
        pdf.text(`GSTIN : ${customerGstin}`, pageLeft + leftW + addrPadX, y + boxH - 14, { width: addrColW, ellipsis: true });
      }

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
      pdf.rect(pageLeft, y, pageWidth, 18).lineWidth(borderWidth).fillAndStroke('#eaeaea', borderColor);
      headers.forEach((h, i) => {
        pdf
          .fillColor('#000000')
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .text(h, x + 4, y + 5, { width: cols[i] - 8, align: i >= 4 ? 'right' : i === 0 || i === 2 || i === 3 ? 'center' : 'left' });
        x += cols[i];
      });
      y += 18;
      const items = pdfLineItems;
      if (!items.length) {
        bumpPage(16);
        pdf.rect(pageLeft, y, pageWidth, 16).lineWidth(borderWidth).stroke(borderColor);
        pdf.font('Helvetica').fontSize(8.5).text('No line items', pageLeft, y + 4, { width: pageWidth, align: 'center' });
        y += 16;
      } else {
        items.forEach((it: any, idx: number) => {
          const desc = String(it.description || it.product_name || '—');
          const descH = pdf.heightOfString(desc, { width: cols[1] - 8 });
          const rowH = Math.max(16, Math.ceil(descH) + 8);
          bumpPage(rowH);
          pdf.rect(pageLeft, y, pageWidth, rowH).lineWidth(borderWidth).stroke(borderColor);
          let cx = pageLeft;
          const vals = [
            String(idx + 1),
            desc,
            String(it.product_hsn_code || it.hsn_code || '—'),
            `${Number(it.quantity || 0)}`,
            this.money(it.unit_price),
            this.money(it.total),
          ];
          vals.forEach((v, i) => {
            pdf
              .font('Helvetica')
              .fontSize(8.2)
              .text(v, cx + 4, y + 4, {
                width: cols[i] - 8,
                height: rowH - 8,
                ellipsis: true,
                align: i >= 4 ? 'right' : i === 0 || i === 2 || i === 3 ? 'center' : 'left',
              });
            cx += cols[i];
          });
          y += rowH;
        });
      }

      y += 8;

      const interstate = kind === 'invoice' && Number(docData.igst || 0) > 0;
      const taxRows = hsnSummaryRowsForPdf(docDataForPdfKit, kind);
      const displayTaxRows: HsnTaxRowPdf[] = taxRows.length
        ? taxRows
        : [{ hsn: '—', taxable: 0, cgst: 0, sgst: 0, igst: 0, rate: 0 }];
      const taxWeights = interstate ? [90, 230, 195] : [88, 178, 124, 125];
      const taxCols = layoutColsToPageWidth(pageWidth, taxWeights);
      const taxHdrH = 18;
      const taxRowH = 16;
      const taxTableH = taxHdrH + displayTaxRows.length * taxRowH;
      bumpPage(taxTableH + 4);
      pdf.rect(pageLeft, y, pageWidth, taxHdrH).lineWidth(borderWidth).fillAndStroke('#eaeaea', borderColor);
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
        pdf.rect(pageLeft, y, pageWidth, taxRowH).lineWidth(borderWidth).stroke(borderColor);
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
      const t = totalsForSalesPdf(docDataForPdfKit, kind);
      const totalTax = t.cgst + t.sgst + t.igst;
      const subTotal = t.subtotal != null ? t.subtotal : t.total - totalTax;
      const wordsStr = amountInWordsInr(t.total, currencyLabel);
      const amtColW = Math.min(230, Math.floor(pageWidth * 0.45));
      const wordsColW = pageWidth - amtColW;
      const boxPad = 8;
      const totalsFontSize = 9.5;
      const totalsLineGap = 12;
      pdf.font(fontRegular).fontSize(totalsFontSize);
      const leftTextH = pdf.heightOfString(wordsStr, { width: wordsColW - boxPad * 2 });
      let rightLineCount = 1;
      if (t.cgst > 0) rightLineCount += 1;
      if (t.sgst > 0) rightLineCount += 1;
      if (t.igst > 0) rightLineCount += 1;
      if (totalTax > 0) rightLineCount += 1;
      rightLineCount += 1;
      if (kind === 'invoice' && t.balance != null) rightLineCount += 1;
      const rightBlockH = boxPad * 2 + rightLineCount * totalsLineGap + 6;
      const leftBlockH = boxPad * 2 + totalsLineGap + leftTextH;
      const totalsBoxH = Math.max(leftBlockH, rightBlockH, 52);
      bumpPage(totalsBoxH + 8);
      pdf.rect(pageLeft, y, pageWidth, totalsBoxH).lineWidth(borderWidth).stroke(borderColor);
      pdf.moveTo(pageLeft + wordsColW, y).lineTo(pageLeft + wordsColW, y + totalsBoxH).lineWidth(borderWidth).stroke(borderColor);
      pdf.fillColor('#000000').font(fontBold).fontSize(totalsFontSize).text('Total in Words', pageLeft + boxPad, y + boxPad);
      pdf.font(fontRegular).fontSize(totalsFontSize).text(wordsStr, pageLeft + boxPad, y + boxPad + totalsLineGap, { width: wordsColW - boxPad * 2 });
      const ax = pageLeft + wordsColW + boxPad;
      const aw = amtColW - boxPad * 2;
      let ry = y + boxPad;
      const totalLine = (label: string, val: string, bold = false, red = false) => {
        if (red) pdf.fillColor('#cc0000');
        else pdf.fillColor('#000000');
        pdf.font(bold ? fontBold : fontRegular).fontSize(totalsFontSize);
        pdf.text(label, ax, ry, { width: aw - 80, align: 'left' });
        pdf.text(`${currencyLabel} ${val}`, ax, ry, { width: aw, align: 'right' });
        ry += totalsLineGap;
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

      const colGap = 8;
      const colW = (pageWidth - colGap) / 2;
      const termsHeaderH = 18;
      const lineH = 10;
      const colInnerW = Math.max(0, colW - 12);
      const wrapPdfLines = (rawText: string): string[] => {
        const src = String(rawText || '').replace(/\r/g, '');
        const lines: string[] = [];
        const paragraphs = src.split('\n');
        pdf.font('Helvetica').fontSize(8);
        for (const para of paragraphs) {
          const trimmed = para.trim();
          if (!trimmed) {
            lines.push('');
            continue;
          }
          const words = trimmed.split(/\s+/).filter(Boolean);
          let current = '';
          for (const w of words) {
            const next = current ? `${current} ${w}` : w;
            if (!current || pdf.widthOfString(next) <= colInnerW) current = next;
            else {
              lines.push(current);
              current = w;
            }
          }
          if (current) lines.push(current);
        }
        return lines.length ? lines : ['—'];
      };
      const termsLines = wrapPdfLines(String(terms || '').trim() || '—');
      const bankLines = wrapPdfLines(String(bankBlock || '').trim() || '—');
      let termsIdx = 0;
      let bankIdx = 0;
      while (termsIdx < termsLines.length || bankIdx < bankLines.length) {
        bumpPage(termsHeaderH + lineH * 2 + 18);
        const leftX = pageLeft;
        const rightX = pageLeft + colW + colGap;
        const bodyTop = y + termsHeaderH + 6;
        const availableBody = Math.max(10, bottomLimit - bodyTop - 8);
        const linesPerChunk = Math.max(1, Math.floor(availableBody / lineH));
        const termsChunk = termsLines.slice(termsIdx, termsIdx + linesPerChunk);
        const bankChunk = bankLines.slice(bankIdx, bankIdx + linesPerChunk);
        const usedLines = Math.max(termsChunk.length, bankChunk.length, 1);
        const blockH = termsHeaderH + 6 + usedLines * lineH + 6;

        pdf.rect(leftX, y, colW, blockH).lineWidth(borderWidth).stroke(borderColor);
        pdf.rect(rightX, y, colW, blockH).lineWidth(borderWidth).stroke(borderColor);
        pdf.font('Helvetica-Bold').fontSize(9).fillColor('#000000').text(
          termsIdx > 0 ? 'Terms And Conditions (contd.):' : 'Terms And Conditions:',
          leftX + 6,
          y + 5,
        );
        pdf.font('Helvetica-Bold').fontSize(9).fillColor('#000000').text(
          bankIdx > 0 ? 'Bank Details (contd.):' : 'Bank Details:',
          rightX + 6,
          y + 5,
        );

        pdf.font('Helvetica').fontSize(8).fillColor('#000000');
        for (let li = 0; li < usedLines; li += 1) {
          const ly = bodyTop + li * lineH;
          if (termsChunk[li]) pdf.text(termsChunk[li], leftX + 6, ly, { width: colInnerW, lineBreak: false });
          if (bankChunk[li]) pdf.text(bankChunk[li], rightX + 6, ly, { width: colInnerW, lineBreak: false });
        }

        termsIdx += termsChunk.length;
        bankIdx += bankChunk.length;
        y += blockH + 8;
      }

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
      if (docData.customer_billing_address || docData.customer_address) {
        pdf.text(`Billing Address: ${docData.customer_billing_address || docData.customer_address}`);
      }
      if (docData.customer_shipping_address || docData.customer_address) {
        pdf.text(`Shipping Address: ${docData.customer_shipping_address || docData.customer_address}`);
      }
      if (docData.customer_gstin) pdf.text(`GSTIN: ${docData.customer_gstin}`);
      pdf.moveDown(0.4);
      pdf.text(`Sales Executive: ${docData.sales_executive_name || docData.created_by_name || '—'}`);
      pdf.text(`Created By: ${docData.creator_name || docData.created_by_name || '—'}`);
      const docDate = docData.invoice_date || docData.order_date || docData.created_at;
      if (docDate) pdf.text(`Date: ${String(docDate).slice(0, 10)}`);
      if (docData.valid_until) pdf.text(`Valid Until: ${String(docData.valid_until).slice(0, 10)}`);
      if (docData.due_date) pdf.text(`Due Date: ${String(docData.due_date).slice(0, 10)}`);
      pdf.moveDown(0.8);

      pdf.fontSize(10).text('Items', { underline: true });
      pdf.moveDown(0.4);
      const items = pdfLineItems;
      if (!items.length) {
        pdf.fontSize(9).text('No line items');
      } else {
        items.forEach((it: any, idx: number) => {
          const desc = String(it.description || it.product_name || '—');
          const qty = Number(it.quantity || 0);
          const rate = this.money(it.unit_price);
          const total = this.money(it.total);
          pdf.fontSize(9).text(`${idx + 1}. ${desc}`);
          pdf.font(fontRegular).fontSize(8).fillColor('gray').text(`Qty: ${qty}  Rate: ${currencyLabel} ${rate}  Amount: ${currencyLabel} ${total}`);
          pdf.fillColor('black').moveDown(0.3);
        });
      }

      const total = this.money(docData.total_amount);
      pdf.font(fontBold).moveDown(0.6).fontSize(11).text(`Total: ${currencyLabel} ${total}`, { align: 'right' });
      if (docData.notes) {
        pdf.moveDown(0.8).fontSize(9).text('Terms And Conditions:', { underline: true });
        pdf.fontSize(8).text(String(docData.notes));
      }
      pdf.moveDown(1.2).fontSize(9).text('Thanks for your business');
      pdf.moveDown(1.5).fontSize(10).text(`For ${company.company_name || 'Company'},`);
    }

    {
      const m = pdf.page.margins;
      const pageSidePad = 8;
      const footerLeft = m.left + pageSidePad;
      const footerWidth = Math.max(0, pdf.page.width - m.left - m.right - pageSidePad * 2);
      const footerBaseText = buildInvoiceFooterContent(company as Record<string, unknown>);
      const fr = pdf.bufferedPageRange();
      for (let pi = fr.start; pi < fr.start + fr.count; pi++) {
        pdf.switchToPage(pi);
        pdf.font('Helvetica').fontSize(7);
        const pageLabel = `Page ${pi - fr.start + 1} of ${fr.count}`;
        const footerText = footerBaseText ? `${footerBaseText}\n${pageLabel}` : pageLabel;
        const footerHeight = pdf.heightOfString(footerText, { width: footerWidth, align: 'center' });
        const fy = pdf.page.height - m.bottom - footerHeight - 10;
        pdf.fillColor('#666666').text(footerText, footerLeft, fy, {
          width: footerWidth,
          align: 'center',
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
  async listQuotations(filters?: {
    customer_id?: number;
    created_by?: number;
    status?: string;
    approval_status?: string;
    from?: string;
    to?: string;
  }, actor?: SalesActor) {
    const tenantId = this.requireTenantId(actor);
    const conds: string[] = [];
    const vals: any[] = [tenantId];
    let n = 2;
    conds.push('($1::integer = 0 OR q.tenant_id = $1)');
    if (filters?.customer_id) {
      conds.push(`q.customer_id=$${n++}`);
      vals.push(filters.customer_id);
    }
    if (filters?.created_by) {
      conds.push(`COALESCE(q.sales_executive_id, q.created_by)=$${n++}`);
      vals.push(filters.created_by);
    }
    if (filters?.status) {
      conds.push(`q.status=$${n++}`);
      vals.push(filters.status);
    }
    if (filters?.approval_status) {
      conds.push(`q.approval_status=$${n++}`);
      vals.push(filters.approval_status);
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
        `SELECT q.*,
                c.name AS customer_name,
                COALESCE(se.name, u.name) AS created_by_name,
                se.name AS sales_executive_name,
                u.name AS creator_name
         FROM quotations q
         JOIN customers c ON c.id=q.customer_id
         LEFT JOIN users u ON u.id=q.created_by
         LEFT JOIN users se ON se.id=q.sales_executive_id
         ${where} ORDER BY q.created_at DESC`,
        vals,
      )
    ).rows;
  }
  async getQuotation(id: number, actor?: SalesActor) {
    const tenantId = this.requireTenantId(actor);
    const [q, items] = await Promise.all([
      this.db.query(
        `SELECT q.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
                c.gstin AS customer_gstin,
                COALESCE(q.customer_billing_address, c.billing_address) AS customer_address,
                COALESCE(q.customer_billing_address, c.billing_address) AS customer_billing_address,
                COALESCE(q.customer_shipping_address, c.shipping_address) AS customer_shipping_address,
                COALESCE(se.name, cu.name) AS created_by_name,
                se.name AS sales_executive_name,
                cu.name AS creator_name
           FROM quotations q
           JOIN customers c ON c.id=q.customer_id
           LEFT JOIN users cu ON cu.id=q.created_by
           LEFT JOIN users se ON se.id=q.sales_executive_id
           WHERE q.id=$1 AND ($2::integer = 0 OR q.tenant_id = $2)`,
        [id, tenantId],
      ),
      this.db.query(
        `SELECT qi.*, pr.name AS product_name, pr.hsn_code AS product_hsn_code
           FROM quotation_items qi LEFT JOIN products pr ON pr.id=qi.product_id WHERE qi.quotation_id=$1`,
        [id],
      ),
    ]);
    return q.rows[0] ? { ...q.rows[0], items: items.rows } : null;
  }
  async createQuotation(data: any, items: any[], actor?: SalesActor) {
    const tenantId = this.requireTenantId(actor);
    const created = await this.db.transaction(async (client) => {
      const { subtotal, cgst, sgst, igst, total } = deriveTotalsFromLineItems(
        items,
        data.is_interstate || false,
        String(data.tax_type || 'exclusive') as 'exclusive' | 'inclusive' | 'no_tax',
      );
      const qn = await this.nextQuotationNumber(client);
      const approval = initialDocApprovalStatus(actor?.role);
      const approverId =
        approval === 'approved' && Number.isFinite(Number(actor?.id)) && Number(actor?.id) > 0
          ? Number(actor?.id)
          : null;
      const qr = await client.query(
        `INSERT INTO quotations
          (quotation_number,customer_id,proposal_id,status,valid_until,notes,
           gst_type,tax_type,is_interstate,subtotal,cgst,sgst,igst,total_amount,created_by,sales_executive_id,
           customer_billing_address,customer_shipping_address,
           approval_status,approved_by,approved_at,tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *`,
        [
          qn,
          data.customer_id,
          data.proposal_id,
          data.status || 'draft',
          data.valid_until,
          data.notes,
          data.gst_type || 'intra_state',
          data.tax_type || 'exclusive',
          data.is_interstate || false,
          subtotal,
          cgst,
          sgst,
          igst,
          total,
          Number.isFinite(Number(data.created_by)) && Number(data.created_by) > 0 ? Number(data.created_by) : null,
          Number.isFinite(Number(data.sales_executive_id)) && Number(data.sales_executive_id) > 0
            ? Number(data.sales_executive_id)
            : null,
          data.customer_billing_address ?? null,
          data.customer_shipping_address ?? null,
          approval,
          approverId,
          approverId ? new Date().toISOString() : null,
          tenantId > 0 ? tenantId : null,
        ],
      );
      for (const it of items)
        await client.query(
          'INSERT INTO quotation_items (quotation_id,product_id,description,quantity,unit_price,discount,gst_rate,cgst,sgst,igst,total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
          [qr.rows[0].id, it.product_id||null, it.description, it.quantity, it.unit_price, it.discount||0, it.gst_rate||0, it.cgst||0, it.sgst||0, it.igst||0, it.total]);
      return qr.rows[0];
    });
    await this.salesNotifications.notifySalesManagerOnExecutiveQuoteCreated(created, actor);
    return created;
  }

  // ─── Orders ───────────────────────────────────────────────
  async listOrders(filters?: {
    customer_id?: number;
    created_by?: number;
    status?: string;
    approval_status?: string;
    from?: string;
    to?: string;
  }, actor?: SalesActor) {
    const tenantId = this.requireTenantId(actor);
    const conds: string[] = [];
    const vals: any[] = [tenantId];
    let n = 2;
    conds.push('($1::integer = 0 OR o.tenant_id = $1)');
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
    if (filters?.approval_status) {
      conds.push(`o.approval_status=$${n++}`);
      vals.push(filters.approval_status);
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
  async getOrder(id: number, actor?: SalesActor) {
    const tenantId = this.requireTenantId(actor);
    const [o, items] = await Promise.all([
      this.db.query(
        `SELECT o.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
                c.gstin AS customer_gstin,
                c.billing_address AS customer_address,
                c.billing_address AS customer_billing_address,
                c.shipping_address AS customer_shipping_address,
                cu.name AS created_by_name
           FROM sales_orders o
           JOIN customers c ON c.id=o.customer_id
           LEFT JOIN users cu ON cu.id=o.created_by
           WHERE o.id=$1 AND ($2::integer = 0 OR o.tenant_id = $2)`,
        [id, tenantId],
      ),
      this.db.query(
        `SELECT oi.*, pr.name AS product_name, pr.hsn_code AS product_hsn_code
           FROM sales_order_items oi LEFT JOIN products pr ON pr.id=oi.product_id WHERE oi.order_id=$1`,
        [id],
      ),
    ]);
    return o.rows[0] ? { ...o.rows[0], items: items.rows } : null;
  }
  async createOrder(data: any, items: any[], actor?: SalesActor) {
    const tenantId = this.requireTenantId(actor);
    if (data.quotation_id) {
      const q = await this.db.query(
        'SELECT approval_status FROM quotations WHERE id=$1 AND ($2::integer = 0 OR tenant_id = $2)',
        [data.quotation_id, tenantId],
      );
      if (!q.rows[0]) throw new BadRequestException('Quotation not found.');
      if (q.rows[0].approval_status !== 'approved') {
        throw new BadRequestException('The quotation must be approved before you can create an order from it.');
      }
    }
    return this.db.transaction(async (client) => {
      const { subtotal, cgst, sgst, igst, total } = deriveTotalsFromLineItems(
        items,
        data.is_interstate || false,
        String(data.tax_type || 'exclusive') as 'exclusive' | 'inclusive' | 'no_tax',
      );
      const on = `ORD-${Date.now()}`;
      const approval = initialDocApprovalStatus(actor?.role);
      const approverId =
        approval === 'approved' && Number.isFinite(Number(actor?.id)) && Number(actor?.id) > 0
          ? Number(actor?.id)
          : null;
      const or = await client.query(
        `INSERT INTO sales_orders
          (order_number,customer_id,quotation_id,status,order_date,due_date,notes,
           gst_type,tax_type,is_interstate,subtotal,cgst,sgst,igst,total_amount,created_by,
           approval_status,approved_by,approved_at,tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
        [
          on,
          data.customer_id,
          data.quotation_id || null,
          normalizeOrderStatus(data.status),
          data.order_date || new Date().toISOString().split('T')[0],
          data.due_date || null,
          data.notes,
          data.gst_type || 'intra_state',
          data.tax_type || 'exclusive',
          data.is_interstate || false,
          subtotal,
          cgst,
          sgst,
          igst,
          total,
          data.created_by,
          approval,
          approverId,
          approverId ? new Date().toISOString() : null,
          tenantId > 0 ? tenantId : null,
        ],
      );
      for (const it of items)
        await client.query(
          'INSERT INTO sales_order_items (order_id,product_id,description,quantity,unit_price,discount,gst_rate,cgst,sgst,igst,total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
          [or.rows[0].id, it.product_id||null, it.description, it.quantity, it.unit_price, it.discount||0, it.gst_rate||0, it.cgst||0, it.sgst||0, it.igst||0, it.total]);
      return or.rows[0];
    });
  }
  async patchOrder(id: number, b: any, actor?: SalesActor) {
    const tenantId = this.requireTenantId(actor);
    const body: any = typeof b === 'string' ? { status: b } : { ...b };
    if (body.approval_status !== undefined) {
      const req = normalizeDocApprovalStatus(body.approval_status);
      if (req !== 'approved' && req !== 'rejected') {
        throw new BadRequestException('approval_status must be approved or rejected.');
      }
      await this.assertDocumentApprovalPatch('sales_orders', id, req as 'approved' | 'rejected', actor || {});
      delete body.approval_status;
    }
    const apRow = await this.db.query(
      'SELECT approval_status FROM sales_orders WHERE id=$1 AND ($2::integer = 0 OR tenant_id = $2)',
      [id, tenantId],
    );
    if (!apRow.rows[0]) return null;
    const ap0 = String(apRow.rows[0].approval_status ?? 'approved');
    if (ap0 === 'pending' && body.status !== undefined) {
      throw new BadRequestException('Order is pending approval; fulfillment status cannot be changed yet.');
    }
    if (ap0 === 'rejected' && body.status !== undefined) {
      throw new BadRequestException('This order was rejected.');
    }
    if (body?.items !== undefined && Array.isArray(body.items)) {
      return this.db.transaction(async (client) => {
        const ex = await client.query('SELECT id FROM sales_orders WHERE id=$1', [id]);
        if (!ex.rows[0]) return null;
        await client.query('DELETE FROM sales_order_items WHERE order_id=$1', [id]);
        let subtotal = 0, cgst = 0, sgst = 0, igst = 0;
        for (const it of body.items) {
          const lineTotal = Number(it.total ?? 0);
          const lineCgst = Number(it.cgst || 0);
          const lineSgst = Number(it.sgst || 0);
          const lineIgst = Number(it.igst || 0);
          subtotal += lineTotal - (lineCgst + lineSgst + lineIgst);
          cgst += lineCgst;
          sgst += lineSgst;
          igst += lineIgst;
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
        if (body.customer_id !== undefined)  { sets.push(`customer_id=$${n++}`);   vals.push(body.customer_id); }
        if (body.order_date !== undefined)   { sets.push(`order_date=$${n++}`);    vals.push(body.order_date); }
        if (body.due_date !== undefined)     { sets.push(`due_date=$${n++}`);      vals.push(body.due_date); }
        if (body.notes !== undefined)        { sets.push(`notes=$${n++}`);         vals.push(body.notes); }
        if (body.status !== undefined)       { sets.push(`status=$${n++}`);        vals.push(normalizeOrderStatus(body.status)); }
        if (body.gst_type !== undefined)     { sets.push(`gst_type=$${n++}`);      vals.push(body.gst_type); }
        if (body.tax_type !== undefined)     { sets.push(`tax_type=$${n++}`);      vals.push(body.tax_type); }
        if (body.is_interstate !== undefined){ sets.push(`is_interstate=$${n++}`); vals.push(body.is_interstate); }
        if (body.created_by !== undefined)   { sets.push(`created_by=$${n++}`);    vals.push(body.created_by); }
        vals.push(id);
        await client.query(`UPDATE sales_orders SET ${sets.join(', ')} WHERE id=$${n}`, vals);
        return this.getOrder(id, actor);
      });
    }
    const sets: string[] = [];
    const vals: any[] = [];
    let n = 1;
    if (body?.status !== undefined) {
      sets.push(`status=$${n++}`);
      vals.push(normalizeOrderStatus(body.status));
    }
    if (body?.notes !== undefined) {
      sets.push(`notes=$${n++}`);
      vals.push(body.notes);
    }
    if (body?.order_date !== undefined) {
      sets.push(`order_date=$${n++}`);
      vals.push(body.order_date);
    }
    if (body?.due_date !== undefined) {
      sets.push(`due_date=$${n++}`);
      vals.push(body.due_date);
    }
    if (body?.customer_id !== undefined) {
      sets.push(`customer_id=$${n++}`);
      vals.push(body.customer_id);
    }
    if (body?.created_by !== undefined) {
      sets.push(`created_by=$${n++}`);
      vals.push(body.created_by);
    }
    if (!sets.length) {
      return (await this.db.query('SELECT * FROM sales_orders WHERE id=$1', [id])).rows[0];
    }
    vals.push(id);
    return (await this.db.query(`UPDATE sales_orders SET ${sets.join(', ')} WHERE id=$${n} RETURNING *`, vals)).rows[0];
  }

  // ─── Invoices ─────────────────────────────────────────────
  async listInvoices(filters?: {
    customer_id?: number;
    created_by?: number;
    status?: string;
    approval_status?: string;
    from?: string;
    to?: string;
  }, actor?: SalesActor) {
    const tenantId = this.requireTenantId(actor);
    const conds: string[] = [];
    const vals: any[] = [tenantId];
    let n = 2;
    conds.push('($1::integer = 0 OR i.tenant_id = $1)');
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
    if (filters?.approval_status) {
      conds.push(`i.approval_status=$${n++}`);
      vals.push(filters.approval_status);
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
  async getInvoice(id: number, actor?: SalesActor) {
    const tenantId = this.requireTenantId(actor);
    const [inv, items, pays] = await Promise.all([
      this.db.query(
        `SELECT i.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
                c.gstin AS customer_gstin,
                c.billing_address AS customer_address,
                c.billing_address AS customer_billing_address,
                c.shipping_address AS customer_shipping_address,
                cu.name AS created_by_name
           FROM invoices i
           JOIN customers c ON c.id=i.customer_id
           LEFT JOIN users cu ON cu.id=i.created_by
           WHERE i.id=$1 AND ($2::integer = 0 OR i.tenant_id = $2)`,
        [id, tenantId],
      ),
      this.db.query(
        `SELECT ii.*, pr.name AS product_name, pr.hsn_code AS product_hsn_code
           FROM invoice_items ii LEFT JOIN products pr ON pr.id=ii.product_id WHERE ii.invoice_id=$1`,
        [id],
      ),
      this.db.query(`SELECT * FROM payments WHERE invoice_id=$1 ORDER BY payment_date`, [id]),
    ]);
    if (!inv.rows[0]) return null;
    const invoice = inv.rows[0];
    const itemsRows = items.rows;
    const taxType = String(invoice.tax_type || inferTaxTypeFromLineItems(itemsRows)) as 'exclusive' | 'inclusive' | 'no_tax';
    const gstType = String(invoice.gst_type || (Number(invoice.igst || 0) > 0 ? 'inter_state' : 'intra_state'));
    return {
      ...invoice,
      items: itemsRows,
      payments: pays.rows,
      tax_type: taxType,
      gst_type: gstType,
      is_interstate: invoice.is_interstate ?? Number(invoice.igst || 0) > 0,
    };
  }
  async createInvoice(data: any, items: any[], actor?: SalesActor) {
    const tenantId = this.requireTenantId(actor);
    if (data.order_id) {
      const o = await this.db.query(
        'SELECT approval_status FROM sales_orders WHERE id=$1 AND ($2::integer = 0 OR tenant_id = $2)',
        [data.order_id, tenantId],
      );
      if (!o.rows[0]) throw new BadRequestException('Order not found.');
      if (o.rows[0].approval_status !== 'approved') {
        throw new BadRequestException('The sales order must be approved before you can create an invoice from it.');
      }
    }
    const row = await this.db.transaction(async (client) => {
      const { subtotal, cgst, sgst, igst, total } = deriveTotalsFromLineItems(
        items,
        data.is_interstate || false,
        String(data.tax_type || 'exclusive') as 'exclusive' | 'inclusive' | 'no_tax',
      );
      const inv_no = `INV-${Date.now()}`;
      const approval = initialDocApprovalStatus(actor?.role);
      const approverId =
        approval === 'approved' && Number.isFinite(Number(actor?.id)) && Number(actor?.id) > 0
          ? Number(actor?.id)
          : null;
      const ir = await client.query(
        `INSERT INTO invoices
          (invoice_number,customer_id,order_id,invoice_date,due_date,subtotal,cgst,sgst,igst,total_amount,notes,created_by,
           approval_status,approved_by,approved_at,tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
        [
          inv_no,
          data.customer_id,
          data.order_id,
          data.invoice_date || new Date().toISOString().split('T')[0],
          data.due_date,
          subtotal,
          cgst,
          sgst,
          igst,
          total,
          data.notes,
          data.created_by,
          approval,
          approverId,
          approverId ? new Date().toISOString() : null,
          tenantId > 0 ? tenantId : null,
        ],
      );
      for (const it of items)
        await client.query('INSERT INTO invoice_items (invoice_id,product_id,description,quantity,unit_price,gst_rate,cgst,sgst,igst,total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
          [ir.rows[0].id, it.product_id, it.description, it.quantity, it.unit_price, it.gst_rate||0, it.cgst||0, it.sgst||0, it.igst||0, it.total]);
      return ir.rows[0];
    });
    await this.cache.del('dashboard:stats');
    return row;
  }
  async stats(actor?: SalesActor) {
    const tenantId = this.requireTenantId(actor);
    const res = await this.db.query(`
      SELECT
        (SELECT COUNT(*)::int        FROM customers  WHERE is_active=TRUE AND ($1::integer = 0 OR tenant_id = $1))                                    AS customers,
        (SELECT COUNT(*)::int        FROM sales_orders WHERE status NOT IN ('delivered','cancelled') AND ($1::integer = 0 OR tenant_id = $1))          AS open_orders,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status='paid' AND ($1::integer = 0 OR tenant_id = $1))                              AS revenue,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status IN ('unpaid','partial') AND ($1::integer = 0 OR tenant_id = $1))             AS receivable,
        (SELECT COUNT(*)::int        FROM invoices WHERE status IN ('unpaid','partial') AND due_date < NOW() AND ($1::integer = 0 OR tenant_id = $1)) AS overdue,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE ($1::integer = 0 OR tenant_id = $1))                                                AS total_sales,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status='paid' AND ($1::integer = 0 OR tenant_id = $1))                              AS paid_amount,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status='unpaid' AND ($1::integer = 0 OR tenant_id = $1))                            AS unpaid_amount,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status='partial' AND ($1::integer = 0 OR tenant_id = $1))                           AS partial_amount
    `, [tenantId]);
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
  async listPayments(filters?: { customer_id?: number; created_by?: number; from?: string; to?: string }, actor?: SalesActor) {
    const tenantId = this.requireTenantId(actor);
    const conds: string[] = [];
    const vals: any[] = [tenantId];
    let n = 2;
    conds.push('($1::integer = 0 OR p.tenant_id = $1)');
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
  async listReturns(filters?: { customer_id?: number; created_by?: number; from?: string; to?: string }, actor?: SalesActor) {
    const tenantId = this.requireTenantId(actor);
    const conds: string[] = [];
    const vals: any[] = [tenantId];
    let n = 2;
    conds.push('($1::integer = 0 OR r.tenant_id = $1)');
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

  async getReturn(id: number, actor?: SalesActor) {
    const tenantId = this.requireTenantId(actor);
    const [r, items, pays] = await Promise.all([
      this.db.query(
        `SELECT r.*, c.name AS customer_name FROM sale_returns r JOIN customers c ON c.id=r.customer_id WHERE r.id=$1 AND ($2::integer = 0 OR r.tenant_id = $2)`,
        [id, tenantId],
      ),
      this.db.query(
        `SELECT ri.*, pr.name AS product_name FROM sale_return_items ri LEFT JOIN products pr ON pr.id=ri.product_id WHERE ri.return_id=$1`,
        [id],
      ),
      this.db.query(`SELECT * FROM sale_return_payments WHERE return_id=$1 ORDER BY payment_date`, [id]),
    ]);
    return r.rows[0] ? { ...r.rows[0], items: items.rows, payments: pays.rows } : null;
  }

  async createReturn(data: any, items: any[], actor?: SalesActor) {
    const tenantId = this.requireTenantId(actor);
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
           exchange_rate,notes,subtotal,cgst,sgst,igst,discount_amount,round_off,total_amount,created_by,tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
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
          tenantId > 0 ? tenantId : null,
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

  async addReturnPayment(returnId: number, data: any, actor?: SalesActor) {
    const tenantId = this.requireTenantId(actor);
    return this.db.transaction(async (client) => {
      const pr = await client.query(
        'INSERT INTO sale_return_payments (return_id,amount,payment_date,method,reference,notes,created_by,tenant_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [
          returnId,
          data.amount,
          data.payment_date || new Date().toISOString().split('T')[0],
          data.method || 'bank_transfer',
          data.reference,
          data.notes,
          data.created_by,
          tenantId > 0 ? tenantId : null,
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

  async deleteReturn(id: number, actor?: SalesActor) {
    const tenantId = this.requireTenantId(actor);
    await this.db.query('DELETE FROM sale_returns WHERE id=$1 AND ($2::integer = 0 OR tenant_id = $2)', [id, tenantId]);
  }

  async deleteCustomer(id: number, actor?: SalesActor)   {
    const tenantId = this.requireTenantId(actor);
    await this.db.query('DELETE FROM customers WHERE id=$1 AND ($2::integer = 0 OR tenant_id = $2)', [id, tenantId]);
    await this.cache.delPattern('customers:*');
  }
  async deleteQuotation(id: number, actor?: SalesActor)  {
    const tenantId = this.requireTenantId(actor);
    await this.db.query('DELETE FROM quotations WHERE id=$1 AND ($2::integer = 0 OR tenant_id = $2)', [id, tenantId]);
  }
  async deleteOrder(id: number, actor?: SalesActor)      {
    const tenantId = this.requireTenantId(actor);
    await this.db.query('DELETE FROM sales_orders WHERE id=$1 AND ($2::integer = 0 OR tenant_id = $2)', [id, tenantId]);
  }
  async deleteInvoice(id: number, actor?: SalesActor) {
    const tenantId = this.requireTenantId(actor);
    await this.db.query('DELETE FROM invoices WHERE id=$1 AND ($2::integer = 0 OR tenant_id = $2)', [id, tenantId]);
    await this.cache.del('dashboard:stats');
  }

  /**
   * Partial update. If `items` is an array, line items are replaced and `total_amount` recalculated.
   * Optional fields: `status`, `notes`, `valid_until`, `customer_id`, `approval_status` (managers only).
   */
  async patchQuotation(id: number, b: any, actor?: SalesActor) {
    const tenantId = this.requireTenantId(actor);
    const body = { ...b };
    if (body.sales_executive_id === undefined && body.created_by !== undefined) {
      body.sales_executive_id = body.created_by;
    }
    if (body.created_by !== undefined) {
      delete body.created_by;
    }
    if (body.approval_status !== undefined) {
      const req = normalizeDocApprovalStatus(body.approval_status);
      if (req !== 'approved' && req !== 'rejected') {
        throw new BadRequestException('approval_status must be approved or rejected.');
      }
      await this.assertDocumentApprovalPatch('quotations', id, req as 'approved' | 'rejected', actor || {});
      if (req === 'approved') {
        void this.salesNotifications.notifyExecutiveOnQuotationApproved(id, actor);
      }
      delete body.approval_status;
    }
    const apRow = await this.db.query(
      'SELECT approval_status FROM quotations WHERE id=$1 AND ($2::integer = 0 OR tenant_id = $2)',
      [id, tenantId],
    );
    if (!apRow.rows[0]) return null;
    const ap0 = String(apRow.rows[0].approval_status ?? 'approved');
    if (ap0 === 'pending' && body.status !== undefined) {
      const st = String(body.status).toLowerCase();
      if (st === 'sent' || st === 'accepted') {
        throw new BadRequestException('Quotation is pending approval; it cannot be marked sent or accepted yet.');
      }
    }
    if (ap0 === 'rejected' && body.status !== undefined) {
      const st = String(body.status).toLowerCase();
      if (st === 'sent' || st === 'accepted') {
        throw new BadRequestException('This quotation was rejected.');
      }
    }
    if (body?.items !== undefined && Array.isArray(body.items)) {
      return this.db.transaction(async (client) => {
        const ex = await client.query('SELECT id FROM quotations WHERE id=$1', [id]);
        if (!ex.rows[0]) return null;
        await client.query('DELETE FROM quotation_items WHERE quotation_id=$1', [id]);
        let subtotal = 0, cgst = 0, sgst = 0, igst = 0;
        for (const it of body.items) {
          const lineTotal = Number(it.total ?? 0);
          const lineCgst = Number(it.cgst || 0);
          const lineSgst = Number(it.sgst || 0);
          const lineIgst = Number(it.igst || 0);
          subtotal += lineTotal - (lineCgst + lineSgst + lineIgst);
          cgst += lineCgst;
          sgst += lineSgst;
          igst += lineIgst;
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
        if (body.customer_id !== undefined) { sets.push(`customer_id=$${n++}`); vals.push(body.customer_id); }
        if (body.valid_until !== undefined)  { sets.push(`valid_until=$${n++}`); vals.push(body.valid_until); }
        if (body.notes !== undefined)        { sets.push(`notes=$${n++}`);       vals.push(body.notes); }
        if (body.status !== undefined)       { sets.push(`status=$${n++}`);      vals.push(body.status); }
        if (body.gst_type !== undefined)     { sets.push(`gst_type=$${n++}`);    vals.push(body.gst_type); }
        if (body.tax_type !== undefined)     { sets.push(`tax_type=$${n++}`);    vals.push(body.tax_type); }
        if (body.is_interstate !== undefined){ sets.push(`is_interstate=$${n++}`); vals.push(body.is_interstate); }
        if (body.customer_billing_address !== undefined) {
          sets.push(`customer_billing_address=$${n++}`);
          vals.push(body.customer_billing_address);
        }
        if (body.customer_shipping_address !== undefined) {
          sets.push(`customer_shipping_address=$${n++}`);
          vals.push(body.customer_shipping_address);
        }
        if (body.sales_executive_id !== undefined) {
          sets.push(`sales_executive_id=$${n++}`);
          vals.push(body.sales_executive_id);
        }
        vals.push(id);
        await client.query(`UPDATE quotations SET ${sets.join(', ')} WHERE id=$${n}`, vals);
      return this.getQuotation(id, actor);
      });
    }
    const sets: string[] = [];
    const vals: any[] = [];
    let n = 1;
    if (body?.status !== undefined) {
      sets.push(`status = $${n++}`);
      vals.push(body.status);
    }
    if (body?.notes !== undefined) {
      sets.push(`notes = $${n++}`);
      vals.push(body.notes);
    }
    if (body?.valid_until !== undefined) {
      sets.push(`valid_until = $${n++}`);
      vals.push(body.valid_until);
    }
    if (body?.customer_id !== undefined) {
      sets.push(`customer_id = $${n++}`);
      vals.push(body.customer_id);
    }
    if (body?.customer_billing_address !== undefined) {
      sets.push(`customer_billing_address = $${n++}`);
      vals.push(body.customer_billing_address);
    }
    if (body?.customer_shipping_address !== undefined) {
      sets.push(`customer_shipping_address = $${n++}`);
      vals.push(body.customer_shipping_address);
    }
    if (body?.sales_executive_id !== undefined) {
      sets.push(`sales_executive_id = $${n++}`);
      vals.push(body.sales_executive_id);
    }
    if (!sets.length) return this.getQuotation(id, actor);
    vals.push(id);
    await this.db.query(`UPDATE quotations SET ${sets.join(', ')} WHERE id = $${n}`, vals);
    return this.getQuotation(id, actor);
  }

  async patchInvoice(id: number, b: any, actor?: SalesActor) {
    const tenantId = this.requireTenantId(actor);
    const body = { ...b };
    if (body.approval_status !== undefined) {
      const req = normalizeDocApprovalStatus(body.approval_status);
      if (req !== 'approved' && req !== 'rejected') {
        throw new BadRequestException('approval_status must be approved or rejected.');
      }
      await this.assertDocumentApprovalPatch('invoices', id, req as 'approved' | 'rejected', actor || {});
      delete body.approval_status;
    }
    const apInv = await this.db.query(
      'SELECT approval_status FROM invoices WHERE id=$1 AND ($2::integer = 0 OR tenant_id = $2)',
      [id, tenantId],
    );
    if (!apInv.rows[0]) return null;
    const apI0 = String(apInv.rows[0].approval_status ?? 'approved');
    if (apI0 === 'pending' && body.status !== undefined) {
      throw new BadRequestException('Invoice is pending approval; payment status cannot be changed yet.');
    }
    if (apI0 === 'rejected' && body.status !== undefined) {
      throw new BadRequestException('This invoice was rejected.');
    }
    if (body?.items !== undefined && Array.isArray(body.items)) {
      const row = await this.db.transaction(async (client) => {
        const ex = await client.query('SELECT id FROM invoices WHERE id=$1', [id]);
        if (!ex.rows[0]) return null;

        await client.query('DELETE FROM invoice_items WHERE invoice_id=$1', [id]);

        let subtotal = 0;
        let cgst = 0;
        let sgst = 0;
        let igst = 0;
        const taxType = String(body.tax_type || 'exclusive') as 'exclusive' | 'inclusive' | 'no_tax';
        const interstate = Boolean(body.is_interstate);
        for (const it of body.items) {
          const qty = Number(it.quantity ?? 0);
          const unit = Number(it.unit_price ?? 0);
          const rate = Number(it.gst_rate ?? 0);
          const discount = Number(it.discount || 0);
          const base = Math.max(0, qty * unit - discount);
          let lineCgst = Number(it.cgst || 0);
          let lineSgst = Number(it.sgst || 0);
          let lineIgst = Number(it.igst || 0);
          let lineTotal = Number(it.total ?? 0);
          let lineTax = lineCgst + lineSgst + lineIgst;

          if (!lineTax) {
            if (taxType === 'inclusive') {
              lineTax = rate > 0 ? lineTotal * rate / (100 + rate) : 0;
            } else if (taxType === 'no_tax') {
              lineTax = 0;
            } else {
              lineTax = base * rate / 100;
            }
            if (interstate) {
              lineIgst = lineTax;
              lineCgst = 0;
              lineSgst = 0;
            } else {
              lineIgst = 0;
              lineCgst = lineTax / 2;
              lineSgst = lineTax / 2;
            }
            if (!lineTotal) {
              lineTotal = taxType === 'inclusive' ? base : base + lineTax;
            }
          }

          subtotal += lineTotal - (lineCgst + lineSgst + lineIgst);
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
        if (body.customer_id !== undefined) { sets.push(`customer_id=$${n++}`); vals.push(body.customer_id); }
        if (body.invoice_date !== undefined) { sets.push(`invoice_date=$${n++}`); vals.push(body.invoice_date); }
        if (body.due_date !== undefined) { sets.push(`due_date=$${n++}`); vals.push(body.due_date); }
        if (body.notes !== undefined) { sets.push(`notes=$${n++}`); vals.push(body.notes); }
        if (body.status !== undefined) { sets.push(`status=$${n++}`); vals.push(body.status); }
        if (body.created_by !== undefined) { sets.push(`created_by=$${n++}`); vals.push(body.created_by); }
        vals.push(id);
        await client.query(`UPDATE invoices SET ${sets.join(', ')} WHERE id=$${n}`, vals);
        return this.getInvoice(id, actor);
      });
      await this.cache.del('dashboard:stats');
      return row;
    }

    const sets: string[] = [];
    const vals: any[] = [];
    let n = 1;
    if (body?.status !== undefined) { sets.push(`status=$${n++}`); vals.push(body.status); }
    if (body?.notes !== undefined) { sets.push(`notes=$${n++}`); vals.push(body.notes); }
    if (body?.invoice_date !== undefined) { sets.push(`invoice_date=$${n++}`); vals.push(body.invoice_date); }
    if (body?.due_date !== undefined) { sets.push(`due_date=$${n++}`); vals.push(body.due_date); }
    if (body?.customer_id !== undefined) { sets.push(`customer_id=$${n++}`); vals.push(body.customer_id); }
    if (body?.created_by !== undefined) { sets.push(`created_by=$${n++}`); vals.push(body.created_by); }
    if (!sets.length) return this.getInvoice(id, actor);
    vals.push(id);
    await this.db.query(`UPDATE invoices SET ${sets.join(', ')} WHERE id=$${n}`, vals);
    await this.cache.del('dashboard:stats');
    return this.getInvoice(id, actor);
  }

  async addPayment(invoiceId: number, data: any, actor?: SalesActor) {
    const tenantId = this.requireTenantId(actor);
    const invAp = await this.db.query(
      'SELECT approval_status FROM invoices WHERE id=$1 AND ($2::integer = 0 OR tenant_id = $2)',
      [invoiceId, tenantId],
    );
    if (!invAp.rows[0]) throw new NotFoundException();
    const ap = String(invAp.rows[0].approval_status ?? 'approved');
    if (ap !== 'approved') {
      throw new ForbiddenException('Payments can only be recorded after the invoice is approved.');
    }
    const row = await this.db.transaction(async (client) => {
      const pr = await client.query(
        'INSERT INTO payments (invoice_id,amount,payment_date,method,reference,notes,created_by,tenant_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [invoiceId, data.amount, data.payment_date||new Date().toISOString().split('T')[0], data.method||'bank_transfer', data.reference, data.notes, data.created_by, tenantId > 0 ? tenantId : null],
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
