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

/** Col1 = CGST or IGST cell, Col2 = SGST or — */
function lineTaxCells(it, interstate) {
  const rate = Number(it.gst_rate || 0);
  if (interstate) {
    const ig = Number(it.igst || 0);
    return {
      tax1: ig > 0 ? `${asMoney(it.igst)} (${rate}%)` : '—',
      tax2: '—',
    };
  }
  const half = rate / 2;
  return {
    tax1: Number(it.cgst) > 0 ? `${asMoney(it.cgst)} (${half}%)` : '—',
    tax2: Number(it.sgst) > 0 ? `${asMoney(it.sgst)} (${half}%)` : '—',
  };
}

function lineGstAmount(it) {
  const base = Number(it.quantity ?? 0) * Number(it.unit_price ?? 0);
  return Math.max(0, Number(it.total ?? 0) - base);
}

/** @param {'invoice'|'quotation'|'order'} kind */
function lineTaxCellsForKind(it, interstate, kind) {
  const hasLineSplit =
    kind === 'invoice' &&
    (Number(it.cgst) > 0 || Number(it.sgst) > 0 || Number(it.igst) > 0);
  if (hasLineSplit) return lineTaxCells(it, interstate);
  const rate = Number(it.gst_rate || 0);
  const gstAmt = lineGstAmount(it);
  if (interstate) {
    return {
      tax1: gstAmt > 0 ? `${asMoney(gstAmt)} (${rate}%)` : '—',
      tax2: '—',
    };
  }
  const half = gstAmt / 2;
  const halfRate = rate / 2;
  return {
    tax1: half > 0 ? `${asMoney(half)} (${halfRate}%)` : '—',
    tax2: half > 0 ? `${asMoney(half)} (${halfRate}%)` : '—',
  };
}

/** @param {'invoice'|'quotation'|'order'} kind */
export function getSalesDocumentNumber(doc, kind) {
  if (kind === 'quotation') return doc.quotation_number || `QT-${doc.id}`;
  if (kind === 'order') return doc.order_number || `SO-${doc.id}`;
  return doc.invoice_number || `INV-${doc.id}`;
}

