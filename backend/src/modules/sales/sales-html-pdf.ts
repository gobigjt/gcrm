import { existsSync, readFileSync } from 'fs';
import { extname, join } from 'path';
import puppeteer from 'puppeteer';

/** Resolve `/uploads/...` paths to local files (aligned with sales.service). */
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

function mimeForPath(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/png';
}

function resolveLogoFetchUrl(urlOrPath: string): string | null {
  const s = String(urlOrPath || '').trim();
  if (!s || /^javascript:/i.test(s)) return null;
  if (/^https?:\/\//i.test(s)) return s;
  const p = s.startsWith('/') ? s : `/${s}`;
  const apiBase = String(process.env.API_PUBLIC_URL || '').trim().replace(/\/$/, '');
  if (p.startsWith('/api/uploads/')) {
    if (apiBase && /^https?:\/\//i.test(apiBase)) return `${apiBase}${p.slice('/api'.length)}`;
    const port = String(process.env.PORT || '4000').trim();
    return `http://127.0.0.1:${port}${p}`;
  }
  if (p.startsWith('/uploads/')) {
    if (apiBase && /^https?:\/\//i.test(apiBase)) return `${apiBase}${p}`;
    const port = String(process.env.PORT || '4000').trim();
    return `http://127.0.0.1:${port}/api${p}`;
  }
  return null;
}

/**
 * Inline logo as data URL so Puppeteer does not need to fetch (works offline / same process).
 */
export async function loadInvoiceLogoDataUrl(
  company: Record<string, unknown>,
  uploadsRoot: string,
): Promise<string | null> {
  const preferred = String(company.invoice_logo_url || company.logo_url || '').trim();
  if (!preferred || /\.svg$/i.test(preferred)) return null;

  const local = resolveUploadsFilePath(preferred, uploadsRoot);
  if (local) {
    try {
      const buf = readFileSync(local);
      const mime = mimeForPath(local);
      return `data:${mime};base64,${buf.toString('base64')}`;
    } catch {
      return null;
    }
  }

  const remoteUrl = resolveLogoFetchUrl(preferred);
  if (remoteUrl) {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 15_000);
      const r = await fetch(remoteUrl, { signal: ac.signal });
      clearTimeout(t);
      if (!r.ok) return null;
      const ct = (r.headers.get('content-type') || '').split(';')[0].trim() || 'image/png';
      if (ct.includes('svg')) return null;
      const ab = await r.arrayBuffer();
      return `data:${ct};base64,${Buffer.from(ab).toString('base64')}`;
    } catch {
      return null;
    }
  }

  return null;
}

/** Render the same HTML as the web print view to a PDF buffer (A4). */
export async function renderSalesPrintHtmlToPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
