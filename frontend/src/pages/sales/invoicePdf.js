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
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${p}`;
  }
  return p;
}

/** Bank block for invoice: structured fields + optional free-text lines. */
export function formatBankDetailsBlock(company) {
  const co = (company.company_name || 'Company').trim();
  const lines = [co];
  if (company.bank_name?.trim()) lines.push(`Bank Name: ${company.bank_name.trim()}`);
  if (company.bank_branch?.trim()) lines.push(`Branch: ${company.bank_branch.trim()}`);
  if (company.bank_account_number?.trim()) lines.push(`A/C No: ${company.bank_account_number.trim()}`);
  if (company.bank_ifsc?.trim()) lines.push(`IFSC Code: ${company.bank_ifsc.trim()}`);
  const extra = (company.invoice_bank_details || '').trim();
  if (extra) lines.push(extra);
  const text = lines.join('\n').trim();
  return text || `${co}\n(Configure bank details in Settings → Company)`;
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

function lineGstAmount(it) {
  const base = Number(it.quantity ?? 0) * Number(it.unit_price ?? 0);
  return Math.max(0, Number(it.total ?? 0) - base);
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
  if (kind === 'invoice') {
    return {
      subtotal: doc.subtotal != null ? Number(doc.subtotal) : null,
      cgst: Number(doc.cgst || 0),
      sgst: Number(doc.sgst || 0),
      igst: Number(doc.igst || 0),
      total: Number(doc.total_amount || 0),
      balance: invoiceBalanceDue(doc),
    };
  }
  let subtotal = 0;
  let gst = 0;
  for (const it of doc.items || []) {
    subtotal += Number(it.quantity ?? 0) * Number(it.unit_price ?? 0);
    gst += lineGstAmount(it);
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
  if (kind === 'quotation') return 'Estimate No';
  if (kind === 'order') return 'Order No';
  return 'Invoice No';
}

function documentDateLabel(kind) {
  if (kind === 'quotation') return 'Estimate Date';
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

function addPdfPageFooters(pdf, pageW) {
  const n = pdf.getNumberOfPages();
  const h = pdfPageHeight(pdf);
  for (let i = 1; i <= n; i += 1) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(110, 110, 110);
    pdf.text(`-- ${i} of ${n} --`, pageW / 2, h - 26, { align: 'center' });
  }
  pdf.setPage(n);
  pdf.setTextColor(0, 0, 0);
}

function statusLabel(doc) {
  return String(doc?.status || 'DRAFT').toUpperCase();
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
    const taxable = Number(it.quantity || 0) * Number(it.unit_price || 0);
    const gstAmt = lineGstAmount(it);
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
  const title = kind === 'quotation' ? 'Estimate' : kind === 'order' ? 'Sales Order' : 'Tax Invoice';

  const rawLogo = (company.logo_url || '').trim();
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

  const metaLeft = [
    [`${documentNoLabel(kind)}`, escapeHtml(docNo)],
    [documentDateLabel(kind), docDate],
    ...(dueOrValid ? [[kind === 'quotation' ? 'Valid Until' : 'Due Date', dueOrValid]] : []),
    ['Sales Executive', escapeHtml(doc.created_by_name || '—')],
  ];
  const metaRight = [
    ...(doc.state_of_supply ? [['Place of Supply', escapeHtml(doc.state_of_supply)]] : []),
    ...(doc.reference_no    ? [['Reference No',    escapeHtml(doc.reference_no)]]    : []),
    ['Status', `<strong>${escapeHtml(statusLabel(doc))}</strong>`],
  ];
  // metaLeft and metaRight are rendered directly as separate column tables in the template

  // ── Totals ────────────────────────────────────────────────────
  const totalTax = (t.cgst || 0) + (t.sgst || 0) + (t.igst || 0);
  const subTotal  = t.subtotal != null ? t.subtotal : t.total - totalTax;
  const terms     = [doc.notes || '', company.payment_terms || ''].filter(Boolean).join('\n');

  // shared border shorthand helpers (inline only — no global CSS collapse conflicts)
  const SB = 'border:1px solid #444';   // solid all sides
  const BR = 'border-right:1px solid #444';
  const BT = 'border-top:1px solid #444';
  const BD = 'border-bottom:1px solid #ddd';

  // items rows — each cell gets right border except last column
  const itemRowsHtml = (doc.items || []).map((it, idx) => `
    <tr>
      <td style="padding:5px 4px 10px;text-align:center;vertical-align:middle;${BR};${BT};width:28px">${idx + 1}</td>
      <td style="padding:5px 8px 10px;vertical-align:middle;${BR};${BT}"><strong>${escapeHtml(it.description || it.product_name || '—')}</strong></td>
      <td style="padding:5px 4px 10px;text-align:center;vertical-align:middle;${BR};${BT};width:72px">${escapeHtml(it.product_hsn_code || it.hsn_code || '—')}</td>
      <td style="padding:5px 4px 10px;text-align:center;vertical-align:middle;${BR};${BT};width:55px">${Number(it.quantity ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Nos</td>
      <td style="padding:5px 8px 10px;text-align:right;vertical-align:middle;${BR};${BT};width:85px;white-space:nowrap">&#8377; ${asMoney(it.unit_price)}</td>
      <td style="padding:5px 8px 10px;text-align:right;vertical-align:middle;${BT};width:90px;white-space:nowrap">&#8377; ${asMoney(it.total)}</td>
    </tr>`).join('') || `<tr><td colspan="6" style="padding:10px;text-align:center;color:#888;${BT}">No line items</td></tr>`;

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
    .sheet-footer { margin-top:12px; text-align:center; font-size:9px; color:#666; }
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
      <td style="padding:10px 14px;vertical-align:top;text-align:right;border-left:1px solid #444">
        <div style="font-size:20px;font-weight:700;letter-spacing:0.02em;line-height:1.2">${escapeHtml(company.company_name || 'Company')}</div>
        <div style="font-size:10px;color:#333;line-height:1.6;margin-top:4px">
          ${escapeHtml(company.address || '').replace(/\n/g, ', ')}
          ${company.gstin ? `<br/>GSTIN: ${escapeHtml(company.gstin)}` : ''}
        </div>
      </td>
    </tr>
  </table>

  <!-- ① b DOCUMENT TITLE -->
  <div class="sec" style="text-align:center;padding:6px 12px;font-size:14px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase">
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
      <td style="width:50%;vertical-align:top;padding:0;border-right:1px solid #444">
        <div style="background:#eaeaea;font-weight:700;padding:4px 10px;border-bottom:1px solid #ccc;font-size:11px">Billing Address</div>
        <div style="padding:7px 10px;font-size:11px;line-height:1.6">
          <strong>${escapeHtml(doc.customer_name || '—')}</strong><br/>
          ${escapeHtml(doc.customer_address || '').replace(/\n/g, '<br/>')}
          ${doc.customer_gstin ? `<br/>GSTIN : ${escapeHtml(doc.customer_gstin)}` : ''}
        </div>
      </td>
      <td style="width:50%;vertical-align:top;padding:0">
        <div style="background:#eaeaea;font-weight:700;padding:4px 10px;border-bottom:1px solid #ccc;font-size:11px">Delivery Address</div>
        <div style="padding:7px 10px;font-size:11px;line-height:1.6">
          <strong>${escapeHtml(doc.customer_name || '—')}</strong><br/>
          ${escapeHtml(doc.customer_address || '').replace(/\n/g, '<br/>')}
          ${doc.customer_gstin ? `<br/>GSTIN : ${escapeHtml(doc.customer_gstin)}` : ''}
        </div>
      </td>
    </tr>
  </table>

  <!-- ④ LINE ITEMS -->
  <table width="100%" style="border-collapse:collapse;font-size:10px" class="sec">
    <thead>
      <tr style="background:#eaeaea">
        <th style="padding:5px 4px 10px;text-align:center;vertical-align:middle;${BR};width:28px">#</th>
        <th style="padding:5px 8px 10px;text-align:left;vertical-align:middle;${BR}">Item&amp;Description</th>
        <th style="padding:5px 4px 10px;text-align:center;vertical-align:middle;${BR};width:72px">HSN Code</th>
        <th style="padding:5px 4px 10px;text-align:center;vertical-align:middle;${BR};width:55px">Qty</th>
        <th style="padding:5px 8px 10px;text-align:right;vertical-align:middle;${BR};width:85px">Rate</th>
        <th style="padding:5px 8px 10px;text-align:right;vertical-align:middle;width:90px">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRowsHtml}</tbody>
  </table>

  <!-- ⑤ HSN / TAX SUMMARY -->
  <table width="100%" style="border-collapse:collapse;font-size:10px" class="sec">
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
            <td style="padding:6px 12px;font-weight:700;border-top:2px solid #444"><strong>Total</strong></td>
            <td style="padding:6px 12px;text-align:right;font-weight:700;border-top:2px solid #444;white-space:nowrap"><strong>&#8377; ${asMoney(t.total)}</strong></td>
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
  ${terms ? `
  <div class="sec" style="padding:8px 12px;font-size:10px;line-height:1.6">
    <strong>Terms And Conditions:</strong><br/>
    <span style="white-space:pre-wrap">${escapeHtml(terms)}</span>
  </div>` : ''}

</div>
${includeSheetFooter ? '<div class="sheet-footer">-- 1 of 1 --</div>' : ''}
</body>
</html>`;
}

export function buildTaxInvoiceHtml(doc, company, logoDataUrl = null, opts = {}) {
  return buildSalesDocumentHtml(doc, company, logoDataUrl, 'invoice', opts);
}

export async function openSalesDocumentPrintWindow(doc, company, kind = 'invoice') {
  const logoDataUrl = await fetchImageAsDataUrlForPdf(company.logo_url);
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

  const n = pdf.getNumberOfPages();
  for (let i = 1; i <= n; i += 1) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(110, 110, 110);
    pdf.text(`-- ${i} of ${n} --`, pageW / 2, pageH - 20, { align: 'center' });
  }
  pdf.setTextColor(0, 0, 0);
  pdf.save(`${docNo}.pdf`);
}