/** @param {'invoice'|'quotation'|'order'} kind */
function documentTitleForKind(kind) {
  if (kind === 'quotation') return 'Quotation';
  if (kind === 'order') return 'Sales Order';
  return 'Tax Invoice';
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

/** @param {'invoice'|'quotation'|'order'} kind */
function rightMetaHtml(doc, kind, docNo) {
  if (kind === 'invoice') {
    return `
      <div class="meta-row"><strong>SRN</strong> ${doc.id}</div>
      <div class="meta-row"><strong>Invoice Date</strong> ${fmtInvoiceDate(doc.invoice_date || doc.created_at)}</div>
      <div class="meta-row"><strong>Invoice No.</strong> ${escapeHtml(docNo)}</div>`;
  }
  if (kind === 'quotation') {
    const mid = doc.valid_until
      ? `<strong>Valid Until</strong> ${fmtInvoiceDate(doc.valid_until)}`
      : `<strong>Quote Date</strong> ${fmtInvoiceDate(doc.created_at)}`;
    return `
      <div class="meta-row"><strong>SRN</strong> ${doc.id}</div>
      <div class="meta-row">${mid}</div>
      <div class="meta-row"><strong>Quotation No.</strong> ${escapeHtml(docNo)}</div>`;
  }
  return `
    <div class="meta-row"><strong>SRN</strong> ${doc.id}</div>
    <div class="meta-row"><strong>Order Date</strong> ${fmtInvoiceDate(doc.order_date || doc.created_at)}</div>
    <div class="meta-row"><strong>Order No.</strong> ${escapeHtml(docNo)}</div>`;
}

/** @param {'invoice'|'quotation'|'order'} kind */
function rightMetaPdfLines(doc, kind, docNo) {
  if (kind === 'invoice') {
    return [
      `SRN ${doc.id}`,
      `Invoice Date ${fmtInvoiceDate(doc.invoice_date || doc.created_at)}`,
      `Invoice No. ${docNo}`,
    ];
  }
  if (kind === 'quotation') {
    const mid = doc.valid_until
      ? `Valid Until ${fmtInvoiceDate(doc.valid_until)}`
      : `Quote Date ${fmtInvoiceDate(doc.created_at)}`;
    return [`SRN ${doc.id}`, mid, `Quotation No. ${docNo}`];
  }
  return [
    `SRN ${doc.id}`,
    `Order Date ${fmtInvoiceDate(doc.order_date || doc.created_at)}`,
    `Order No. ${docNo}`,
  ];
}

/**
 * @param {object} doc Invoice / quotation / order with items (and payments for invoices)
 * @param {object} company Company settings row
 * @param {string|null} [logoDataUrl] Inline data URL for logo (print loads instantly; avoids racing print())
 * @param {'invoice'|'quotation'|'order'} [kind]
 */
export function buildSalesDocumentHtml(doc, company, logoDataUrl = null, kind = 'invoice') {
  const docNo = getSalesDocumentNumber(doc, kind);
  const t = totalsForSalesDocument(doc, kind);
  const title = kind === 'quotation' ? 'Estimate' : kind === 'order' ? 'Sales Order' : 'Tax Invoice';
  const rawLogo = (company.logo_url || '').trim();
  const useLogo = Boolean(rawLogo && !/^javascript:/i.test(rawLogo));
  const logoSrc = useLogo && logoDataUrl && String(logoDataUrl).startsWith('data:')
    ? logoDataUrl
    : useLogo
      ? resolvePublicUrl(rawLogo)
      : '';
  const rowsHtml = (doc.items || []).map((it, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${escapeHtml(it.description || it.product_name || '—')}</td>
      <td>${escapeHtml(it.product_hsn_code || it.hsn_code || '—')}</td>
      <td style="text-align:right">${Number(it.quantity ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })}</td>
      <td style="text-align:right">₹ ${asMoney(it.unit_price)}</td>
      <td style="text-align:right">₹ ${asMoney(it.total)}</td>
    </tr>
  `).join('');
  const taxRows = hsnSummaryRows(doc, kind).map((r) => `
    <tr>
      <td>${escapeHtml(r.hsn)}</td>
      <td style="text-align:right">₹ ${asMoney(r.taxable)}</td>
      <td style="text-align:right">${r.igst > 0 ? `(${r.rate}%) ₹ ${asMoney(r.igst)}` : `(${r.rate / 2}%) ₹ ${asMoney(r.cgst)}`}</td>
      <td style="text-align:right">${r.igst > 0 ? '—' : `(${r.rate / 2}%) ₹ ${asMoney(r.sgst)}`}</td>
    </tr>
  `).join('');
  const terms = [company.payment_terms || '', doc.notes || ''].filter(Boolean).join('\n');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(docNo)} - ${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; }
    .co { font-size: 11px; line-height: 1.35; margin-bottom: 8px; }
    .title { text-align: center; font-size: 19px; font-weight: 700; margin: 8px 0 10px; letter-spacing: 0.08em; }
    .logo { width: 64px; height: 64px; object-fit: contain; }
    .meta { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    .meta td { padding: 2px 0; vertical-align: top; }
    .addr-wrap { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 8px 0; }
    .addr { border: 1px solid #333; padding: 8px; min-height: 92px; }
    table.tbl { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; }
    table.tbl th, table.tbl td { border: 1px solid #333; padding: 6px 5px; vertical-align: top; }
    table.tbl th { background: #f0f0f0; font-weight: 700; }
    .totals { margin-top: 10px; margin-left: auto; width: 320px; font-size: 11px; }
    .totals .r { display: flex; justify-content: space-between; padding: 2px 0; }
    .totals .grand { border-top: 1px solid #333; margin-top: 4px; padding-top: 6px; font-weight: 700; }
    .words { margin-top: 8px; font-size: 10px; }
    .terms {
      margin-top: 12px;
      white-space: pre-wrap;
      font-size: 10px;
      line-height: 1.45;
      width: 100%;
      display: block;
      box-sizing: border-box;
      clear: both;
    }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div class="co">
      <strong>${escapeHtml(company.company_name || 'Company')}</strong><br/>
      ${escapeHtml(company.address || '').replace(/\n/g, '<br/>')}<br/>
      ${company.gstin ? `GSTIN: ${escapeHtml(company.gstin)}` : ''}
    </div>
    ${logoSrc ? `<img src="${escapeHtml(logoSrc)}" alt="" class="logo" />` : ''}
  </div>
  <div class="title">${escapeHtml(title)}</div>

  <table class="meta">
    <tr><td><strong>${documentNoLabel(kind)}</strong> : ${escapeHtml(docNo)}</td><td><strong>${documentDateLabel(kind)}</strong> : ${fmtInvoiceDate(doc.invoice_date || doc.order_date || doc.created_at)}</td></tr>
    <tr><td><strong>Status</strong> : ${escapeHtml(statusLabel(doc))}</td><td>${doc.valid_until ? `<strong>Valid Until</strong> : ${fmtInvoiceDate(doc.valid_until)}` : ''}</td></tr>
  </table>

  <div class="addr-wrap">
    <div class="addr">
      <strong>Billing Address</strong><br/>
      <strong>${escapeHtml(doc.customer_name || '—')}</strong><br/>
      ${escapeHtml(doc.customer_address || '').replace(/\n/g, '<br/>')}<br/>
      ${doc.customer_gstin ? `GSTIN: ${escapeHtml(doc.customer_gstin)}` : ''}
    </div>
    <div class="addr">
      <strong>Delivery Address</strong><br/>
      <strong>${escapeHtml(doc.customer_name || '—')}</strong><br/>
      ${escapeHtml(doc.customer_address || '').replace(/\n/g, '<br/>')}<br/>
      ${doc.customer_gstin ? `GSTIN: ${escapeHtml(doc.customer_gstin)}` : ''}
    </div>
  </div>

  <table class="tbl">
    <thead>
      <tr>
        <th style="width:34px">#</th>
        <th>Item & Description</th>
        <th>HSN Code</th>
        <th>Qty</th>
        <th>Rate</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>${rowsHtml || '<tr><td colspan="6">No line items</td></tr>'}</tbody>
  </table>

  <table class="tbl" style="margin-top:10px">
    <thead><tr><th>HSN/SAC</th><th>Taxable Amount</th><th>CGST/IGST</th><th>SGST</th></tr></thead>
    <tbody>${taxRows || '<tr><td colspan="4">—</td></tr>'}</tbody>
  </table>

  <div class="words"><strong>Total in Words</strong><br/>${escapeHtml(amountInWordsINR(t.total))}</div>
  <div class="totals">
    <div class="r"><span>Sub Total</span><span>₹ ${asMoney(t.subtotal != null ? t.subtotal : t.total)}</span></div>
    <div class="r"><span>Total Tax Charges</span><span>₹ ${asMoney((t.cgst || 0) + (t.sgst || 0) + (t.igst || 0))}</span></div>
    <div class="r grand"><span>Total</span><span>₹ ${asMoney(t.total)}</span></div>
  </div>
  <div class="terms">
    <strong>Terms And Conditions:</strong><br/>
    ${escapeHtml(terms || '—')}
  </div>
</body>
</html>`;
}

export function buildTaxInvoiceHtml(doc, company, logoDataUrl = null) {
  return buildSalesDocumentHtml(doc, company, logoDataUrl, 'invoice');
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

export async function downloadSalesDocumentPdf(doc, company, kind = 'invoice') {
  const docNo = getSalesDocumentNumber(doc, kind);
  const title = kind === 'quotation' ? 'Estimate' : kind === 'order' ? 'Sales Order' : 'Tax Invoice';
  const left = 36;
  const pageW = 595;
  const rightX = pageW - left;
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const t = totalsForSalesDocument(doc, kind);

  let y = 38;
  const logoData = await fetchImageAsDataUrlForPdf(company.logo_url);
  if (logoData) {
    const fmt = pdfFormatFromDataUrl(logoData);
    try { pdf.addImage(logoData, fmt, rightX - 64, y - 6, 64, 64); } catch {}
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text(company.company_name || 'Company', left, y);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  const coLines = pdf.splitTextToSize(company.address || '', 300);
  pdf.text(coLines, left, y + 12);
  y += 12 + coLines.length * 10 + 6;
  if (company.gstin) pdf.text(`GSTIN: ${company.gstin}`, left, y);
  y += 18;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(17);
  pdf.text(title, pageW / 2, y, { align: 'center' });
  y += 18;

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${documentNoLabel(kind)} : ${docNo}`, left, y);
  pdf.text(`${documentDateLabel(kind)} : ${fmtInvoiceDate(doc.invoice_date || doc.order_date || doc.created_at)}`, rightX, y, { align: 'right' });
  y += 12;
  pdf.text(`Status : ${statusLabel(doc)}`, left, y);
  if (doc.valid_until) pdf.text(`Valid Until : ${fmtInvoiceDate(doc.valid_until)}`, rightX, y, { align: 'right' });
  y += 10;

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
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 210 }, 2: { cellWidth: 60 }, 3: { halign: 'right', cellWidth: 48 }, 4: { halign: 'right', cellWidth: 80 }, 5: { halign: 'right', cellWidth: 80 } },
    margin: { left, right: left },
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
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    margin: { left, right: left },
  });
  y = (pdf.lastAutoTable?.finalY || y) + 12;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('Total in Words', left, y);
  y += 11;
  pdf.setFont('helvetica', 'normal');
  pdf.text(pdf.splitTextToSize(amountInWordsINR(t.total), pageW - 2 * left), left, y);
  y += 22;

  pdf.setFontSize(10);
  pdf.text(`Sub Total: ₹ ${asMoney(t.subtotal != null ? t.subtotal : t.total)}`, rightX, y, { align: 'right' });
  y += 12;
  pdf.text(`Total Tax Charges: ₹ ${asMoney((t.cgst || 0) + (t.sgst || 0) + (t.igst || 0))}`, rightX, y, { align: 'right' });
  y += 12;
  pdf.setFont('helvetica', 'bold');
  pdf.text(`Total: ₹ ${asMoney(t.total)}`, rightX, y, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  y += 18;

  const terms = [company.payment_terms || '', doc.notes || ''].filter(Boolean).join('\n');
  if (terms) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Terms And Conditions:', left, y);
    y += 11;
    pdf.setFont('helvetica', 'normal');
    const lines = pdf.splitTextToSize(terms, pageW - 2 * left);
    if (y + lines.length * 10 > 800) {
      pdf.addPage();
      y = 40;
    }
    pdf.text(lines, left, y);
  }
  pdf.save(`${docNo}.pdf`);
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
