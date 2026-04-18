import api from '../../api/client';

function salesPdfApiSegment(kind) {
  if (kind === 'quotation') return 'quotations';
  if (kind === 'order') return 'orders';
  return 'invoices';
}

/**
 * Ask the server to generate the PDF and return `{ url, fileName }` for download/print.
 */
async function requestSalesPdfMeta(kind, doc) {
  if (!doc || doc.id == null) {
    throw new Error('Save the document first to print or download PDF.');
  }
  const id = Number(doc.id);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('Invalid document ID for PDF.');
  }
  const segment = salesPdfApiSegment(kind);
  const resp = await api.get(`/sales/${segment}/${id}/pdf`);
  const data = resp.data || {};
  const url = String(data.url || '').trim();
  const fileName = String(data.file_name || `${segment.slice(0, -1)}-${id}.pdf`).trim();
  if (!url) {
    throw new Error('Server did not return a PDF URL.');
  }
  return { url, fileName };
}

async function fetchPdfBlob(relativeOrAbsoluteUrl) {
  const path = relativeOrAbsoluteUrl.match(/^https?:\/\//i)
    ? relativeOrAbsoluteUrl
    : relativeOrAbsoluteUrl.replace(/^\//, '');
  const pdfResp = await api.get(path, { responseType: 'blob' });
  return pdfResp.data;
}

/** Download PDF generated on the server (same layout as print). */
export async function downloadSalesDocument(kind, doc) {
  const { url, fileName } = await requestSalesPdfMeta(kind, doc);
  const blob = await fetchPdfBlob(url);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

/**
 * Open the server-generated PDF and trigger the browser print dialog.
 */
export async function printSalesDocument(kind, doc) {
  const { url } = await requestSalesPdfMeta(kind, doc);
  const blob = await fetchPdfBlob(url);
  const objectUrl = URL.createObjectURL(blob);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Print');
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none';
  iframe.src = objectUrl;
  document.body.appendChild(iframe);

  const cleanup = () => {
    URL.revokeObjectURL(objectUrl);
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };

  let printed = false;
  const tryPrint = () => {
    if (printed) return;
    printed = true;
    try {
      const w = iframe.contentWindow;
      if (w) {
        w.focus();
        w.print();
      }
    } catch (e) {
      console.warn('[printSalesDocument] iframe print failed, opening PDF in a new tab', e);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
    }
    setTimeout(cleanup, 3000);
  };

  iframe.onload = () => setTimeout(tryPrint, 200);
  setTimeout(tryPrint, 4000);
}

export async function printTaxInvoice(doc) {
  return printSalesDocument('invoice', doc);
}

export async function downloadTaxInvoice(doc) {
  return downloadSalesDocument('invoice', doc);
}
