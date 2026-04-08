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
  const interstate = isInterstateForDoc(doc, kind);
  const docNo = getSalesDocumentNumber(doc, kind);
  const title = documentTitleForKind(kind);
  const tagline = (company.invoice_tagline || '').trim();
  const payTerms = (company.payment_terms || '').trim();
  const bankPlain = formatBankDetailsBlock(company);
  const rawLogo = (company.logo_url || '').trim();
  const useLogo = Boolean(rawLogo && !/^javascript:/i.test(rawLogo));
  const logoSrc =
    useLogo && logoDataUrl && String(logoDataUrl).startsWith('data:')
      ? logoDataUrl
      : useLogo
        ? resolvePublicUrl(rawLogo)
        : '';
  const logoLeftCell = logoSrc
    ? `<div class="invoice-header-left"><div class="invoice-logo-wrap"><img src="${escapeHtml(logoSrc)}" alt="" class="invoice-logo"/></div></div>`
    : '<div class="invoice-header-left"></div>';
  const coName = company.company_name || 'Company';
  const coGst = company.gstin || '';
  const coAddr = company.address || '';
  const coPhone = company.phone || '';
  const coEmail = company.email || '';

  const custName = doc.customer_name || '—';
  const custAddr = (doc.customer_address || '').trim();
  const custPhone = (doc.customer_phone || '').trim();
  const custEmail = (doc.customer_email || '').trim();
  const custGst = (doc.customer_gstin || '').trim();

  const rowsHtml = (doc.items || [])
    .map((it) => {
      const sac = it.product_hsn_code || it.hsn_code || '—';
      const desc = escapeHtml(it.description || it.product_name || '—');
      const { tax1, tax2 } = lineTaxCellsForKind(it, interstate, kind);
      return `
      <tr>
        <td>${desc}</td>
        <td style="text-align:center">${escapeHtml(sac)}</td>
        <td style="text-align:right">${asMoney(it.unit_price)}</td>
        <td style="text-align:right">${Number(it.quantity ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })}</td>
        <td style="text-align:right">${tax1}</td>
        <td style="text-align:right">${tax2}</td>
        <td style="text-align:right;font-weight:600">${asMoney(it.total)}</td>
      </tr>`;
    })
    .join('');

  const notesBelowTable = doc.notes
    ? `<p class="item-notes">${escapeHtml(doc.notes).replace(/\n/g, '<br/>')}</p>`
    : '';

  const t = totalsForSalesDocument(doc, kind);
  const igstRow =
    t.igst > 0
      ? `<div class="sum-row"><span>Total IGST</span><span>${asMoney(t.igst)}</span></div>`
      : `<div class="sum-row"><span>Total CGST + SGST</span><span>${asMoney(t.cgst + t.sgst)}</span></div>`;
  const balanceRow =
    kind === 'invoice'
      ? `<div class="sum-row"><span>Balance Due:</span><span>${asMoney(t.balance)}</span></div>`
      : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(docNo)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; line-height: 1.35; max-width: 800px; margin: 0 auto; padding: 8px; }
    .tagline { font-size: 9px; line-height: 1.45; text-align: center; border-bottom: 1px solid #222; padding-bottom: 10px; margin-bottom: 14px; white-space: pre-wrap; }
    .invoice-header-row { display: grid; grid-template-columns: 80px 1fr 80px; align-items: center; column-gap: 12px; margin-bottom: 14px; }
    .invoice-header-left { display: flex; align-items: center; justify-content: flex-start; min-height: 64px; }
    .invoice-header-right { min-width: 0; }
    .invoice-header-row .tax-title { text-align: center; font-size: 20px; font-weight: bold; letter-spacing: 0.12em; margin: 0; }
    .head-grid { display: table; width: 100%; margin-bottom: 14px; }
    .head-left, .head-right { display: table-cell; vertical-align: top; width: 50%; }
    .head-right { text-align: right; padding-left: 16px; }
    .to-label { font-weight: bold; margin-bottom: 6px; }
    .cust-block { font-size: 11px; line-height: 1.45; }
    .meta-row { margin-bottom: 4px; }
    table.inv { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; }
    table.inv th, table.inv td { border: 1px solid #333; padding: 6px 5px; vertical-align: top; }
    table.inv th { background: #f0f0f0; font-weight: bold; text-align: left; }
    table.inv th:nth-child(n+3), table.inv td:nth-child(n+3) { text-align: right; }
    table.inv th:nth-child(2), table.inv td:nth-child(2) { text-align: center; }
    .thanks-row { margin-top: 14px; display: table; width: 100%; font-size: 11px; }
    .thanks-left { display: table-cell; font-style: italic; }
    .thanks-right { display: table-cell; text-align: right; width: 42%; }
    .sums { margin-top: 6px; font-size: 11px; }
    .sum-row { display: flex; justify-content: flex-end; gap: 24px; padding: 3px 0; }
    .sum-row span:first-child { min-width: 140px; text-align: right; }
    .sum-row span:last-child { min-width: 100px; text-align: right; font-weight: 600; }
    .sum-row.sum-total { border-top: 1px solid #333; margin-top: 6px; padding-top: 8px; font-size: 12px; }
    .sum-row.sum-total span { font-weight: 700; }
    .for-co { margin-top: 28px; font-weight: bold; font-size: 11px; }
    .section-h { margin-top: 18px; font-weight: bold; font-size: 11px; border-bottom: 1px solid #999; padding-bottom: 4px; }
    .bank-block, .terms-block { white-space: pre-wrap; font-size: 10px; line-height: 1.45; margin-top: 8px; }
    .contact-footer { margin-top: 16px; font-size: 10px; line-height: 1.5; border-top: 1px solid #ccc; padding-top: 10px; }
    .item-notes { font-size: 10px; line-height: 1.45; margin: 10px 0 0; padding: 8px; background: #fafafa; border: 1px solid #e5e5e5; }
    .invoice-logo-wrap { text-align: left; margin: 0; }
    .invoice-logo { width: 64px; height: 64px; object-fit: contain; display: block; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>
</head>
<body>
  <div class="invoice-header-row">
    ${logoLeftCell}
    <div class="tax-title">${escapeHtml(title)}</div>
    <div class="invoice-header-right" aria-hidden="true"></div>
  </div>
  ${tagline ? `<div class="tagline">${escapeHtml(tagline)}</div>` : ''}

  <div class="head-grid">
    <div class="head-left">
      <div class="to-label">To:</div>
      <div class="cust-block">
        <strong>${escapeHtml(custName)}</strong><br/>
        ${custAddr ? `${escapeHtml(custAddr).replace(/\n/g, '<br/>')}<br/>` : ''}
        ${custPhone ? `Phone: ${escapeHtml(custPhone)}<br/>` : ''}
        ${custEmail ? `Email: ${escapeHtml(custEmail)}<br/>` : ''}
        ${custGst ? `<strong>TAX NO :</strong> ${escapeHtml(custGst)}` : ''}
      </div>
    </div>
    <div class="head-right">
      ${rightMetaHtml(doc, kind, docNo)}
    </div>
  </div>

  <table class="inv">
    <thead>
      <tr>
        <th>Description</th>
        <th>SAC / HSN</th>
        <th>Price</th>
        <th>Qty</th>
        <th>${interstate ? 'IGST' : 'CGST'}</th>
        <th>${interstate ? '' : 'SGST'}</th>
        <th>SubTotal</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="7">No line items</td></tr>'}
    </tbody>
  </table>

  ${notesBelowTable}

  <div class="thanks-row">
    <div class="thanks-left">Thanks For Business With Us !!</div>
    <div class="thanks-right">
      <div class="sums">
        <div class="sum-row"><span>SubTotal:</span><span>${t.subtotal != null ? asMoney(t.subtotal) : '—'}</span></div>
        ${igstRow}
        <div class="sum-row sum-total"><span>Total:</span><span>${asMoney(t.total)}</span></div>
        ${balanceRow}
      </div>
    </div>
  </div>

  <div class="for-co">For ${escapeHtml(coName)}</div>

  ${payTerms ? `<div class="section-h">Payment Terms</div><div class="terms-block">${escapeHtml(payTerms)}</div>` : ''}

  <div class="section-h">OUR BANK DETAILS :</div>
  <div class="bank-block">${escapeHtml(bankPlain).replace(/\n/g, '<br/>')}
  </div>

  <div class="contact-footer">
    <strong>Contact :</strong> ${escapeHtml(coAddr || '—')}
    ${coPhone ? `<br/>(M) ${escapeHtml(coPhone)}` : ''}
    ${coEmail ? ` Mail: ${escapeHtml(coEmail)}` : ''}
    ${coGst ? `<br/><strong>Company GSTIN:</strong> ${escapeHtml(coGst)}` : ''}
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
  const title = documentTitleForKind(kind);
  const interstate = isInterstateForDoc(doc, kind);
  const left = 40;
  const pageW = 595;

  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  pdf.setFont('helvetica', 'normal');

  const headerRowTop = 40;
  const logoData = await fetchImageAsDataUrlForPdf(company.logo_url);
  let logoShown = false;
  if (logoData) {
    const fmt = pdfFormatFromDataUrl(logoData);
    try {
      pdf.addImage(logoData, fmt, left, headerRowTop, 64, 64);
      logoShown = true;
    } catch {
      /* skip logo */
    }
  }

  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  const titleBaseline = logoShown ? headerRowTop + 32 + 5 : 52;
  pdf.text(title, pageW / 2, titleBaseline, { align: 'center' });
  pdf.setFont('helvetica', 'normal');

  let y = logoShown ? headerRowTop + 64 + 14 : titleBaseline + 18;

  const tagline = (company.invoice_tagline || '').trim();
  if (tagline) {
    pdf.setFontSize(8);
    const lines = pdf.splitTextToSize(tagline, pageW - 2 * left);
    pdf.text(lines, left, y);
    y += lines.length * 10 + 8;
    pdf.setDrawColor(40);
    pdf.line(left, y, pageW - left, y);
    y += 16;
  }

  const custBlock = [
    doc.customer_name || '—',
    doc.customer_address || '',
    doc.customer_phone ? `Phone: ${doc.customer_phone}` : '',
    doc.customer_email ? `Email: ${doc.customer_email}` : '',
    doc.customer_gstin ? `TAX NO : ${doc.customer_gstin}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('To:', left, y);
  pdf.setFont('helvetica', 'normal');
  const custLines = pdf.splitTextToSize(custBlock, 240);
  pdf.text(custLines, left, y + 12);

  const rightX = pageW - left;
  const metaPdf = rightMetaPdfLines(doc, kind, docNo);
  pdf.setFont('helvetica', 'bold');
  pdf.text(metaPdf[0], rightX, y, { align: 'right' });
  pdf.text(metaPdf[1], rightX, y + 14, { align: 'right' });
  pdf.text(metaPdf[2], rightX, y + 28, { align: 'right' });

  y += Math.max(custLines.length * 12 + 24, 52);

  const body = (doc.items || []).map((it) => {
    const sac = it.product_hsn_code || it.hsn_code || '—';
    const { tax1, tax2 } = lineTaxCellsForKind(it, interstate, kind);
    return [
      it.description || it.product_name || '—',
      sac,
      asMoney(it.unit_price),
      String(Number(it.quantity ?? 0)),
      tax1,
      tax2,
      asMoney(it.total),
    ];
  });

  autoTable(pdf, {
    startY: y,
    head: [
      [
        'Description',
        'SAC/HSN',
        'Price',
        'Qty',
        interstate ? 'IGST' : 'CGST',
        interstate ? '' : 'SGST',
        'SubTotal',
      ],
    ],
    body: body.length ? body : [['No line items', '', '', '', '', '', '']],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 158 },
      1: { halign: 'center', cellWidth: 52 },
      2: { halign: 'right', cellWidth: 62 },
      3: { halign: 'right', cellWidth: 36 },
      4: { halign: 'right', cellWidth: 72 },
      5: { halign: 'right', cellWidth: 72 },
      6: { halign: 'right', cellWidth: 62 },
    },
    margin: { left, right: left },
  });

  let afterY = (pdf.lastAutoTable?.finalY || y) + 14;
  if (doc.notes) {
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    const noteLines = pdf.splitTextToSize(String(doc.notes), pageW - 2 * left);
    pdf.text(noteLines, left, afterY);
    afterY += noteLines.length * 11 + 8;
  }
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'italic');
  pdf.text('Thanks For Business With Us !!', left, afterY);
  pdf.setFont('helvetica', 'normal');

  const t = totalsForSalesDocument(doc, kind);
  const subY = afterY;
  pdf.text(`SubTotal: ${t.subtotal != null ? asMoney(t.subtotal) : '—'}`, rightX, subY, { align: 'right' });
  pdf.text(
    t.igst > 0 ? `Total IGST: ${asMoney(t.igst)}` : `Total CGST + SGST: ${asMoney(t.cgst + t.sgst)}`,
    rightX,
    subY + 14,
    { align: 'right' },
  );
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`Total: ${asMoney(t.total)}`, rightX, subY + 30, { align: 'right' });
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  if (kind === 'invoice') {
    pdf.text(`Balance Due: ${asMoney(t.balance)}`, rightX, subY + 46, { align: 'right' });
    afterY = subY + 62;
  } else {
    afterY = subY + 46;
  }
  pdf.setFont('helvetica', 'bold');
  pdf.text(`For ${company.company_name || 'Company'}`, left, afterY);
  pdf.setFont('helvetica', 'normal');
  afterY += 22;

  const payTerms = (company.payment_terms || '').trim();
  if (payTerms) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Payment Terms', left, afterY);
    afterY += 12;
    pdf.setFont('helvetica', 'normal');
    const ptLines = pdf.splitTextToSize(payTerms, pageW - 2 * left);
    pdf.text(ptLines, left, afterY);
    afterY += ptLines.length * 11 + 14;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.text('OUR BANK DETAILS :', left, afterY);
  afterY += 12;
  pdf.setFont('helvetica', 'normal');
  const bankText = formatBankDetailsBlock(company);
  const bankLines = pdf.splitTextToSize(bankText, pageW - 2 * left);
  pdf.text(bankLines, left, afterY);
  afterY += bankLines.length * 11 + 14;

  let foot = `Contact : ${company.address || '—'}`;
  if (company.phone) foot += `\n(M) ${company.phone}`;
  if (company.email) foot += `  Mail: ${company.email}`;
  if (company.gstin) foot += `\nCompany GSTIN: ${company.gstin}`;
  const footLines = pdf.splitTextToSize(foot, pageW - 2 * left);
  if (afterY + footLines.length * 11 > 780) {
    pdf.addPage();
    afterY = 48;
  }
  pdf.setDrawColor(200);
  pdf.line(left, afterY, pageW - left, afterY);
  afterY += 12;
  pdf.text(footLines, left, afterY);

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
