import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../../api/client';

const asMoney = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function escapeHtml(s) {
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

function singleLineFooterText(text) {
  return String(text || '')
    .replace(/\r?\n/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/,\s*,/g, ', ')
    .trim();
}

/** DD-MM-YYYY (matches common Indian invoice PDFs) */
export function fmtInvoiceDate(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt).slice(0, 10);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function invoiceBalanceDue(doc) {
  const paid = (doc.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
  return Math.max(0, Number(doc.total_amount || 0) - paid);
}

export async function fetchInvoiceCompanySettings() {
  try {
    const r = await api.get('/settings/company');
    return r.data || {};
  } catch {
    return {};
  }
}

/** Absolute URL for static paths (e.g. /uploads/...) in browser. */
export function resolvePublicUrl(pathOrUrl) {
  if (!pathOrUrl) return '';
  const s = String(pathOrUrl).trim();
  if (/^https?:\/\//i.test(s)) return s;
  const p = s.startsWith('/') ? s : `/${s}`;
  const apiBase = String(import.meta.env.VITE_API_BASE_URL || '').trim();
  if (apiBase) {
    const apiOrigin = apiBase.replace(/\/api\/?$/i, '').replace(/\/$/, '');
    if (/^https?:\/\//i.test(apiOrigin)) {
      return `${apiOrigin}${p}`;
    }
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${p}`;
  }
  return p;
}

/** Bank block for invoice: structured fields + optional free-text lines. */
export function formatBankDetailsBlock(company) {
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

async function fetchImageAsDataUrlForPdf(logoUrl) {
  if (!logoUrl || /\.svg$/i.test(String(logoUrl))) return null;
  const url = resolvePublicUrl(logoUrl);
  try {
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) return null;
    const blob = await r.blob();
    if (blob.type === 'image/svg+xml') return null;
    return await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Wait until print-window images have loaded (or timeout). Avoids printing before the logo img finishes loading. */
function waitForPrintImages(win) {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      setTimeout(resolve, 150);
    };
    const imgs = Array.from(win.document.images || []);
    let pending = 0;
    imgs.forEach((img) => {
      if (img.complete) return;
      pending += 1;
      const tick = () => {
        pending -= 1;
        if (pending <= 0) done();
      };
      img.addEventListener('load', tick, { once: true });
      img.addEventListener('error', tick, { once: true });
    });
    if (pending === 0) done();
    else setTimeout(done, 8000);
  });
}

function pdfFormatFromDataUrl(dataUrl) {
  if (String(dataUrl).includes('image/jpeg')) return 'JPEG';
  if (String(dataUrl).includes('image/png')) return 'PNG';
  if (String(dataUrl).includes('image/webp')) return 'WEBP';
  if (String(dataUrl).includes('image/gif')) return 'GIF';
  return 'PNG';
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

/** @param {'invoice'|'quotation'|'order'} kind */
export function getSalesDocumentNumber(doc, kind) {
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
  const taxType = String(doc.tax_type || 'exclusive');
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

/** Billing / delivery box body (same content as print HTML). */
function customerAddressBlockText(doc) {
  const name = doc.customer_name || '—';
  const addr = (doc.customer_address || '').trim();
  const gst = doc.customer_gstin ? `GSTIN: ${doc.customer_gstin}` : '';
  return [name, addr, gst].filter(Boolean).join('\n');
}

function pdfPageHeight(pdf) {
  const ps = pdf.internal.pageSize;
  if (typeof ps.getHeight === 'function') return ps.getHeight();
  return ps.height || 842;
}

function addPdfPageFooters(pdf, pageW, footerText = '') {
  const n = pdf.getNumberOfPages();
  const h = pdfPageHeight(pdf);
  for (let i = 1; i <= n; i += 1) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(110, 110, 110);
    const pageLabel = `-- ${i} of ${n} --`;
    const footerLines = footerText ? `${footerText}\n${pageLabel}` : pageLabel;
    pdf.text(footerLines, pageW / 2, h - 26, { align: 'center' });
  }
  pdf.setPage(n);
  pdf.setTextColor(0, 0, 0);
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
export function buildSalesDocumentHtml(doc, company, logoDataUrl = null, kind = 'invoice', opts = {}) {
  const includeSheetFooter = opts.includeSheetFooter !== false;
  const rasterLayout = Boolean(opts.rasterLayout);
  const docNo = getSalesDocumentNumber(doc, kind);
  const t = totalsForSalesDocument(doc, kind);
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
  const taxSummaryRows = hsnSummaryRows(doc, kind);
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
  const createdByName = escapeHtml(doc.created_by_name || doc.created_by || '—');
  const bankDetails = formatBankDetailsBlock(company);

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
  const SB = 'border:1px solid #444';   // solid all sides
  const BR = 'border-right:1px solid #444';
  const BT = 'border-top:1px solid #444';
  const BD = 'border-bottom:1px solid #ddd';

  // items rows — each cell gets right border except last column
  const itemRowsHtml = (doc.items || []).map((it, idx) => {
    const gstRate = Number(it.gst_rate || 0);
    return `
    <tr>
      <td style="padding:5px 4px 10px;text-align:center;vertical-align:middle;${BR};${BT};width:28px">${idx + 1}</td>
      <td style="padding:5px 8px 10px;vertical-align:middle;${BR};${BT}"><strong>${escapeHtml(it.description || it.product_name || '—')}</strong></td>
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
    @page { size:A4; margin:12mm; }
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:Arial,Helvetica,sans-serif; font-size:11px; color:#111; background:#fff; }
    ${rasterLayout ? 'body{max-width:794px;margin:0 auto;padding:6px 10px 32px;}' : ''}
    strong { font-weight:700; }
    .wrap { border:1px solid #444; width:100%; }
    .sec  { border-top:1px solid #444; width:100%; }
    .sheet-footer { margin-top:5px; left: 20mm; right: 20mm; padding: 0 20px; text-align:center; font-size:9px; color:#666; white-space:normal; line-height:1.3; width:100%; }
    .sheet-footer div { display:block; }
    @media print {
      body { padding-bottom:20mm; }
      .sheet-footer {
        position: fixed;
        left: 15mm;
        right: 15mm;
        bottom: 8mm;
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
      <td style="padding:10px 12px;vertical-align:middle;width:110px">
        ${logoSrc ? `<img src="${escapeHtml(logoSrc)}" alt="" style="max-width:100px;max-height:80px;object-fit:contain;display:block"/>` : ''}
      </td>
      <td style="padding:8px 10px;vertical-align:top;text-align:right;border-left:1px solid #444">
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
      <td style="padding:8px 12px;width:50%;vertical-align:top;border-left:1px solid #444">
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
      <td style="width:50%;vertical-align:top;padding:0;border-right:1px solid #444; ">
        <div style="background:#eaeaea;font-weight:700;padding:4px 4px 10px 4px;border-bottom:1px solid #ccc;font-size:11px">Billing Address</div>
        <div style="padding:7px 10px 18px;font-size:11px;line-height:1.6">
          <strong>${escapeHtml(doc.customer_name || '—')}</strong><br/>
          ${escapeHtml(doc.customer_address || '').replace(/\n/g, '<br/>')}
          ${doc.customer_gstin ? `<br/>GSTIN : ${escapeHtml(doc.customer_gstin)}` : ''}
        </div>
      </td>
      <td style="width:50%;vertical-align:top;padding:0;">
        <div style="background:#eaeaea;font-weight:700;padding:4px 4px 10px 4px;border-bottom:1px solid #ccc;font-size:11px">Delivery Address</div>
        <div style="padding:7px 10px 18px;font-size:11px;line-height:1.6">
          <strong>${escapeHtml(doc.customer_name || '—')}</strong><br/>
          ${escapeHtml(doc.customer_address || '').replace(/\n/g, '<br/>')}
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
      <td style="padding:8px 12px;vertical-align:top;border-right:1px solid #444">
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
            <td style="padding:6px 12px 12px;font-weight:700;border-top:2px solid #444"><strong>Total</strong></td>
            <td style="padding:6px 12px 12px;text-align:right;font-weight:700;border-top:2px solid #444;white-space:nowrap"><strong>&#8377; ${asMoney(t.total)}</strong></td>
          </tr>
          ${t.balance != null ? `<tr>
            <td style="padding:5px 12px 10px;color:#c00;border-top:1px solid #ddd">Balance Due</td>
            <td style="padding:5px 12px 10px;text-align:right;color:#c00;border-top:1px solid #ddd;white-space:nowrap">&#8377; ${asMoney(t.balance)}</td>
          </tr>` : ''}
        </table>
      </td>
    </tr>
  </table>

  <!-- ⑦ TERMS & CONDITIONS -->
  ${(terms || bankDetails) ? `
  <table width="100%" style="border-collapse:collapse" class="sec">
    <tr>
      <td style="width:50%;vertical-align:top;padding:8px 12px 12px;border-right:1px solid #444;font-size:10px;line-height:1.6">
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
${includeSheetFooter ? `<div class="sheet-footer"><div>Contact: ${escapeHtml(singleLineFooterText((company.address || '').trim() || company.company_name || ''))}</div><div>${escapeHtml(company.gstin ? `GSTIN: ${company.gstin}` : company.company_name || '')}</div></div>` : ''}
</body>
</html>`;
}

export function buildTaxInvoiceHtml(doc, company, logoDataUrl = null, opts = {}) {
  return buildSalesDocumentHtml(doc, company, logoDataUrl, 'invoice', opts);
}

export async function openSalesDocumentPrintWindow(doc, company, kind = 'invoice') {
  const logoDataUrl = await fetchImageAsDataUrlForPdf(company.invoice_logo_url || company.logo_url);
  const html = buildSalesDocumentHtml(doc, company, logoDataUrl, kind);
  const w = window.open('', '_blank', 'width=900,height=1100');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  await waitForPrintImages(w);
  w.focus();
  w.print();
}

export async function openTaxInvoicePrintWindow(doc, company) {
  return openSalesDocumentPrintWindow(doc, company, 'invoice');
}

/**
 * Rasterize the same HTML as print → PDF (layout, ₹, tables match the browser).
 * @param {string} docNo
 */
async function rasterSalesDocumentToPdf(doc, company, kind, docNo) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Raster PDF requires a browser DOM');
  }
  const logoDataUrl = await fetchImageAsDataUrlForPdf(company.logo_url);
  const html = buildSalesDocumentHtml(doc, company, logoDataUrl, kind, {
    includeSheetFooter: false,
    rasterLayout: true,
  });

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, {
    position: 'fixed',
    left: '-14000px',
    top: '0',
    width: '820px',
    height: '4800px',
    border: '0',
    visibility: 'hidden',
  });
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  const idoc = win.document;
  idoc.open();
  idoc.write(html);
  idoc.close();

  await waitForPrintImages(win);
  const body = idoc.body;
  body.style.background = '#ffffff';

  const targetH = Math.min(16000, Math.max(480, body.scrollHeight) + 64);
  iframe.style.height = `${targetH}px`;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(body, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff',
    scrollX: 0,
    scrollY: 0,
    windowWidth: body.scrollWidth,
    windowHeight: body.scrollHeight,
  });

  document.body.removeChild(iframe);

  if (!canvas.width || !canvas.height) throw new Error('Empty invoice canvas');

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdfPageHeight(pdf);
  const margin = 36;
  const footerBand = 28;
  const pageInnerH = pageH - 2 * margin - footerBand;
  const destW = pageW - 2 * margin;
  const R = destW / canvas.width;
  const destH = canvas.height * R;

  let offsetY = 0;
  let pageIdx = 0;
  while (offsetY < destH - 0.5) {
    const sliceH = Math.min(pageInnerH, destH - offsetY);
    const sy = offsetY / R;
    const sh = Math.min(sliceH / R, canvas.height - sy);
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = Math.max(1, Math.ceil(sh));
    const ctx = sliceCanvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unsupported');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, sliceCanvas.width, sliceCanvas.height);
    const dataUrl = sliceCanvas.toDataURL('image/jpeg', 0.9);
    const drawH = sliceCanvas.height * R;
    if (drawH < 0.5) break;

    if (pageIdx > 0) pdf.addPage();
    pdf.addImage(dataUrl, 'JPEG', margin, margin, destW, drawH);

    offsetY += drawH;
    pageIdx += 1;
  }

  const footerText = `Contact: ${singleLineFooterText((company.address || '').trim() || (company.company_name || '').trim() || '')}${company.gstin ? `\nGSTIN: ${company.gstin}` : ''}`;
  const n = pdf.getNumberOfPages();
  for (let i = 1; i <= n; i += 1) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(5.5);
    pdf.setTextColor(110, 110, 110);
    const pageLabel = `-- ${i} of ${n} --`;
    pdf.text(`${footerText}\n${pageLabel}`, pageW / 2, pageH - 24, { align: 'center', width: '60%' });
  }
  pdf.setTextColor(0, 0, 0);
  pdf.save(`${docNo}.pdf`);
}

/** Vector fallback (no html2canvas) — Helvetica, limited ₹ shaping. */
async function downloadSalesDocumentPdfVector(doc, company, kind, docNo) {
  const title = kind === 'quotation' ? 'Quotation' : kind === 'order' ? 'Sales Order' : 'Tax Invoice';
  const left = 34;
  const pageW = 595;
  const rightX = pageW - left;
  const tableWidth = pageW - 2 * left;
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const t = totalsForSalesDocument(doc, kind);
  const pageH = pdfPageHeight(pdf);
  const bottomSafe = 42;

  let y = 36;
  const logoData = await fetchImageAsDataUrlForPdf(company.invoice_logo_url || company.logo_url);
  if (logoData) {
    const fmt = pdfFormatFromDataUrl(logoData);
    try {
      pdf.addImage(logoData, fmt, rightX - 64, y - 4, 64, 64);
    } catch {
      /* optional logo */
    }
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text(company.company_name || 'Company', left, y);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  const coLines = topAddressTwoLines(company.address);
  pdf.text(coLines, left, y + 12);
  y += 12 + coLines.length * 11 + 4;
  if (company.gstin) {
    pdf.text(`GSTIN: ${company.gstin}`, left, y);
    y += 14;
  } else {
    y += 6;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(19);
  pdf.text(title, pageW / 2, y, { align: 'center' });
  y += 22;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${documentNoLabel(kind)} : ${docNo}`, left, y);
  pdf.text(`${documentDateLabel(kind)} : ${fmtInvoiceDate(doc.invoice_date || doc.order_date || doc.created_at)}`, rightX, y, { align: 'right' });
  y += 13;
  const salesExecutiveName = doc.sales_executive_name
    || doc.sales_executive
    || doc.sales_person_name
    || doc.created_by_name
    || '—';
  const createdByName = doc.created_by_name || doc.created_by || '—';
  pdf.text(`Sales Executive : ${salesExecutiveName}`, rightX, y, { align: 'right' });
  if (doc.valid_until) pdf.text(`Valid Until : ${fmtInvoiceDate(doc.valid_until)}`, rightX, y, { align: 'right' });
  y += 14;
  pdf.text(`Created By : ${createdByName}`, rightX, y, { align: 'right' });
  y += 14;

  const addrBody = customerAddressBlockText(doc);
  autoTable(pdf, {
    startY: y,
    body: [
      [{ content: 'Billing Address', styles: { fontStyle: 'bold', fontSize: 10 } }],
      [{ content: addrBody, styles: { fontSize: 10, cellPadding: { top: 6, right: 6, bottom: 14, left: 6 } } }],
      [{ content: 'Delivery Address', styles: { fontStyle: 'bold', fontSize: 10 } }],
      [{ content: addrBody, styles: { fontSize: 10, cellPadding: { top: 6, right: 6, bottom: 14, left: 6 } } }],
    ],
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 6, valign: 'top', lineColor: [17, 17, 17], lineWidth: 0.5 },
    columnStyles: { 0: { cellWidth: tableWidth } },
    margin: { left, right: left, bottom: bottomSafe },
  });
  y = (pdf.lastAutoTable?.finalY || y) + 10;

  const colW = {
    0: 28,
    1: tableWidth - 28 - 54 - 52 - 86 - 86,
    2: 54,
    3: 52,
    4: 86,
    5: 86,
  };
  autoTable(pdf, {
    startY: y,
    head: [['#', 'Item & Description', 'HSN Code', 'Qty', 'Rate', 'Amount']],
    body: (doc.items || []).map((it, idx) => [
      String(idx + 1),
      it.description || it.product_name || '—',
      it.product_hsn_code || it.hsn_code || '—',
      Number(it.quantity ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 3 }),
      `₹ ${asMoney(it.unit_price)}`,
      `₹ ${asMoney(it.total)}`,
    ]),
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 5, lineColor: [51, 51, 51], lineWidth: 0.5 },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 10 },
    columnStyles: {
      0: { cellWidth: colW[0], halign: 'center' },
      1: { cellWidth: colW[1] },
      2: { cellWidth: colW[2] },
      3: { halign: 'right', cellWidth: colW[3] },
      4: { halign: 'right', cellWidth: colW[4] },
      5: { halign: 'right', cellWidth: colW[5] },
    },
    margin: { left, right: left, bottom: bottomSafe },
  });
  y = (pdf.lastAutoTable?.finalY || y) + 10;

  autoTable(pdf, {
    startY: y,
    head: [['HSN/SAC', 'Taxable Amount', 'CGST/IGST', 'SGST']],
    body: hsnSummaryRows(doc, kind).map((r) => [
      r.hsn,
      `₹ ${asMoney(r.taxable)}`,
      r.igst > 0 ? `(${r.rate}%) ₹ ${asMoney(r.igst)}` : `(${r.rate / 2}%) ₹ ${asMoney(r.cgst)}`,
      r.igst > 0 ? '—' : `(${r.rate / 2}%) ₹ ${asMoney(r.sgst)}`,
    ]),
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 5, lineColor: [51, 51, 51], lineWidth: 0.5 },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 10 },
    columnStyles: {
      0: { cellWidth: tableWidth * 0.18 },
      1: { halign: 'right', cellWidth: tableWidth * 0.28 },
      2: { halign: 'right', cellWidth: tableWidth * 0.27 },
      3: { halign: 'right', cellWidth: tableWidth * 0.27 },
    },
    margin: { left, right: left, bottom: bottomSafe },
  });
  y = (pdf.lastAutoTable?.finalY || y) + 12;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('Total in Words', left, y);
  y += 12;
  pdf.setFont('helvetica', 'normal');
  const wordLines = pdf.splitTextToSize(amountInWordsINR(t.total), tableWidth);
  const lineH = 11;
  for (let li = 0; li < wordLines.length; li += 1) {
    if (y + lineH > pageH - bottomSafe) {
      pdf.addPage();
      y = 40;
    }
    pdf.text(wordLines[li], left, y);
    y += lineH;
  }
  y += 6;

  pdf.setFontSize(11);
  pdf.text(`Sub Total: ₹ ${asMoney(t.subtotal != null ? t.subtotal : t.total)}`, rightX, y, { align: 'right' });
  y += 13;
  pdf.text(`Total Tax Charges: ₹ ${asMoney((t.cgst || 0) + (t.sgst || 0) + (t.igst || 0))}`, rightX, y, { align: 'right' });
  y += 13;
  pdf.setFont('helvetica', 'bold');
  pdf.text(`Total: ₹ ${asMoney(t.total)}`, rightX, y, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  y += 20;

  const terms = stripBankDetailsFromTerms([company.payment_terms || '', doc.notes || ''].filter(Boolean).join('\n'));
  const bankDetails = formatBankDetailsBlock(company);
  if (terms || bankDetails) {
    const colGap = 12;
    const halfWidth = (tableWidth - colGap) / 2;
    const rightColStart = left + halfWidth + colGap;
    if (y + 24 > pageH - bottomSafe) {
      pdf.addPage();
      y = 40;
    }

    let termsTopY = y;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text('Terms And Conditions:', left, termsTopY);
    pdf.text('Bank Details:', rightColStart, termsTopY);

    pdf.setFont('helvetica', 'normal');
    const termsLines = pdf.splitTextToSize(terms || '—', halfWidth);
    const bankLines = pdf.splitTextToSize(bankDetails || '—', halfWidth);
    const totalLines = Math.max(termsLines.length, bankLines.length);
    let rowY = termsTopY + 12;
    for (let li = 0; li < totalLines; li += 1) {
      if (rowY + lineH > pageH - bottomSafe) {
        pdf.addPage();
        termsTopY = 40;
        rowY = termsTopY + 12;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.text('Terms And Conditions:', left, termsTopY);
        pdf.text('Bank Details:', rightColStart, termsTopY);
        pdf.setFont('helvetica', 'normal');
      }
      if (termsLines[li]) pdf.text(termsLines[li], left, rowY);
      if (bankLines[li]) pdf.text(bankLines[li], rightColStart, rowY);
      rowY += lineH;
    }
    y = rowY + 8;
  }

  if (y + 26 > pageH - bottomSafe) {
    pdf.addPage();
    y = 40;
  }
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text('Thanks for your business', left, y);
  y += 24;
  pdf.setFont('helvetica', 'bold');
  pdf.text(`For ${company.company_name || 'Company'},`, left, y);

  const footerText = `Contact: ${singleLineFooterText((company.address || '').trim() || (company.company_name || '').trim() || '')}`;
  addPdfPageFooters(pdf, pageW, footerText);
  pdf.save(`${docNo}.pdf`);
}

export async function downloadSalesDocumentPdf(doc, company, kind = 'invoice') {
  const docNo = getSalesDocumentNumber(doc, kind);
  try {
    await rasterSalesDocumentToPdf(doc, company, kind, docNo);
  } catch (e) {
    console.warn('Sales PDF (HTML raster) failed, using vector fallback:', e);
    await downloadSalesDocumentPdfVector(doc, company, kind, docNo);
  }
}

export async function downloadTaxInvoicePdf(doc, company) {
  return downloadSalesDocumentPdf(doc, company, 'invoice');
}

async function downloadSalesDocumentFromBackend(kind, doc) {
  if (!doc || !doc.id) {
    throw new Error('Document ID required for backend PDF download');
  }
  const id = Number(doc.id);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('Invalid document ID for backend PDF download');
  }
  const path = kind === 'quotation' ? 'quotations' : kind === 'order' ? 'orders' : 'invoices';
  const resp = await api.get(`/sales/${path}/${id}/pdf`);
  const data = resp.data || {};
  const url = String(data.url || '').trim();
  const fileName = String(data.file_name || `${getSalesDocumentNumber(doc, kind)}.pdf`).trim();
  if (!url) {
    throw new Error('Backend PDF URL missing');
  }

  const downloadUrl = url.match(/^https?:\/\//i)
    ? url
    : url.replace(/^\//, '');

  const pdfResp = await api.get(downloadUrl, { responseType: 'blob' });
  const blob = new Blob([pdfResp.data], { type: 'application/pdf' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

export async function printSalesDocument(kind, doc) {
  const company = await fetchInvoiceCompanySettings();
  await openSalesDocumentPrintWindow(doc, company, kind);
}

export async function downloadSalesDocument(kind, doc) {
  if (doc && doc.id) {
    try {
      await downloadSalesDocumentFromBackend(kind, doc);
      return;
    } catch (e) {
      console.warn('Backend PDF download failed, falling back to client PDF generation:', e);
    }
  }

  const company = await fetchInvoiceCompanySettings();
  await downloadSalesDocumentPdf(doc, company, kind);
}

export async function printTaxInvoice(doc) {
  return printSalesDocument('invoice', doc);
}

export async function downloadTaxInvoice(doc) {
  return downloadSalesDocument('invoice', doc);
}