/** Vector fallback (no html2canvas) — Helvetica, limited ₹ shaping. */
async function downloadSalesDocumentPdfVector(doc, company, kind, docNo) {
  const title = kind === 'quotation' ? 'Estimate' : kind === 'order' ? 'Sales Order' : 'Tax Invoice';
  const left = 34;
  const pageW = 595;
  const rightX = pageW - left;
  const tableWidth = pageW - 2 * left;
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const t = totalsForSalesDocument(doc, kind);
  const pageH = pdfPageHeight(pdf);
  const bottomSafe = 42;

  let y = 36;
  const logoData = await fetchImageAsDataUrlForPdf(company.logo_url);
  if (logoData) {
    const fmt = pdfFormatFromDataUrl(logoData);
    try {
      pdf.addImage(logoData, fmt, rightX - 64, y - 4, 64, 64);
    } catch {
      /* optional logo */
    }
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text(company.company_name || 'Company', left, y);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  const coLines = pdf.splitTextToSize((company.address || '').trim(), 300);
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
  pdf.text(`Status : ${statusLabel(doc)}`, left, y);
  if (doc.valid_until) pdf.text(`Valid Until : ${fmtInvoiceDate(doc.valid_until)}`, rightX, y, { align: 'right' });
  y += 14;

  const addrBody = customerAddressBlockText(doc);
  autoTable(pdf, {
    startY: y,
    body: [
      [{ content: 'Billing Address', styles: { fontStyle: 'bold', fontSize: 10 } }],
      [{ content: addrBody, styles: { fontSize: 10 } }],
      [{ content: 'Delivery Address', styles: { fontStyle: 'bold', fontSize: 10 } }],
      [{ content: addrBody, styles: { fontSize: 10 } }],
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

  const terms = [company.payment_terms || '', doc.notes || ''].filter(Boolean).join('\n');
  if (terms) {
    if (y + 24 > pageH - bottomSafe) {
      pdf.addPage();
      y = 40;
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text('Terms And Conditions:', left, y);
    y += 12;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    const lines = pdf.splitTextToSize(terms, tableWidth);
    for (let li = 0; li < lines.length; li += 1) {
      if (y + lineH > pageH - bottomSafe) {
        pdf.addPage();
        y = 40;
      }
      pdf.text(lines[li], left, y);
      y += lineH;
    }
  }

  addPdfPageFooters(pdf, pageW);
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

export async function printSalesDocument(kind, doc) {
  const company = await fetchInvoiceCompanySettings();
  await openSalesDocumentPrintWindow(doc, company, kind);
}

export async function downloadSalesDocument(kind, doc) {
  const company = await fetchInvoiceCompanySettings();
  await downloadSalesDocumentPdf(doc, company, kind);
}

export async function printTaxInvoice(doc) {
  return printSalesDocument('invoice', doc);
}

export async function downloadTaxInvoice(doc) {
  return downloadSalesDocument('invoice', doc);
}
