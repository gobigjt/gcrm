'use strict';

/**
 * Server-side copy of the frontend print HTML (`invoicePdf.js` buildSalesDocumentHtml).
 * Logo URLs: set API_PUBLIC_URL (e.g. https://api.example.com/api) so /uploads/... resolves for Puppeteer.
 * (Nest serves files at both /uploads/... and /api/uploads/...)
 */

const asMoney = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function topAddressTwoLines(address) {
  const raw = String(address || '').trim();
  if (!raw) return [''];
  const parts = raw
    .split(/\r?\n|,/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return [''];
  if (parts.length === 1) return [parts[0]];
  const first = parts.slice(0, Math.ceil(parts.length / 2)).join(', ');
  const second = parts.slice(Math.ceil(parts.length / 2)).join(', ');
  return [first, second].filter(Boolean);
}

function safeFooterValue(value) {
  const t = String(value ?? '').trim();
  if (!t) return '';
  if (/^(undefined|null|nan)$/i.test(t)) return '';
  return t;
}

function buildInvoiceFooterContent(company: Record<string, unknown> = {}) {
  return safeFooterValue(company.invoice_footer_content);
}

function invoiceFooterHtml(company = {}) {
  const lines = buildInvoiceFooterContent(company)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return '';
  return lines.map((line) => `<div>${escapeHtml(line)}</div>`).join('');
}

/** DD-MM-YYYY (matches common Indian invoice PDFs) */
function fmtInvoiceDate(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt).slice(0, 10);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function invoiceBalanceDue(doc) {
  const paid = (doc.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
  return Math.max(0, Number(doc.total_amount || 0) - paid);
}

/** Absolute URL for static paths (e.g. /uploads/...) when rendering HTML for Puppeteer. */
function resolvePublicUrl(pathOrUrl: string) {
  if (!pathOrUrl) return '';
  let s = String(pathOrUrl).trim();
  const bucketEndpoint = String(process.env.RAILWAY_BUCKET_ENDPOINT || '').trim().replace(/\/$/, '');
  const bucketName = String(process.env.RAILWAY_BUCKET_NAME || '').trim();
  if (
    bucketEndpoint &&
    bucketName &&
    s.toLowerCase().startsWith(`${bucketEndpoint.toLowerCase()}/${bucketName.toLowerCase()}/`)
  ) {
    const key = s.slice(`${bucketEndpoint}/${bucketName}/`.length);
    s = `/uploads/bucket/${key}`;
  }
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      if (u.hostname.toLowerCase().includes('storageapi.dev')) {
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts.length >= 2) {
          s = `/uploads/bucket/${parts.slice(1).join('/')}`;
        }
      }
    } catch {
      /* keep as-is */
    }
  }
  if (/^https?:\/\//i.test(s)) return s;
  const p = s.startsWith('/') ? s : `/${s}`;

  if (p.startsWith('/uploads/')) {
    const apiBase = String(process.env.API_PUBLIC_URL || '').trim().replace(/\/$/, '');
    if (apiBase && /^https?:\/\//i.test(apiBase)) {
      return `${apiBase}${p}`;
    }
    const port = String(process.env.PORT || '4000').trim();
    return `http://127.0.0.1:${port}/api${p}`;
  }

  const web = String(process.env.WEB_APP_ORIGIN || process.env.PUBLIC_WEB_ORIGIN || '').trim().replace(/\/$/, '');
  if (web && /^https?:\/\//i.test(web)) {
    return `${web}${p}`;
  }
  const port = String(process.env.PORT || '4000').trim();
  return `http://127.0.0.1:${port}${p}`;
}

/** Bank block for invoice: structured fields + optional free-text lines. */
function formatBankDetailsBlock(company) {
  const accountName = (company.company_name || '').trim();
  const lines = [];
  if (accountName) lines.push(`Account Name: ${accountName}`);
  if (company.bank_name?.trim()) lines.push(`Bank Name: ${company.bank_name.trim()}`);
  if (company.bank_account_number?.trim()) lines.push(`A/C No: ${company.bank_account_number.trim()}`);
  if (company.bank_ifsc?.trim()) lines.push(`IFSC Code: ${company.bank_ifsc.trim()}`);
  if (company.bank_branch?.trim()) lines.push(`Branch: ${company.bank_branch.trim()}`);
  const extra = (company.invoice_bank_details || '').trim();
  if (extra) lines.push(extra);
  const text = lines.join('\n').trim();
  return text || 'Configure bank details in Settings -> Company';
}

function stripBankDetailsFromTerms(text) {
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

function isInterstate(doc) {
  return Number(doc.igst || 0) > 0;
}

function lineTaxAmount(it, doc) {
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
  const taxType = String(doc.tax_type || 'exclusive');

  if (taxType === 'no_tax') {
    return 0;
  }
  if (taxType === 'inclusive') {
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

function lineTaxableAmount(it, doc) {
  const total = Number(it.total ?? 0);
  const tax = lineTaxAmount(it, doc);
  if (Number.isFinite(total) && Number.isFinite(tax)) {
    return Math.max(0, total - tax);
  }
  const qty = Number(it.quantity ?? 0);
  const unitPrice = Number(it.unit_price ?? 0);
  const discount = Number(it.discount || 0);
  return Math.max(0, qty * unitPrice - discount);
}

function lineGstAmount(it, doc) {
  return lineTaxAmount(it, doc);
}

const LINE_AMOUNT_EPS = 1e-4;

/**
 * Human-facing product line title (matches table "Item" column intent).
 * Empty when missing, whitespace-only, or common placeholders (so we don't print a lone "—" row).
 */
function lineItemProductLabel(it: Record<string, unknown>): string {
  const raw = String(
    it.description ?? it.product_name ?? it.name ?? it.item_name ?? '',
  ).trim();
  if (!raw) return '';
  if (/^[—–\-−\s]+$/u.test(raw)) return '';
  if (/^(n\/?a|nil|none|\.{1,3})$/i.test(raw)) return '';
  return raw;
}

/**
 * Hide lines with no real product text that don't contribute to the document (stray qty/rate with ₹0 total).
 */
function isEmptySalesLineItem(it: Record<string, unknown>) {
  if (lineItemProductLabel(it)) return false;

  const total = Number(it.total ?? 0);
  const qty = Number(it.quantity ?? 0);
  const unit = Number(it.unit_price ?? 0);
  const discount = Number(it.discount || 0);

  if (Math.abs(total) > LINE_AMOUNT_EPS) return false;

  const base = qty * unit - discount;
  if (Math.abs(base) > LINE_AMOUNT_EPS) return false;

  return true;
}

/** @param {'invoice'|'quotation'|'order'} kind */
function getSalesDocumentNumber(doc, kind) {
  if (kind === 'quotation') return doc.quotation_number || `QT-${doc.id}`;
  if (kind === 'order') return doc.order_number || `SO-${doc.id}`;
  return doc.invoice_number || `INV-${doc.id}`;
}

/** @param {'invoice'|'quotation'|'order'} kind */
function isInterstateForDoc(doc, kind) {
  if (kind !== 'invoice') return false;
  return isInterstate(doc);
}

/** @param {'invoice'|'quotation'|'order'} kind */
function totalsForSalesDocument(doc, kind) {
  if (kind === 'invoice') {
    const storedSubtotal = doc.subtotal != null ? Number(doc.subtotal) : null;
    const storedCgst = Number(doc.cgst || 0);
    const storedSgst = Number(doc.sgst || 0);
    const storedIgst = Number(doc.igst || 0);
    const storedTotal = Number(doc.total_amount || 0);
    const derived = (doc.items || []).reduce((acc, it) => {
      acc.subtotal += lineTaxableAmount(it, doc);
      const tax = lineTaxAmount(it, doc);
      acc.cgst += isInterstate(doc) ? 0 : tax / 2;
      acc.sgst += isInterstate(doc) ? 0 : tax / 2;
      acc.igst += isInterstate(doc) ? tax : 0;
      acc.total += Number(it.total || 0);
      return acc;
    }, { subtotal: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });
    const hasStoredTax = storedCgst + storedSgst + storedIgst > 0;
    return {
      subtotal: storedSubtotal != null ? storedSubtotal : derived.subtotal,
      cgst: hasStoredTax ? storedCgst : derived.cgst,
      sgst: hasStoredTax ? storedSgst : derived.sgst,
      igst: hasStoredTax ? storedIgst : derived.igst,
      total: storedTotal > 0 ? storedTotal : derived.total,
      balance: invoiceBalanceDue(doc),
    };
  }
  let subtotal = 0;
  let gst = 0;
  for (const it of doc.items || []) {
    subtotal += lineTaxableAmount(it, doc);
    gst += lineTaxAmount(it, doc);
  }
  return {
    subtotal,
    cgst: gst / 2,
    sgst: gst / 2,
    igst: 0,
    total: Number(doc.total_amount || 0),
    balance: null,
  };
}

function documentNoLabel(kind) {
  if (kind === 'quotation') return 'Quotation No';
  if (kind === 'order') return 'Order No';
  return 'Invoice No';
}

function documentDateLabel(kind) {
  if (kind === 'quotation') return 'Quotation Date';
  if (kind === 'order') return 'Order Date';
  return 'Invoice Date';
}

function amountInWordsINR(n) {
  const num = Math.round(Number(n || 0));
  if (num === 0) return 'INR Zero only.';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const chunk = (x) => {
    let out = '';
    if (x >= 100) {
      out += `${ones[Math.floor(x / 100)]} Hundred `;
      x %= 100;
    }
    if (x >= 20) {
      out += `${tens[Math.floor(x / 10)]} `;
      x %= 10;
    }
    if (x > 0) out += `${ones[x]} `;
    return out.trim();
  };
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const hundred = num % 1000;
  const parts = [];
  if (crore) parts.push(`${chunk(crore)} Crore`);
  if (lakh) parts.push(`${chunk(lakh)} Lakh`);
  if (thousand) parts.push(`${chunk(thousand)} Thousand`);
  if (hundred) parts.push(chunk(hundred));
  return `INR ${parts.join(' ').replace(/\s+/g, ' ').trim()} only.`;
}

function hsnSummaryRows(doc, kind) {
  const interstate = isInterstateForDoc(doc, kind);
  const byHsn = new Map();
  for (const it of doc.items || []) {
    const hsn = String(it.product_hsn_code || it.hsn_code || '—');
    const taxable = lineTaxableAmount(it, doc);
    const gstAmt = lineGstAmount(it, doc);
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

/**
 * @param {object} doc Invoice / quotation / order with items (and payments for invoices)
 * @param {object} company Company settings row
 * @param {string|null} [logoDataUrl] Inline data URL for logo (print loads instantly; avoids racing print())
 * @param {'invoice'|'quotation'|'order'} [kind]
 * @param {object} [opts]
 * @param {boolean} [opts.includeSheetFooter] Default true (print). Set false when PDF footers are added separately.
 * @param {boolean} [opts.rasterLayout] Narrow fixed-width body for html2canvas (matches A4-ish print width).
 */
function buildSalesDocumentHtml(
  doc: any,
  company: Record<string, unknown>,
  logoDataUrl: string | null = null,
  kind: 'invoice' | 'quotation' | 'order' = 'invoice',
  opts: { includeSheetFooter?: boolean; rasterLayout?: boolean } = {},
) {
  const includeSheetFooter = opts.includeSheetFooter !== false;
  const rasterLayout = Boolean(opts.rasterLayout);
  const docNo = getSalesDocumentNumber(doc, kind);
  const visibleItems = (doc.items || []).filter((it) => !isEmptySalesLineItem(it));
  const docForPrint = { ...doc, items: visibleItems };
  const t = totalsForSalesDocument(docForPrint, kind);
  const interstate = isInterstateForDoc(doc, kind);
  const title = kind === 'quotation' ? 'Quotation' : kind === 'order' ? 'Sales Order' : 'Tax Invoice';

  const preferredLogo = kind === 'invoice' || kind === 'quotation' || kind === 'order'
    ? (company.invoice_logo_url || company.logo_url || '')
    : (company.logo_url || '');
  const rawLogo = String(preferredLogo || '').trim();
  const useLogo = Boolean(rawLogo && !/^javascript:/i.test(rawLogo));
  const logoSrc = useLogo && logoDataUrl && String(logoDataUrl).startsWith('data:')
    ? logoDataUrl
    : useLogo ? resolvePublicUrl(rawLogo) : '';

  // ── HSN / tax summary rows (used later in itemRowsHtml / taxItemRowsHtml) ──
  const taxSummaryRows = hsnSummaryRows(docForPrint, kind);
  const taxColCount    = interstate ? 3 : 4;

  // ── Meta fields ───────────────────────────────────────────────
  const docDate   = fmtInvoiceDate(doc.invoice_date || doc.order_date || doc.created_at);
  const dueOrValid = doc.due_date ? fmtInvoiceDate(doc.due_date)
    : doc.valid_until ? fmtInvoiceDate(doc.valid_until) : null;

  const salesExecutiveName = escapeHtml(
    doc.sales_executive_name
    || doc.sales_executive
    || doc.sales_person_name
    || doc.created_by_name
    || '—'
  );
  const createdByName = escapeHtml(doc.creator_name || doc.created_by_name || doc.created_by || '—');
  const bankDetails = formatBankDetailsBlock(company);
  const billingAddress = (doc.customer_billing_address || doc.customer_address || '').trim();
  const deliveryAddress = (doc.customer_shipping_address || billingAddress).trim();

  const metaLeft = [
    [`${documentNoLabel(kind)}`, escapeHtml(docNo)],
    [documentDateLabel(kind), docDate],
    ...(dueOrValid ? [[kind === 'quotation' ? 'Valid Until' : 'Due Date', dueOrValid]] : []),
  ];
  const metaRight = [
    ...(doc.state_of_supply ? [['Place of Supply', escapeHtml(doc.state_of_supply)]] : []),
    ...(doc.reference_no    ? [['Reference No',    escapeHtml(doc.reference_no)]]    : []),
    ['Sales Executive', salesExecutiveName],
    ['Created By', createdByName],
  ];
  // metaLeft and metaRight are rendered directly as separate column tables in the template

  // ── Totals ────────────────────────────────────────────────────
  const totalTax = (t.cgst || 0) + (t.sgst || 0) + (t.igst || 0);
  const subTotal  = t.subtotal != null ? t.subtotal : t.total - totalTax;
  const terms = stripBankDetailsFromTerms([doc.notes || '', company.payment_terms || ''].filter(Boolean).join('\n'));

  // shared border shorthand helpers (inline only — no global CSS collapse conflicts)
  const SB = 'border:1px solid #cfd5dd';   // solid all sides
  const BR = 'border-right:1px solid #cfd5dd';
  const BT = 'border-top:1px solid #cfd5dd';
  const BD = 'border-bottom:1px solid #cfd5dd';

  // items rows — each cell gets right border except last column
  const itemRowsHtml = visibleItems.map((it, idx) => {
    const gstRate = Number(it.gst_rate || 0);
    return `
    <tr>
      <td style="padding:5px 4px 10px;text-align:center;vertical-align:middle;${BR};${BT};width:28px">${idx + 1}</td>
      <td style="padding:5px 8px 10px;vertical-align:middle;${BR};${BT}"><strong>${escapeHtml(lineItemProductLabel(it) || String(it.description ?? it.product_name ?? '').trim() || '—')}</strong></td>
      <td style="padding:5px 4px 10px;text-align:center;vertical-align:middle;${BR};${BT};width:72px">${escapeHtml(it.product_hsn_code || it.hsn_code || '—')}</td>
      <td style="padding:5px 4px 10px;text-align:center;vertical-align:middle;${BR};${BT};width:55px">${Number(it.quantity ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Nos</td>
      <td style="padding:5px 8px 10px;text-align:right;vertical-align:middle;${BR};${BT};width:85px;white-space:nowrap">&#8377; ${asMoney(it.unit_price)}</td>
      <td style="padding:5px 4px 10px;text-align:center;vertical-align:middle;${BR};${BT};width:65px">${gstRate > 0 ? `${gstRate.toLocaleString('en-IN', { maximumFractionDigits: 2 })}%` : '—'}</td>
      <td style="padding:5px 8px 10px;text-align:right;vertical-align:middle;${BT};width:90px;white-space:nowrap">&#8377; ${asMoney(it.total)}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="7" style="padding:10px;text-align:center;color:#888;${BT}">No line items</td></tr>`;

  // tax rows
  const taxItemRowsHtml = taxSummaryRows.map((r) => interstate
    ? `<tr>
        <td style="padding:5px 8px 10px;vertical-align:middle;${BR};${BT}">${escapeHtml(r.hsn)}</td>
        <td style="padding:5px 8px 10px;text-align:right;vertical-align:middle;${BR};${BT};white-space:nowrap">&#8377; ${asMoney(r.taxable)}</td>
        <td style="padding:5px 8px 10px;text-align:right;vertical-align:middle;${BT};white-space:nowrap">(${r.rate}%) &#8377; ${asMoney(r.igst)}</td>
       </tr>`
    : `<tr>
        <td style="padding:5px 8px 10px;vertical-align:middle;${BR};${BT}">${escapeHtml(r.hsn)}</td>
        <td style="padding:5px 8px 10px;text-align:right;vertical-align:middle;${BR};${BT};white-space:nowrap">&#8377; ${asMoney(r.taxable)}</td>
        <td style="padding:5px 8px 10px;text-align:right;vertical-align:middle;${BR};${BT};white-space:nowrap">(${r.rate / 2}%) &#8377; ${asMoney(r.cgst)}</td>
        <td style="padding:5px 8px 10px;text-align:right;vertical-align:middle;${BT};white-space:nowrap">(${r.rate / 2}%) &#8377; ${asMoney(r.sgst)}</td>
       </tr>`
  ).join('') || `<tr><td colspan="${taxColCount}" style="padding:6px;text-align:center;color:#888;${BT}">—</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(docNo)} - ${escapeHtml(title)}</title>
  <style>
    @page { size:A4; margin:8mm; }
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:Arial,Helvetica,sans-serif; font-size:11px; color:#111; background:#fff; }
    ${rasterLayout ? 'body{max-width:794px;margin:0 auto;padding:6px 10px 32px;}' : ''}
    strong { font-weight:700; }
    .wrap { border:1px solid #cfd5dd; width:100%; }
    .sec  { border-top:1px solid #cfd5dd; width:100%; }
    .sheet-footer { margin-top:5px; left: 12mm; right: 12mm; padding: 0 12px; text-align:center; font-size:9px; color:#666; white-space:normal; line-height:1.3; width:100%; }
    .sheet-footer div { display:block; }
    @media print {
      body { padding-bottom:14mm; }
      .sheet-footer {
        position: fixed;
        left: 8mm;
        right: 8mm;
        bottom: 6mm;
        margin-top: 0;
        padding:0 12px;
      }
    }
  </style>
</head>
<body>
<div class="wrap">

  <!-- ① HEADER: logo left · company right -->
  <table width="100%" style="border-collapse:collapse">
    <tr>
      <td style="padding:10px 12px;vertical-align:middle;width:68%">
        ${logoSrc ? `<img src="${escapeHtml(logoSrc)}" alt="" style="max-width:100px;max-height:80px;object-fit:contain;display:block"/>` : ''}
      </td>
      <td style="padding:8px 10px;vertical-align:top;text-align:right;width:32%">
        <div style="font-size:18px;font-weight:700;letter-spacing:0.02em;line-height:1.2">${escapeHtml(company.company_name || 'Company')}</div>
        <div style="font-size:10px;color:#333;line-height:1.5;margin-top:3px">
          ${topAddressTwoLines(company.address).map((ln) => escapeHtml(ln)).join('<br/>')}
          ${company.gstin ? `<br/>GSTIN: ${escapeHtml(company.gstin)}` : ''}
        </div>
      </td>
    </tr>
  </table>

  <!-- ① b DOCUMENT TITLE -->
  <div class="sec" style="text-align:center;padding:6px 12px 12px;font-size:14px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase">
    ${kind === 'quotation' ? 'Quotation' : kind === 'order' ? 'Sales Order' : totalTax > 0 ? 'Tax Invoice' : 'Invoice'}
  </div>

  <!-- ② META INFO -->
  <table width="100%" style="border-collapse:collapse" class="sec">
    <tr>
      <td style="padding:8px 12px;width:50%;vertical-align:top">
        <table width="100%" style="border-collapse:collapse">
          <tbody>
            ${metaLeft.map(([k,v]) => `<tr>
              <td style="padding:2px 0;white-space:nowrap;width:120px"><strong>${k}</strong></td>
              <td style="padding:2px 0">: ${v}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </td>
      <td style="padding:8px 12px;width:50%;vertical-align:top;border-left:1px solid #cfd5dd">
        <table width="100%" style="border-collapse:collapse">
          <tbody>
            ${metaRight.map(([k,v]) => `<tr>
              <td style="padding:2px 0;white-space:nowrap;width:110px"><strong>${k}</strong></td>
              <td style="padding:2px 0">: ${v}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </td>
    </tr>
  </table>

  <!-- ③ BILLING / DELIVERY ADDRESSES -->
  <table width="100%" style="border-collapse:collapse" class="sec">
    <tr>
      <td style="width:50%;vertical-align:top;padding:0;border-right:1px solid #cfd5dd; ">
        <div style="background:#eaeaea;font-weight:700;padding:4px 4px 10px 4px;border-bottom:1px solid #ccc;font-size:11px">Billing Address</div>
        <div style="padding:7px 10px 18px;font-size:11px;line-height:1.6">
          <strong>${escapeHtml(doc.customer_name || '—')}</strong><br/>
          ${escapeHtml(billingAddress).replace(/\n/g, '<br/>')}
          ${doc.customer_gstin ? `<br/>GSTIN : ${escapeHtml(doc.customer_gstin)}` : ''}
        </div>
      </td>
      <td style="width:50%;vertical-align:top;padding:0;">
        <div style="background:#eaeaea;font-weight:700;padding:4px 4px 10px 4px;border-bottom:1px solid #ccc;font-size:11px">Delivery Address</div>
        <div style="padding:7px 10px 18px;font-size:11px;line-height:1.6">
          <strong>${escapeHtml(doc.customer_name || '—')}</strong><br/>
          ${escapeHtml(deliveryAddress).replace(/\n/g, '<br/>')}
          ${doc.customer_gstin ? `<br/>GSTIN : ${escapeHtml(doc.customer_gstin)}` : ''}
        </div>
      </td>
    </tr>
  </table>

  <!-- ④ LINE ITEMS -->
  <table width="100%" style="border-collapse:collapse;font-size:10px; min-height: 100px;" class="sec">
    <thead>
      <tr style="background:#eaeaea">
        <th style="padding:5px 4px 10px;text-align:center;vertical-align:middle;${BR};width:28px">#</th>
        <th style="padding:5px 8px 10px;text-align:left;vertical-align:middle;${BR}">Item&amp;Description</th>
        <th style="padding:5px 4px 10px;text-align:center;vertical-align:middle;${BR};width:72px">HSN Code</th>
        <th style="padding:5px 4px 10px;text-align:center;vertical-align:middle;${BR};width:55px">Qty</th>
        <th style="padding:5px 8px 10px;text-align:right;vertical-align:middle;${BR};width:85px">Rate</th>
        <th style="padding:5px 8px 10px;text-align:center;vertical-align:middle;${BR};width:65px">GST %</th>
        <th style="padding:5px 8px 10px;text-align:right;vertical-align:middle;width:90px">Amount</th>
      </tr>
    </thead>
    <tbody >${itemRowsHtml}</tbody>
  </table>

  <!-- ⑤ HSN / TAX SUMMARY -->
  <table width="100%" style="border-collapse:collapse;font-size:10px margin-top: 10px;" class="sec">
    <thead>
      <tr style="background:#eaeaea">
        ${interstate
          ? `<th style="padding:5px 8px 10px;text-align:left;vertical-align:middle;${BR};width:100px">HSN/SAC</th>
             <th style="padding:5px 8px 10px;text-align:right;vertical-align:middle;${BR}">Taxable Amount</th>
             <th style="padding:5px 8px 10px;text-align:right;vertical-align:middle">IGST</th>`
          : `<th style="padding:5px 8px 10px;text-align:left;vertical-align:middle;${BR};width:100px">HSN/SAC</th>
             <th style="padding:5px 8px 10px;text-align:right;vertical-align:middle;${BR}">Taxable Amount</th>
             <th style="padding:5px 8px 10px;text-align:right;vertical-align:middle;${BR};width:130px">CGST</th>
             <th style="padding:5px 8px 10px;text-align:right;vertical-align:middle;width:130px">SGST</th>`}
      </tr>
    </thead>
    <tbody>${taxItemRowsHtml}</tbody>
  </table>

  <!-- ⑥ TOTAL IN WORDS + TOTALS -->
  <table width="100%" style="border-collapse:collapse" class="sec">
    <tr>
      <td style="padding:8px 12px;vertical-align:top;border-right:1px solid #cfd5dd">
        <div style="font-weight:700;margin-bottom:5px;font-size:11px">Total in Words</div>
        <div style="font-size:11px"><strong>${escapeHtml(amountInWordsINR(t.total))}</strong></div>
      </td>
      <td style="vertical-align:top;padding:0;width:260px">
        <table width="100%" style="border-collapse:collapse;font-size:11px">
          <tr>
            <td style="padding:5px 12px 10px;${BD}">Sub Total</td>
            <td style="padding:5px 12px 10px;text-align:right;${BD};white-space:nowrap">&#8377; ${asMoney(subTotal)}</td>
          </tr>
          ${t.cgst > 0 ? `<tr>
            <td style="padding:5px 12px;${BD}">CGST</td>
            <td style="padding:5px 12px;text-align:right;${BD};white-space:nowrap">&#8377; ${asMoney(t.cgst)}</td>
          </tr>` : ''}
          ${t.sgst > 0 ? `<tr>
            <td style="padding:5px 12px;${BD}">SGST</td>
            <td style="padding:5px 12px;text-align:right;${BD};white-space:nowrap">&#8377; ${asMoney(t.sgst)}</td>
          </tr>` : ''}
          ${t.igst > 0 ? `<tr>
            <td style="padding:5px 12px;${BD}">IGST</td>
            <td style="padding:5px 12px;text-align:right;${BD};white-space:nowrap">&#8377; ${asMoney(t.igst)}</td>
          </tr>` : ''}
          ${totalTax > 0 ? `<tr>
            <td style="padding:5px 12px 10px;${BD}">Total Tax Charges</td>
            <td style="padding:5px 12px 10px;text-align:right;${BD};white-space:nowrap">&#8377; ${asMoney(totalTax)}</td>
          </tr>` : ''}
          <tr>
            <td style="padding:6px 12px 12px;font-weight:700;border-top:2px solid #cfd5dd"><strong>Total</strong></td>
            <td style="padding:6px 12px 12px;text-align:right;font-weight:700;border-top:2px solid #cfd5dd;white-space:nowrap"><strong>&#8377; ${asMoney(t.total)}</strong></td>
          </tr>
          ${t.balance != null ? `<tr>
            <td style="padding:5px 12px 10px;color:#c00;border-top:1px solid #cfd5dd">Balance Due</td>
            <td style="padding:5px 12px 10px;text-align:right;color:#c00;border-top:1px solid #cfd5dd;white-space:nowrap">&#8377; ${asMoney(t.balance)}</td>
          </tr>` : ''}
        </table>
      </td>
    </tr>
  </table>

  <!-- ⑦ TERMS & CONDITIONS -->
  ${(terms || bankDetails) ? `
  <table width="100%" style="border-collapse:collapse" class="sec">
    <tr>
      <td style="width:50%;vertical-align:top;padding:8px 12px 12px;border-right:1px solid #cfd5dd;font-size:10px;line-height:1.6">
        <strong>Terms And Conditions:</strong><br/>
        <span style="white-space:pre-wrap">${escapeHtml(terms || '—')}</span>
      </td>
      <td style="width:50%;vertical-align:top;padding:8px 12px 12px;font-size:10px;line-height:1.6">
        <strong>Bank Details:</strong><br/>
        <span style="white-space:pre-wrap">${escapeHtml(bankDetails || '—')}</span>
      </td>
    </tr>
  </table>` : ''}

  <div class="sec" style="padding:8px 12px 12px;font-size:10px;line-height:1.8">
    <div>Thanks for your business</div>
    <div style="margin-top:25px"><strong>For ${escapeHtml(company.company_name || 'Company')},</strong></div>
  </div>

</div>
${includeSheetFooter ? `<div class="sheet-footer">${invoiceFooterHtml(company)}</div>` : ''}
</body>
</html>`;
}
function buildTaxInvoiceHtml(doc, company, logoDataUrl = null, opts = {}) {
  return buildSalesDocumentHtml(doc, company, logoDataUrl, 'invoice', opts);
}

export {
  escapeHtml,
  fmtInvoiceDate,
  invoiceBalanceDue,
  getSalesDocumentNumber,
  formatBankDetailsBlock,
  buildSalesDocumentHtml,
  buildTaxInvoiceHtml,
  isEmptySalesLineItem,
};
