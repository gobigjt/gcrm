import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useLocation, Link, Navigate, useParams, useNavigate } from 'react-router-dom';
import { salesListPath, salesNewPath, salesViewPath, salesEditPath } from './salesPaths';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { printSalesDocument, downloadSalesDocument } from './invoicePdf';
import { SALES_FROM_LEAD_PARAM } from '../../utils/salesFromLeadUrl';
import Modal from '../../components/Modal';
import { Field, inputCls, selectCls, FormActions } from '../../components/FormField';
import { useToast } from '../../context/ToastContext';
import { apiErrorMessage } from '../../utils/apiErrorMessage';
import { promptDestructive } from '../../utils/promptDestructive';

// ─── Constants ───────────────────────────────────────────────

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal',
];
const PAYMENT_TERMS_OPTIONS = [
  'Net 15 Days','Net 30 Days','Net 45 Days','Net 60 Days',
  'Due on Receipt','Cash on Delivery','Advance Payment',
];
const PAYMENT_METHOD_OPTIONS = ['Cash','Card','UPI','Bank Transfer','Cheque','Other'];

// ─── Helpers ─────────────────────────────────────────────────

const fmt  = n  => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtD = dt => dt ? new Date(dt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const fmtDT = dt => dt ? new Date(dt).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';

function printSalesDoc(kind, doc) {
  if (!doc) return;
  void printSalesDocument(kind, doc);
}

function downloadSalesPdf(kind, doc) {
  if (!doc) return;
  void downloadSalesDocument(kind, doc);
}

function printInvoiceDoc(invoice) {
  void printSalesDocument('invoice', invoice);
}

function downloadInvoicePdf(invoice) {
  void downloadSalesDocument('invoice', invoice);
}

const STATUS_CLS = {
  draft:'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  sent:'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  accepted:'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected:'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  pending:'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  paid:'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  unpaid:'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  partial:'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  confirmed:'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  processing:'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  delivered:'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled:'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500',
  confirmed:'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  shipped:'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  completed:'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};
const StatusBadge = ({ s }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CLS[s] || STATUS_CLS.draft}`}>{s}</span>
);
const APPROVAL_CLS = {
  approved:'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  pending:'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  rejected:'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};
const ApprovalBadge = ({ s }) => {
  const v = String(s || 'approved').toLowerCase();
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${APPROVAL_CLS[v] || APPROVAL_CLS.approved}`}>{v}</span>;
};

const StatCard = ({ icon, label, value, sub }) => (
  <div className="bg-white dark:bg-[#1a1d2e] rounded-2xl border border-slate-200/80 dark:border-slate-700/50 shadow-card p-4 flex items-center gap-3">
    <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-lg flex-shrink-0">{icon}</div>
    <div>
      <p className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-none">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-400 dark:text-slate-500">{sub}</p>}
    </div>
  </div>
);

// ─── Page Header & Section Card ──────────────────────────────

function PageHeader({ title, subtitle, onBack }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <button type="button" onClick={onBack}
        className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
        ← Back
      </button>
      <div>
        <h2 className="text-[16px] font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
        {subtitle && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div className="bg-white dark:bg-[#13152a] rounded-2xl border border-slate-200 dark:border-slate-700/50 p-5 space-y-4">
      {title && <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700/50 pb-3">{title}</h3>}
      {children}
    </div>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────

const filterCls =
  'px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ' +
  'rounded-lg text-xs text-slate-700 dark:text-slate-200 ' +
  'focus:outline-none focus:border-brand-400 dark:focus:border-brand-500 focus:ring-1 focus:ring-brand-100 dark:focus:ring-brand-900/40 ' +
  'transition-all duration-150 cursor-pointer';

function FilterBar({ customers, users = [], filters, onChange, statusOptions, executiveFilter = false }) {
  const set = k => e => onChange({ ...filters, [k]: e.target.value });
  const hasFilters = filters.customer_id || filters.created_by || filters.from || filters.to || filters.status;
  return (
    <div className="flex flex-wrap items-center gap-2 mb-3 p-3 bg-white dark:bg-[#13152a] rounded-xl border border-slate-200 dark:border-slate-700/50">
      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mr-1">Filter:</span>
      <select className={filterCls} style={{maxWidth:160}} value={filters.customer_id||''} onChange={set('customer_id')}>
        <option value="">All Customers</option>
        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {users.length > 0 && (
        <div className="flex items-center gap-1.5">
          {executiveFilter && (
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">Sales executive</span>
          )}
          <select className={filterCls} style={{ maxWidth: executiveFilter ? 168 : 140 }} value={filters.created_by || ''} onChange={set('created_by')}>
            <option value="">{executiveFilter ? 'All executives' : 'All Users'}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-slate-400">From</span>
        <input type="date" className={filterCls} style={{width:130}} value={filters.from||''} onChange={set('from')} />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-slate-400">To</span>
        <input type="date" className={filterCls} style={{width:130}} value={filters.to||''} onChange={set('to')} />
      </div>
      {statusOptions && (
        <select className={filterCls} style={{maxWidth:130}} value={filters.status||''} onChange={set('status')}>
          <option value="">All Status</option>
          {statusOptions.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
        </select>
      )}
      {hasFilters && (
        <button onClick={() => onChange({})}
          className="px-2 py-1 text-[10px] font-medium text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 rounded-lg transition-colors">
          ✕ Clear
        </button>
      )}
    </div>
  );
}

// ─── List Toolbar (Search / Export / Bulk delete) ─────────────

function useSearch(data, keys) {
  const [q, setQ] = useState('');
  const filtered = q.trim()
    ? data.filter(r => keys.some(k => String(r[k]||'').toLowerCase().includes(q.toLowerCase())))
    : data;
  return { q, setQ, filtered };
}

function exportCSV(rows, cols, filename) {
  const header = cols.map(c => `"${c.label}"`).join(',');
  const body   = rows.map(r => cols.map(c => `"${String(c.get(r)||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = filename; a.click();
}

function exportExcel(rows, cols, filename) {
  const header = cols.map(c => c.label).join('\t');
  const body   = rows.map(r => cols.map(c => String(c.get(r)||'')).join('\t')).join('\n');
  const blob = new Blob([header + '\n' + body], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = filename + '.xls'; a.click();
}

function copyToClipboard(rows, cols) {
  const header = cols.map(c => c.label).join('\t');
  const body   = rows.map(r => cols.map(c => String(c.get(r)||'')).join('\t')).join('\n');
  navigator.clipboard.writeText(header + '\n' + body).catch(() => {});
}

function printTable(rows, cols, title) {
  const header = `<tr>${cols.map(c=>`<th style="border:1px solid #ccc;padding:6px 10px;background:#f5f5f5">${c.label}</th>`).join('')}</tr>`;
  const body   = rows.map(r=>`<tr>${cols.map(c=>`<td style="border:1px solid #ccc;padding:5px 10px">${c.get(r)||''}</td>`).join('')}</tr>`).join('');
  const win = window.open('','_blank');
  win.document.write(`<html><head><title>${title}</title></head><body>
    <h2 style="font-family:sans-serif">${title}</h2>
    <table style="border-collapse:collapse;font-family:sans-serif;font-size:13px">${header}${body}</table>
    <script>window.onload=()=>{window.print();window.close();}<\/script></body></html>`);
  win.document.close();
}

function ListToolbar({ data, cols, title, search, onSearch, selected, onDeleteSelected }) {
  const btnCls = 'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors';
  return (
    <div className="flex flex-wrap items-center gap-2 mb-2">
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
        <input className={filterCls + ' pl-7'} style={{width:180}} placeholder="Search…" value={search} onChange={e => onSearch(e.target.value)} />
      </div>
      <button onClick={() => copyToClipboard(data, cols)} className={btnCls + ' border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}>📋 Copy</button>
      <button onClick={() => exportExcel(data, cols, title)} className={btnCls + ' border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20'}>📊 Excel</button>
      <button onClick={() => exportCSV(data, cols, title + '.csv')} className={btnCls + ' border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/20'}>📄 CSV</button>
      <button onClick={() => printTable(data, cols, title)} className={btnCls + ' border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20'}>🖨 Print</button>
      {selected.length > 0 && (
        <button onClick={onDeleteSelected} className={btnCls + ' border-red-300 text-red-600 bg-red-50 hover:bg-red-100 dark:border-red-700 dark:text-red-400 dark:bg-red-900/20'}>
          🗑 Delete ({selected.length})
        </button>
      )}
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────

const PAGE_SIZE = 15;

/** Inclusive page indices, unique, length ≤ width (sliding window around `page`). */
function visiblePageNumbers(page, totalPages, width = 5) {
  const t = Math.max(0, totalPages);
  if (t <= 0) return [];
  if (t <= width) return Array.from({ length: t }, (_, i) => i + 1);
  const p = Math.min(Math.max(1, page), t);
  const half = Math.floor(width / 2);
  let start = p - half;
  if (start < 1) start = 1;
  let end = start + width - 1;
  if (end > t) {
    end = t;
    start = Math.max(1, end - width + 1);
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function usePagination(data) {
  const [page, setPage] = useState(1);
  const count = data.length;
  const totalPages = Math.ceil(count / PAGE_SIZE);

  useEffect(() => {
    const tp = Math.ceil(count / PAGE_SIZE);
    const maxPage = Math.max(1, tp);
    setPage((p) => Math.min(Math.max(1, p), maxPage));
  }, [count]);

  const slice = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return { page, setPage, total: totalPages, slice, count };
}

function Pagination({ page, total, count, onChange }) {
  if (count === 0 || total <= 1) return null;
  const pages = visiblePageNumbers(page, total, 5);
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 dark:border-slate-700/50 text-xs text-slate-500">
      <span>Page {page} of {total}</span>
      <div className="flex gap-1">
        <button disabled={page===1} onClick={()=>onChange(1)} className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800">«</button>
        <button disabled={page===1} onClick={()=>onChange(page-1)} className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800">‹</button>
        {pages.map((p) => (
          <button key={p} type="button" onClick={()=>onChange(p)} className={`px-2.5 py-1 rounded border transition-colors ${p===page?'bg-brand-600 text-white border-brand-600':'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{p}</button>
        ))}
        <button disabled={page===total} onClick={()=>onChange(page+1)} className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800">›</button>
        <button disabled={page===total} onClick={()=>onChange(total)} className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800">»</button>
      </div>
      <span>{((page-1)*PAGE_SIZE)+1}–{Math.min(page*PAGE_SIZE,count)} of {count}</span>
    </div>
  );
}

// ─── Row settings dropdown ────────────────────────────────────

function SettingsDropdown({ options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold tracking-widest">
        ⋮
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] bg-white dark:bg-[#1e2235] border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
          {options.map((opt, i) => (
            <button key={i} type="button"
              onClick={e => { e.stopPropagation(); setOpen(false); opt.onClick(); }}
              className={`w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 ${opt.danger ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>
              <span>{opt.icon}</span>{opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Line Items Editor ────────────────────────────────────────

const EMPTY_LINE = { product_id: '', description: '', quantity: 1, unit_price: 0, discount: 0, gst_rate: 0 };

function calcLine(l, taxType = 'exclusive') {
  const base   = Math.max(1, parseInt(l.quantity, 10) || 1) * Number(l.unit_price);
  const preTax = base - Number(l.discount || 0);
  const rate   = Number(l.gst_rate) / 100;

  if (taxType === 'no_tax') {
    return { ...l, base, taxable: preTax, gst: 0, total: preTax };
  }
  if (taxType === 'inclusive') {
    // unit_price already includes GST — back-calculate the tax portion
    const taxable = rate > 0 ? preTax / (1 + rate) : preTax;
    const gst     = preTax - taxable;
    return { ...l, base, taxable, gst, total: preTax };
  }
  // exclusive (default): GST added on top
  const gst = preTax * rate;
  return { ...l, base, taxable: preTax, gst, total: preTax + gst };
}

function calcTotals(lines, interstate, discAmt = 0, shippingAmt = 0, roundOff = 0) {
  const subtotal = lines.reduce((s, l) => s + l.taxable, 0);
  const totalGst = lines.reduce((s, l) => s + l.gst, 0);
  const cgst = interstate ? 0 : totalGst / 2;
  const sgst = interstate ? 0 : totalGst / 2;
  const igst = interstate ? totalGst : 0;
  const grandTotal = subtotal + cgst + sgst + igst - Number(discAmt) + Number(shippingAmt) + Number(roundOff);
  return { subtotal, cgst, sgst, igst, grandTotal };
}

function TotalSummary({ lines, interstate, taxType = 'exclusive', discountAmount = 0, shippingAmount = 0, roundOff = 0 }) {
  const { subtotal, cgst, sgst, igst, grandTotal } = calcTotals(
    lines.map(l => calcLine(l, taxType)), interstate, discountAmount, shippingAmount, roundOff,
  );
  const disc = Number(discountAmount || 0);
  const ship = Number(shippingAmount || 0);
  const roff = Number(roundOff || 0);
  return (
    <div className="flex justify-end">
      <div className="w-72 space-y-1.5 text-sm bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
        <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>Subtotal</span><span className="font-mono">{fmt(subtotal)}</span></div>
        {interstate
          ? <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>IGST</span><span className="font-mono">{fmt(igst)}</span></div>
          : <><div className="flex justify-between text-slate-500 dark:text-slate-400"><span>CGST</span><span className="font-mono">{fmt(cgst)}</span></div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>SGST</span><span className="font-mono">{fmt(sgst)}</span></div></>}
        {disc > 0 && <div className="flex justify-between text-red-500"><span>Discount</span><span className="font-mono">−{fmt(disc)}</span></div>}
        {ship > 0 && <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>Shipping</span><span className="font-mono">{fmt(ship)}</span></div>}
        {roff !== 0 && <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>Round Off</span><span className="font-mono">{roff > 0 ? '+' : ''}{fmt(roff)}</span></div>}
        <div className="flex justify-between font-bold text-lg text-slate-800 dark:text-slate-100 border-t border-slate-200 dark:border-slate-700 pt-2">
          <span>Grand Total</span><span className="font-mono">{fmt(grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}

function LineItems({ items, onChange, products, interstate = false, taxType = 'exclusive', showDiscount = false }) {
  const lines = items.map(l => calcLine(l, taxType));
  const { subtotal, cgst, sgst, igst, grandTotal } = calcTotals(lines, interstate);

  const update = (i, key, val) => {
    const next = items.map((l, idx) => idx === i ? { ...l, [key]: val } : l);
    if (key === 'product_id') {
      const p = products.find(p => String(p.id) === String(val));
      if (p) {
        next[i] = { ...next[i], description: p.name, unit_price: Number(p.sale_price), gst_rate: Number(p.gst_rate) };
      }
    }
    onChange(next, { subtotal, cgst, sgst, igst, total: grandTotal });
  };

  const addLine = () => onChange([...items, { ...EMPTY_LINE }], {});
  const removeLine = i => onChange(items.filter((_, idx) => idx !== i), {});

  const th = 'px-2 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide';
  const td = 'px-2 py-1.5';

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/50">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/50">
            <tr>
              <th className={th} style={{width:'30%'}}>Product / Description</th>
              <th className={th} style={{width:'7%'}}>Qty</th>
              <th className={th} style={{width:'13%'}}>Unit Price</th>
              {showDiscount && <th className={th} style={{width:'10%'}}>Discount</th>}
              <th className={th} style={{width:'8%'}}>GST%</th>
              <th className={th} style={{width:'12%'}}>Taxable</th>
              <th className={th} style={{width:'12%'}}>Total</th>
              <th className={th} style={{width:'3%'}}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
            {lines.map((l, i) => (
              <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                <td className={td}>
                  <select className={selectCls + ' mb-1'} value={l.product_id}
                    onChange={e => update(i, 'product_id', e.target.value)}>
                    <option value="">— Select product —</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input className={inputCls + ' text-xs'} placeholder="Description"
                    value={l.description} onChange={e => update(i, 'description', e.target.value)} />
                </td>
                <td className={td}>
                  <input type="number" min="1" step="1" className={inputCls + ' w-16'} value={l.quantity}
                    onChange={e => update(i, 'quantity', Math.max(1, parseInt(e.target.value, 10) || 1))} />
                </td>
                <td className={td}>
                  <input type="number" min="0" step="1" className={inputCls + ' w-24'} value={l.unit_price}
                    onChange={e => update(i, 'unit_price', e.target.value)} />
                </td>
                {showDiscount && (
                  <td className={td}>
                    <input type="number" min="0" step="1" className={inputCls + ' w-20'} value={l.discount||0}
                      onChange={e => update(i, 'discount', e.target.value)} />
                  </td>
                )}
                <td className={td}>
                  <input type="number" min="0" max="28" step="1" className={inputCls + ' w-14'} value={l.gst_rate}
                    onChange={e => update(i, 'gst_rate', e.target.value)} />
                </td>
                <td className={td + ' text-right text-slate-600 dark:text-slate-300 font-mono text-xs'}>{fmt(l.taxable)}</td>
                <td className={td + ' text-right text-slate-800 dark:text-slate-100 font-semibold font-mono text-xs'}>{fmt(l.total)}</td>
                <td className={td}>
                  <button type="button" onClick={() => removeLine(i)}
                    className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 text-lg leading-none">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button type="button" onClick={addLine}
        className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium">
        + Add line item
      </button>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-56 space-y-1 text-sm">
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <span>Subtotal</span><span className="font-mono">{fmt(subtotal)}</span>
          </div>
          {interstate ? (
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>IGST</span><span className="font-mono">{fmt(igst)}</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>CGST</span><span className="font-mono">{fmt(cgst)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>SGST</span><span className="font-mono">{fmt(sgst)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between font-bold text-slate-800 dark:text-slate-100 border-t border-slate-200 dark:border-slate-700 pt-1 mt-1">
            <span>Total</span><span className="font-mono">{fmt(grandTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Customer Modal ───────────────────────────────────────────

function customerFormFromLead(lead) {
  const leadAddress = (lead.address || '').trim();
  const name = ((lead.company || lead.name || '') + '').trim() || 'Lead contact';
  return {
    name,
    email: lead.email || '',
    phone: lead.phone || '',
    gstin: '',
    billing_address: leadAddress,
    shipping_address: leadAddress,
  };
}

function CustomerModal({ customer, crmLeadPrefill, onClose, onSaved }) {
  const { show } = useToast();
  const [form, setForm] = useState(() => {
    if (customer) {
      return {
        name: customer.name,
        email: customer.email || '',
        phone: customer.phone || '',
        gstin: customer.gstin || '',
        billing_address: customer.billing_address || customer.address || '',
        shipping_address: customer.shipping_address || '',
      };
    }
    if (crmLeadPrefill) return customerFormFromLead(crmLeadPrefill);
    return { name:'', email:'', phone:'', gstin:'', billing_address:'', shipping_address:'' };
  });
  const [sameAsBilling, setSameAsBilling] = useState(() => {
    const billing = String(form.billing_address || '').trim();
    const shipping = String(form.shipping_address || '').trim();
    return shipping === '' || shipping === billing;
  });
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(f => {
    const value = e.target.value;
    if (k === 'billing_address' && sameAsBilling) {
      return { ...f, billing_address: value, shipping_address: value };
    }
    return { ...f, [k]: value };
  });

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const body = {
        ...form,
        shipping_address: sameAsBilling ? (form.billing_address || '') : (form.shipping_address || ''),
      };
      if (customer) {
        await api.patch(`/sales/customers/${customer.id}`, body);
        show('Customer updated successfully', 'success');
      } else {
        if (crmLeadPrefill?.id) body.lead_id = crmLeadPrefill.id;
        await api.post('/sales/customers', body);
        show('Customer created successfully', 'success');
      }
      onSaved();
    } catch (err) {
      show(apiErrorMessage(err, 'Could not save customer'), 'error');
    } finally { setLoading(false); }
  };

  const title = customer ? 'Edit Customer' : crmLeadPrefill ? 'New Customer (from CRM lead)' : 'New Customer';

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Name *"><input className={inputCls} value={form.name} onChange={set('name')} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><input className={inputCls} value={form.phone||''} onChange={set('phone')} /></Field>
          <Field label="Email"><input className={inputCls} type="email" value={form.email||''} onChange={set('email')} /></Field>
        </div>
        <Field label="GSTIN"><input className={inputCls} value={form.gstin||''} onChange={set('gstin')} placeholder="22AAAAA0000A1Z5" /></Field>
        <Field label="Billing Address"><textarea className={inputCls+' h-16 resize-none'} value={form.billing_address||''} onChange={set('billing_address')} /></Field>
        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={sameAsBilling}
            onChange={(e) => {
              const checked = e.target.checked;
              setSameAsBilling(checked);
              if (checked) {
                setForm((f) => ({ ...f, shipping_address: f.billing_address || '' }));
              }
            }}
          />
          Same as billing address
        </label>
        <Field label="Shipping Address">
          <textarea
            className={inputCls+' h-16 resize-none'}
            value={sameAsBilling ? (form.billing_address||'') : (form.shipping_address||'')}
            onChange={set('shipping_address')}
            disabled={sameAsBilling}
          />
        </Field>
        <FormActions onCancel={onClose} submitLabel={customer ? 'Save' : 'Add Customer'} loading={loading} />
      </form>
    </Modal>
  );
}

function CustomerAddressPreview({ customer }) {
  if (!customer) return null;
  const billing = (customer.billing_address || customer.address || '').trim();
  const shipping = (customer.shipping_address || '').trim();
  const gstin = (customer.gstin || '').trim();
  if (!billing && !shipping && !gstin) return null;
  return (
    <div className="mt-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 text-xs text-slate-600 dark:text-slate-300 space-y-1">
      {billing && <p><span className="font-semibold">Billing:</span> {billing}</p>}
      {shipping && <p><span className="font-semibold">Shipping:</span> {shipping}</p>}
      {gstin && <p><span className="font-semibold">GSTIN:</span> {gstin}</p>}
    </div>
  );
}

// ─── Document Modal (Quotation / Order / Invoice) ─────────────

const SALES_ORDER_STATUS_LIST = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
const SALES_ORDER_STATUS_SET = new Set(SALES_ORDER_STATUS_LIST);

function DocumentModal({ type, customers, products, initialCustomerId = '', existingId = null, onClose, onSaved, fullPage = false }) {
  const { user } = useAuth();
  const { show } = useToast();
  const isQuote   = type === 'quotation';
  const isOrder   = type === 'order';
  const isInvoice = type === 'invoice';
  const isEditQuote = Boolean(isQuote && existingId);
  const isEditInvoice = Boolean(isInvoice && existingId);
  const isEditOrder = Boolean(isOrder && existingId);

  const [form, setForm] = useState({
    customer_id: initialCustomerId || '', valid_until: '', order_date: '', invoice_date: '', due_date: '',
    notes: '', is_interstate: false,
    status: type === 'order' ? 'pending' : type === 'invoice' ? 'unpaid' : 'draft',
    created_by: '',
    // invoice-specific
    reference_no: '', gst_type: 'intra_state', tax_type: 'exclusive',
    state_of_supply: '', discount_amount: 0, shipping_amount: 0,
    extra_discount: 0, round_off: 0, payment_terms: '', payment_method: '',
  });
  const [items, setItems]       = useState([{ ...EMPTY_LINE }]);
  const [loading, setLoading]   = useState(false);
  const [fetchingDoc, setFetchingDoc] = useState(() => Boolean(existingId && (isQuote || isInvoice || isOrder)));
  const [loadErr, setLoadErr]   = useState('');
  const [salesExecs, setSalesExecs] = useState([]);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const selectedCustomer = useMemo(
    () => customers.find((c) => String(c.id) === String(form.customer_id)),
    [customers, form.customer_id],
  );

  const canPickOtherExecutive = ['Admin', 'Super Admin', 'Sales Manager'].includes(user?.role || '');
  const executiveOptions = (() => {
    if (!user?.id) return [];
    if (canPickOtherExecutive) {
      if (salesExecs.length) return salesExecs;
      return [{ id: user.id, name: user.name || user.email || 'You' }];
    }
    const self = salesExecs.find((x) => String(x.id) === String(user.id));
    return self ? [self] : [{ id: user.id, name: user.name || user.email || 'Me' }];
  })();

  useEffect(() => {
    api.get('/sales/executives').then((r) => setSalesExecs(r.data || [])).catch(() => setSalesExecs([]));
  }, []);

  useEffect(() => {
    setForm((f) => ({
      ...f,
      customer_id: initialCustomerId || '',
      created_by: existingId ? f.created_by : String(user?.id || f.created_by || ''),
    }));
  }, [initialCustomerId, type, existingId, user?.id]);

  useEffect(() => {
    if (!existingId || (!isQuote && !isInvoice && !isOrder)) {
      setLoadErr('');
      setFetchingDoc(false);
      return undefined;
    }
    let cancelled = false;
    setFetchingDoc(true);
    setLoadErr('');
    const endpoint = isQuote
      ? `/sales/quotations/${existingId}`
      : isInvoice
        ? `/sales/invoices/${existingId}`
        : `/sales/orders/${existingId}`;
    api.get(endpoint)
      .then((r) => {
        const q = r.data?.quotation || r.data?.invoice || r.data?.order;
        if (cancelled || !q) return;
        setForm((f) => ({
          ...f,
          customer_id: String(q.customer_id ?? ''),
          valid_until: q.valid_until ? String(q.valid_until).slice(0, 10) : '',
          invoice_date: q.invoice_date ? String(q.invoice_date).slice(0, 10) : '',
          due_date: q.due_date ? String(q.due_date).slice(0, 10) : '',
          order_date: q.order_date ? String(q.order_date).slice(0, 10) : '',
          notes: q.notes || '',
          status: q.status || (isOrder ? 'pending' : isInvoice ? 'unpaid' : 'draft'),
          is_interstate: Number(q.igst || 0) > 0,
          created_by: q.created_by != null ? String(q.created_by) : String(user?.id || ''),
          // invoice-specific fields
          reference_no: q.reference_no || '',
          gst_type: Number(q.igst || 0) > 0 ? 'inter_state' : 'intra_state',
          tax_type: q.tax_type || 'exclusive',
          state_of_supply: q.state_of_supply || '',
          discount_amount: q.discount_amount || 0,
          shipping_amount: q.shipping_amount || 0,
          extra_discount: q.extra_discount || 0,
          round_off: q.round_off || 0,
          payment_terms: q.payment_terms || '',
          payment_method: q.payment_method || '',
        }));
        setItems(
          q.items?.length
            ? q.items.map((it) => ({
              product_id: it.product_id != null ? String(it.product_id) : '',
              description: it.description || it.product_name || '',
              quantity: it.quantity,
              unit_price: it.unit_price,
              discount: it.discount || 0,
              gst_rate: it.gst_rate,
            }))
            : [{ ...EMPTY_LINE }],
        );
      })
      .catch((e) =>
        setLoadErr(
          e?.response?.data?.message ||
            e.message ||
            `Failed to load ${isInvoice ? 'invoice' : isOrder ? 'order' : 'quotation'}`,
        ),
      )
      .finally(() => {
        if (!cancelled) setFetchingDoc(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isQuote, isInvoice, isOrder, existingId, user?.id]);

  const handleItems = (newItems, _newTotals) => {
    setItems(newItems);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const interstate = form.gst_type === 'inter_state';
      const taxType = form.tax_type || 'exclusive';
      const lines = items.map(l => calcLine(l, taxType)).map(l => ({
        product_id:  l.product_id || null,
        description: l.description,
        quantity:    Number(l.quantity),
        unit_price:  Number(l.unit_price),
        discount:    Number(l.discount || 0),
        gst_rate:    Number(l.gst_rate),
        cgst:        interstate ? 0 : l.gst / 2,
        sgst:        interstate ? 0 : l.gst / 2,
        igst:        interstate ? l.gst : 0,
        total:       l.total,
      }));
      const createdByNum = form.created_by ? Number(form.created_by) : undefined;
      if (isEditQuote) {
        await api.patch(`/sales/quotations/${existingId}`, {
          customer_id: Number(form.customer_id),
          valid_until: form.valid_until || null,
          notes: form.notes || null,
          status: form.status || 'draft',
          gst_type: form.gst_type,
          tax_type: form.tax_type,
          is_interstate: interstate,
          created_by: createdByNum,
          items: lines,
        });
      } else if (isEditInvoice) {
        await api.patch(`/sales/invoices/${existingId}`, {
          customer_id: Number(form.customer_id),
          invoice_date: form.invoice_date || null,
          due_date: form.due_date || null,
          reference_no: form.reference_no || null,
          state_of_supply: form.state_of_supply || null,
          gst_type: form.gst_type,
          tax_type: form.tax_type,
          discount_amount: Number(form.discount_amount || 0),
          shipping_amount: Number(form.shipping_amount || 0),
          extra_discount: Number(form.extra_discount || 0),
          round_off: Number(form.round_off || 0),
          payment_terms: form.payment_terms || null,
          payment_method: form.payment_method || null,
          notes: form.notes || null,
          status: form.status || 'unpaid',
          is_interstate: interstate,
          created_by: createdByNum,
          items: lines,
        });
      } else if (isEditOrder) {
        const orderStatus = SALES_ORDER_STATUS_SET.has(form.status) ? form.status : 'pending';
        await api.patch(`/sales/orders/${existingId}`, {
          customer_id: Number(form.customer_id),
          order_date: form.order_date || null,
          due_date: form.due_date || null,
          notes: form.notes || null,
          status: orderStatus,
          gst_type: form.gst_type,
          tax_type: form.tax_type,
          is_interstate: interstate,
          created_by: createdByNum,
          items: lines,
        });
      } else if (isInvoice) {
        await api.post('/sales/invoices', {
          customer_id: Number(form.customer_id),
          invoice_date: form.invoice_date || null,
          due_date: form.due_date || null,
          reference_no: form.reference_no || null,
          state_of_supply: form.state_of_supply || null,
          gst_type: form.gst_type,
          tax_type: form.tax_type,
          discount_amount: Number(form.discount_amount || 0),
          shipping_amount: Number(form.shipping_amount || 0),
          extra_discount: Number(form.extra_discount || 0),
          round_off: Number(form.round_off || 0),
          payment_terms: form.payment_terms || null,
          payment_method: form.payment_method || null,
          notes: form.notes || null,
          status: 'unpaid',
          is_interstate: interstate,
          created_by: createdByNum,
          items: lines,
        });
      } else if (isQuote) {
        await api.post('/sales/quotations', {
          customer_id: Number(form.customer_id),
          valid_until: form.valid_until || null,
          notes: form.notes || null,
          status: form.status || 'draft',
          gst_type: form.gst_type,
          tax_type: form.tax_type,
          is_interstate: interstate,
          created_by: createdByNum,
          items: lines,
        });
      } else {
        const orderStatus = SALES_ORDER_STATUS_SET.has(form.status) ? form.status : 'pending';
        await api.post('/sales/orders', {
          customer_id: Number(form.customer_id),
          order_date: form.order_date || null,
          due_date: form.due_date || null,
          notes: form.notes || null,
          status: orderStatus,
          gst_type: form.gst_type,
          tax_type: form.tax_type,
          is_interstate: interstate,
          created_by: createdByNum,
          items: lines,
        });
      }
      const savedMsg = isEditQuote
        ? 'Quotation updated'
        : isEditInvoice
          ? 'Invoice updated'
          : isEditOrder
            ? 'Order updated'
            : isInvoice
              ? 'Invoice created'
              : isQuote
                ? 'Quotation created'
                : 'Order created';
      show(savedMsg, 'success');
      onSaved();
    } catch (err) {
      show(apiErrorMessage(err, 'Could not save document'), 'error');
    } finally { setLoading(false); }
  };

  const title = isEditQuote
    ? 'Edit Quotation'
    : isEditInvoice
      ? 'Edit Invoice'
      : isEditOrder
        ? 'Edit Order'
        : isQuote
          ? 'New Quotation'
          : isOrder
            ? 'New Sales Order'
            : 'New Invoice';

  if (fetchingDoc) {
    if (fullPage) {
      return (
        <div className="w-full min-w-0 bg-white dark:bg-[#13152a] rounded-2xl border border-slate-200/80 dark:border-slate-700/50 shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
            <button type="button" className="btn-wf-secondary" onClick={onClose}>Back</button>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">Loading…</p>
        </div>
      );
    }
    return (
      <Modal title={title} onClose={onClose}>
        <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">Loading…</p>
      </Modal>
    );
  }

  // ── Invoice-specific full-page form ──────────────────────────
  if (isInvoice) {
    const interstate = form.gst_type === 'inter_state';
    const submitLabel = isEditInvoice ? 'Save Invoice' : 'Generate Invoice';
    const invoiceForm = (
      <form onSubmit={handleSubmit} className="space-y-4">
        {loadErr && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{loadErr}</p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title="Bill To">
            <Field label="Customer *">
              <select className={selectCls} value={form.customer_id} onChange={set('customer_id')} required>
                <option value="">Select customer…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <CustomerAddressPreview customer={selectedCustomer} />
            {user?.id && (
              <Field label="Sales Executive *">
                <select className={selectCls} value={form.created_by} onChange={set('created_by')} required
                  disabled={!canPickOtherExecutive && executiveOptions.length <= 1}>
                  {executiveOptions.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                {!canPickOtherExecutive && (
                  <p className="text-[10px] text-slate-400 mt-1">Only managers and admins can assign a different executive.</p>
                )}
              </Field>
            )}
          </SectionCard>

          <SectionCard title="Invoice Properties">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Reference No."><input className={inputCls} value={form.reference_no} onChange={set('reference_no')} /></Field>
              <Field label="Invoice Date"><input type="date" className={inputCls} value={form.invoice_date} onChange={set('invoice_date')} /></Field>
              <Field label="Due Date"><input type="date" className={inputCls} value={form.due_date} onChange={set('due_date')} /></Field>
              <Field label="State of Supply">
                <select className={selectCls} value={form.state_of_supply} onChange={set('state_of_supply')}>
                  <option value="">Select state…</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            {isEditInvoice && (
              <Field label="Status">
                <select className={selectCls} value={form.status} onChange={set('status')}>
                  {['draft','unpaid','partial','paid','cancelled'].map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>
                  ))}
                </select>
              </Field>
            )}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">GST Type</p>
              <div className="flex gap-3">
                {[['intra_state','Intra State (CGST+SGST)'],['inter_state','Inter State (IGST)']].map(([v,l]) => (
                  <label key={v} className={`flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl border-2 transition-all text-sm font-medium ${form.gst_type === v ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                    <input type="radio" name="gst_type" value={v} checked={form.gst_type === v} onChange={set('gst_type')} className="accent-brand-600 w-4 h-4" />{l}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Tax</p>
              <div className="flex gap-3">
                {[['exclusive','Tax Exclusive'],['inclusive','Tax Inclusive'],['no_tax','No Tax']].map(([v,l]) => (
                  <label key={v} className={`flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl border-2 transition-all text-sm font-medium ${form.tax_type === v ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                    <input type="radio" name="tax_type" value={v} checked={form.tax_type === v} onChange={set('tax_type')} className="accent-brand-600 w-4 h-4" />{l}
                  </label>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Items">
          <LineItems items={items} onChange={handleItems} products={products} interstate={interstate} taxType={form.tax_type} showDiscount />
        </SectionCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title="Extra Charges">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Discount (₹)"><input type="number" min="0" step="0.01" className={inputCls} value={form.discount_amount} onChange={set('discount_amount')} /></Field>
              <Field label="Shipping (₹)"><input type="number" min="0" step="0.01" className={inputCls} value={form.shipping_amount} onChange={set('shipping_amount')} /></Field>
              <Field label="Extra Discount (₹)"><input type="number" min="0" step="0.01" className={inputCls} value={form.extra_discount} onChange={set('extra_discount')} /></Field>
              <Field label="Round Off (₹)"><input type="number" step="0.01" className={inputCls} value={form.round_off} onChange={set('round_off')} /></Field>
            </div>
          </SectionCard>
          <SectionCard title="Payment">
            <Field label="Payment Terms">
              <select className={selectCls} value={form.payment_terms} onChange={set('payment_terms')}>
                <option value="">Select terms…</option>
                {PAYMENT_TERMS_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Payment Method">
              <select className={selectCls} value={form.payment_method} onChange={set('payment_method')}>
                <option value="">Select method…</option>
                {PAYMENT_METHOD_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
          </SectionCard>
        </div>

        <SectionCard>
          <Field label="Invoice Note"><textarea className={inputCls+' h-16 resize-none'} value={form.notes} onChange={set('notes')} /></Field>
          <TotalSummary lines={items} interstate={interstate} taxType={form.tax_type}
            discountAmount={form.discount_amount} shippingAmount={form.shipping_amount}
            roundOff={form.round_off} />
        </SectionCard>

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn-wf-primary">{loading ? 'Saving…' : submitLabel}</button>
          <button type="button" onClick={onClose} className="btn-wf-secondary">Cancel</button>
        </div>
      </form>
    );

    if (fullPage) {
      return (
        <div className="w-full min-w-0 px-1">
          <PageHeader
            title={isEditInvoice ? 'Edit Invoice' : 'Create Sale Invoice'}
            subtitle={isEditInvoice ? '' : 'New invoice for customer'}
            onBack={onClose}
          />
          {invoiceForm}
        </div>
      );
    }
    return (
      <Modal title={isEditInvoice ? 'Edit Invoice' : 'Create Sale Invoice'} onClose={onClose}>
        {invoiceForm}
      </Modal>
    );
  }

  // ── Quote / Order full-page form ─────────────────────────────
  const quoteOrderForm = (
    <form onSubmit={handleSubmit} className="space-y-4">
      {loadErr && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{loadErr}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Bill To">
          <Field label="Customer *">
            <select className={selectCls} value={form.customer_id} onChange={set('customer_id')} required>
              <option value="">Select customer…</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <CustomerAddressPreview customer={selectedCustomer} />
          {user?.id && (
            <Field label="Sales Executive *">
              <select className={selectCls} value={form.created_by} onChange={set('created_by')} required
                disabled={!canPickOtherExecutive && executiveOptions.length <= 1}>
                {executiveOptions.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              {!canPickOtherExecutive && (
                <p className="text-[10px] text-slate-400 mt-1">Only managers and admins can assign a different executive.</p>
              )}
            </Field>
          )}
        </SectionCard>

        <SectionCard title={isQuote ? 'Quotation Properties' : 'Order Properties'}>
          <div className="grid grid-cols-2 gap-3">
            {isQuote && <Field label="Valid Until"><input type="date" className={inputCls} value={form.valid_until} onChange={set('valid_until')} /></Field>}
            {isOrder && (
              <>
                <Field label="Order Date"><input type="date" className={inputCls} value={form.order_date} onChange={set('order_date')} /></Field>
                <Field label="Due Date"><input type="date" className={inputCls} value={form.due_date} onChange={set('due_date')} /></Field>
              </>
            )}
            {isQuote && isEditQuote && (
              <Field label="Status">
                <select className={selectCls} value={form.status} onChange={set('status')}>
                  {['draft', 'sent', 'accepted', 'rejected'].map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </Field>
            )}
            {isOrder && isEditOrder && (
              <Field label="Status">
                <select className={selectCls} value={form.status} onChange={set('status')}>
                  {['pending', 'processing', 'shipped', 'delivered', 'cancelled'].map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </Field>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">GST Type</p>
            <div className="flex gap-3">
              {[['intra_state','Intra State (CGST+SGST)'],['inter_state','Inter State (IGST)']].map(([v,l]) => (
                <label key={v} className={`flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl border-2 transition-all text-sm font-medium ${form.gst_type === v ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                  <input type="radio" name="gst_type" value={v} checked={form.gst_type === v} onChange={set('gst_type')} className="accent-brand-600 w-4 h-4" />{l}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Tax</p>
            <div className="flex gap-3">
              {[['exclusive','Tax Exclusive'],['inclusive','Tax Inclusive'],['no_tax','No Tax']].map(([v,l]) => (
                <label key={v} className={`flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl border-2 transition-all text-sm font-medium ${form.tax_type === v ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                  <input type="radio" name="tax_type" value={v} checked={form.tax_type === v} onChange={set('tax_type')} className="accent-brand-600 w-4 h-4" />{l}
                </label>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Items">
        <LineItems items={items} onChange={handleItems} products={products} interstate={form.gst_type === 'inter_state'} taxType={form.tax_type} showDiscount />
      </SectionCard>

      <SectionCard>
        <Field label={isQuote ? 'Quotation Note' : 'Order Note'}><textarea className={inputCls+' h-16 resize-none'} value={form.notes} onChange={set('notes')} /></Field>
        <TotalSummary lines={items} interstate={form.gst_type === 'inter_state'} taxType={form.tax_type} />
      </SectionCard>

      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="btn-wf-primary">
          {loading ? 'Saving…' : isEditQuote ? 'Save Quotation' : isEditOrder ? 'Save Order' : `Create ${title.replace('New ', '')}`}
        </button>
        <button type="button" onClick={onClose} className="btn-wf-secondary">Cancel</button>
      </div>
    </form>
  );

  if (fullPage) {
    return (
      <div className="w-full min-w-0 px-1">
        <PageHeader
          title={title}
          subtitle={isQuote ? (isEditQuote ? '' : 'New quotation for customer') : (isEditOrder ? '' : 'New sales order for customer')}
          onBack={onClose}
        />
        {quoteOrderForm}
      </div>
    );
  }

  return (
    <Modal title={title} onClose={onClose}>
      {quoteOrderForm}
    </Modal>
  );
}

// ─── Payment Modal ────────────────────────────────────────────

function PaymentModal({ invoice, onClose, onSaved }) {
  const { show } = useToast();
  const balance = Number(invoice.total_amount) - (invoice.payments || []).reduce((s, p) => s + Number(p.amount), 0);
  const [form, setForm] = useState({ amount: balance.toFixed(2), method: 'bank_transfer', payment_date: '', reference: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await api.post(`/sales/invoices/${invoice.id}/payments`, form);
      show('Payment recorded successfully', 'success');
      onSaved();
    } catch (err) {
      show(apiErrorMessage(err, 'Could not record payment'), 'error');
    } finally { setLoading(false); }
  };

  return (
    <Modal title="Record Payment" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-sm">
          <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Invoice total</span><span className="font-semibold">{fmt(invoice.total_amount)}</span></div>
          <div className="flex justify-between mt-1"><span className="text-slate-500 dark:text-slate-400">Balance due</span><span className="font-bold text-brand-600 dark:text-brand-400">{fmt(balance)}</span></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount *"><input type="number" step="0.01" min="0.01" className={inputCls} value={form.amount} onChange={set('amount')} required /></Field>
          <Field label="Payment Date"><input type="date" className={inputCls} value={form.payment_date} onChange={set('payment_date')} /></Field>
        </div>
        <Field label="Method">
          <select className={selectCls} value={form.method} onChange={set('method')}>
            {['bank_transfer','cash','cheque','upi','card','other'].map(m => <option key={m} value={m}>{m.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
          </select>
        </Field>
        <Field label="Reference / UTR"><input className={inputCls} value={form.reference} onChange={set('reference')} /></Field>
        <FormActions onCancel={onClose} submitLabel="Record Payment" loading={loading} />
      </form>
    </Modal>
  );
}

// ─── Detail Drawer ────────────────────────────────────────────

const DETAIL_FULL_PAGE_TITLE = {
  quotation: 'Quotation details',
  order: 'Order details',
  invoice: 'Invoice details',
};

function DetailDrawer({ type, id, onClose, onRefresh, onEditQuotation, onEditInvoice, onEditOrder, fullPage = false, autoDownloadPdf = false }) {
  const { show } = useToast();
  const [doc,     setDoc]     = useState(null);
  const [paying,  setPaying]  = useState(false);
  const autoPdfTriggeredRef = useRef(false);

  useEffect(() => {
    if (fullPage) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [fullPage, onClose]);

  const load = useCallback(() => {
    const path = { quotation:'/sales/quotations', order:'/sales/orders', invoice:'/sales/invoices' }[type];
    api.get(`${path}/${id}`).then(r => setDoc(r.data.quotation || r.data.order || r.data.invoice || r.data));
  }, [type, id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!autoDownloadPdf || !doc || autoPdfTriggeredRef.current) return;
    autoPdfTriggeredRef.current = true;
    downloadSalesPdf(type, doc);
  }, [autoDownloadPdf, doc, type]);

  const changeStatus = async (status) => {
    const path = { quotation:'/sales/quotations', order:'/sales/orders' }[type];
    if (!path) return;
    try {
      await api.patch(`${path}/${id}`, { status });
      load();
      onRefresh();
      show('Status updated successfully', 'success');
    } catch (err) {
      show(apiErrorMessage(err, 'Could not update status'), 'error');
    }
  };

  if (!doc) {
    if (fullPage) {
      return (
        <div className="w-full min-w-0 bg-white dark:bg-[#13152a] rounded-2xl border border-slate-200/80 dark:border-slate-700/50 shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{DETAIL_FULL_PAGE_TITLE[type] || 'Details'}</h3>
            <button type="button" className="btn-wf-secondary" onClick={onClose}>Back</button>
          </div>
          <p className="text-slate-400 text-sm py-8 text-center">Loading…</p>
        </div>
      );
    }
    return (
      <div className="fixed inset-0 z-40 flex">
        <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
        <div className="w-full max-w-xl sm:max-w-2xl bg-white dark:bg-[#13152a] flex items-center justify-center border-l border-slate-200 dark:border-slate-700">
          <p className="text-slate-400 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  const QUOTE_STATUSES = ['draft','sent','accepted','rejected'];
  const ORDER_STATUSES = ['pending','processing','shipped','delivered','cancelled'];
  const statuses = type === 'quotation' ? QUOTE_STATUSES : type === 'order' ? ORDER_STATUSES : [];

  const contentShellCls = fullPage
    ? 'w-full max-w-none bg-white dark:bg-[#13152a] flex flex-col overflow-hidden'
    : 'w-full max-w-xl sm:max-w-2xl bg-white dark:bg-[#13152a] shadow-2xl flex flex-col border-l border-slate-200/80 dark:border-slate-700/50 overflow-hidden';

  const content = (
    <div className={contentShellCls}>

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700/50 flex-shrink-0">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {doc.invoice_number || doc.quotation_number || doc.order_number}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{doc.customer_name}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge s={doc.status} />
              <ApprovalBadge s={doc.approval_status} />
              {type === 'quotation' && onEditQuotation && (
                <button
                  type="button"
                  onClick={() => onEditQuotation(id)}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
                >
                  Edit
                </button>
              )}
              {type === 'invoice' && onEditInvoice && (
                <button
                  type="button"
                  onClick={() => onEditInvoice(id)}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
                >
                  Edit
                </button>
              )}
              {type === 'order' && onEditOrder && (
                <button
                  type="button"
                  onClick={() => onEditOrder(id)}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
                >
                  Edit
                </button>
              )}
              {(type === 'quotation' || type === 'order' || type === 'invoice') && (
                <>
                  <button
                    type="button"
                    onClick={() => printSalesDoc(type, doc)}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadSalesPdf(type, doc)}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                  >
                    Download PDF
                  </button>
                </>
              )}
              <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xl px-1">×</button>
            </div>
          </div>

          {/* Status change pills */}
          {statuses.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {statuses.map(s => (
                <button key={s} onClick={() => changeStatus(s)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${doc.status === s
                    ? `${STATUS_CLS[s]} border-current` : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400'}`}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Key fields */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Date', fmtD(doc.invoice_date || doc.order_date || doc.created_at)],
              ['Due / Valid', fmtD(doc.due_date || doc.valid_until)],
              ['Amount', fmt(doc.total_amount)],
              ['Sales executive', doc.created_by_name || '—'],
            ].map(([k,v]) => (
              <div key={k} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2">
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">{k}</p>
                <p className="font-semibold text-slate-700 dark:text-slate-200">{v}</p>
              </div>
            ))}
          </div>

          {/* Line items */}
          {doc.items?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Line Items</p>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      {['Description','Qty','Price','GST%','Total'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                    {doc.items.map((it, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{it.description || it.product_name || '—'}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{it.quantity}</td>
                        <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">{fmt(it.unit_price)}</td>
                        <td className="px-3 py-2 text-slate-500">{it.gst_rate}%</td>
                        <td className="px-3 py-2 font-semibold font-mono text-slate-800 dark:text-slate-100">{fmt(it.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tax details (PDF-style) */}
              <div className="mt-3 flex justify-end">
                <div className="w-72 space-y-1.5 text-sm bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Tax Details</p>
                  {(() => {
                    const subtotal = doc.subtotal != null
                      ? Number(doc.subtotal || 0)
                      : Number(doc.total_amount || 0) - Number(doc.cgst || 0) - Number(doc.sgst || 0) - Number(doc.igst || 0);
                    const cgst = Number(doc.cgst || 0);
                    const sgst = Number(doc.sgst || 0);
                    const igst = Number(doc.igst || 0);
                    const totalTax = cgst + sgst + igst;
                    const showIgst = igst > 0;
                    return (
                      <>
                        <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>Sub Total</span><span className="font-mono">{fmt(subtotal)}</span></div>
                        {showIgst ? (
                          <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>IGST</span><span className="font-mono">{fmt(igst)}</span></div>
                        ) : (
                          <>
                            <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>CGST</span><span className="font-mono">{fmt(cgst)}</span></div>
                            <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>SGST</span><span className="font-mono">{fmt(sgst)}</span></div>
                          </>
                        )}
                        <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>Total Tax Charges</span><span className="font-mono">{fmt(totalTax)}</span></div>
                      </>
                    );
                  })()}
                  <div className="flex justify-between font-bold text-slate-800 dark:text-slate-100 border-t border-slate-200 dark:border-slate-700 pt-1.5 mt-1.5">
                    <span>Total</span><span className="font-mono">{fmt(doc.total_amount)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payments (invoice only) */}
          {type === 'invoice' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Payments</p>
                <button onClick={() => setPaying(true)}
                  className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline">
                  + Record Payment
                </button>
              </div>
              {(!doc.payments || doc.payments.length === 0) ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 py-2">No payments yet</p>
              ) : (
                <div className="space-y-2">
                  {doc.payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200/60 dark:border-emerald-800/30 rounded-xl px-3 py-2.5">
                      <div>
                        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{fmt(p.amount)}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{fmtD(p.payment_date)} · {p.method?.replace('_',' ')}</p>
                      </div>
                      {p.reference && <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{p.reference}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {doc.notes && (
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-800/30 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Notes</p>
              <p className="text-sm text-amber-800 dark:text-amber-300">{doc.notes}</p>
            </div>
          )}
        </div>

        {paying && (
          <PaymentModal invoice={doc} onClose={() => setPaying(false)} onSaved={() => { setPaying(false); load(); onRefresh(); }} />
        )}
      </div>
  );

  if (fullPage) {
    return (
      <div className="w-full min-w-0 bg-white dark:bg-[#13152a] rounded-2xl border border-slate-200/80 dark:border-slate-700/50 shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{DETAIL_FULL_PAGE_TITLE[type] || 'Details'}</h3>
          <button type="button" className="btn-wf-secondary" onClick={onClose}>Back</button>
        </div>
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      {content}
    </div>
  );
}

// ─── Routed form / detail pages ───────────────────────────────

function segmentToDocType(segment) {
  if (segment === 'quotes') return 'quotation';
  if (segment === 'orders') return 'order';
  return 'invoice';
}

export function SalesFormPage({ segment }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const prefillCustomer = searchParams.get('customerId') || '';
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const existingId = id != null ? id : null;
  const type = segmentToDocType(segment);

  useEffect(() => {
    api.get('/inventory/products').then((r) => setProducts(r.data.products || r.data || [])).catch(() => {});
    api.get('/sales/customers').then((r) => setCustomers(r.data || [])).catch(() => {});
  }, []);

  const goBack = () => {
    navigate({ pathname: salesListPath(segment), search: location.search });
  };

  const handleSaved = () => {
    navigate({ pathname: salesListPath(segment), search: location.search });
  };

  return (
    <div className="w-full min-w-0 -mx-5">
      <DocumentModal
        key={existingId ? `edit-${type}-${existingId}` : `new-${type}`}
        type={type}
        customers={customers}
        products={products}
        initialCustomerId={prefillCustomer}
        existingId={existingId}
        fullPage
        onClose={goBack}
        onSaved={handleSaved}
      />
    </div>
  );
}

export function SalesDetailPage({ segment }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const type = segmentToDocType(segment);
  const autoDownloadPdf = searchParams.get('autoPdf') === '1';

  const goBack = () => {
    navigate({ pathname: salesListPath(segment), search: location.search });
  };

  return (
    <div className="w-full min-w-0 -mx-5 min-h-[50vh]">
      <DetailDrawer
        type={type}
        id={id}
        fullPage={false}
        autoDownloadPdf={autoDownloadPdf}
        onClose={goBack}
        onRefresh={() => {}}
        onEditQuotation={type === 'quotation' ? (qid) => navigate({ pathname: salesEditPath('quotes', qid), search: location.search }) : undefined}
        onEditInvoice={type === 'invoice' ? (iid) => navigate({ pathname: salesEditPath('invoices', iid), search: location.search }) : undefined}
        onEditOrder={type === 'order' ? (oid) => navigate({ pathname: salesEditPath('orders', oid), search: location.search }) : undefined}
      />
    </div>
  );
}

// ─── Main Sales Page ──────────────────────────────────────────

const VALID_SALES_SEGMENTS = new Set(['quotes', 'orders', 'invoices']);
const SEGMENT_TO_TAB = { quotes: 'Quotes', orders: 'Orders', invoices: 'Invoices' };

const LIST_PAGE_COPY = {
  Quotes:   { title: 'Quotes',   subtitle: 'Click a row to preview in the side drawer; use the row menu to open the full page or edit.' },
  Orders:   { title: 'Orders',   subtitle: 'Click a row to preview in the side drawer; use the row menu to open the full page or edit.' },
  Invoices: { title: 'Invoices', subtitle: 'Click a row for a drawer with totals, lines, and payments; row menu has full page and edit.' },
};

const QUOTE_STATUSES   = ['draft','sent','accepted','rejected'];
const ORDER_STATUSES   = ['pending','processing','shipped','delivered','cancelled'];
const INVOICE_STATUSES = ['draft','unpaid','partial','paid','cancelled'];

const LIST_COLS = {
  Quotes:   [
    { label: 'Number',   get: r => r.quotation_number },
    { label: 'Customer', get: r => r.customer_name },
    { label: 'Status',   get: r => r.status },
    { label: 'Approval', get: r => r.approval_status || 'approved' },
    { label: 'Date',     get: r => fmtD(r.created_at) },
    { label: 'Sales executive', get: r => r.created_by_name || '' },
    { label: 'Amount',   get: r => fmt(r.total_amount) },
  ],
  Orders:   [
    { label: 'Number',   get: r => r.order_number },
    { label: 'Customer', get: r => r.customer_name },
    { label: 'Status',   get: r => r.status },
    { label: 'Approval', get: r => r.approval_status || 'approved' },
    { label: 'Date',     get: r => fmtD(r.order_date || r.created_at) },
    { label: 'Sales executive', get: r => r.created_by_name || '' },
    { label: 'Amount',   get: r => fmt(r.total_amount) },
  ],
  Invoices: [
    { label: 'Invoice #', get: r => r.invoice_number },
    { label: 'Customer', get: r => r.customer_name },
    { label: 'Sales executive', get: r => r.created_by_name || '' },
    { label: 'GSTIN', get: r => r.customer_gstin || '' },
    { label: 'Before Tax', get: r => fmt(r.subtotal) },
    { label: 'SGST', get: r => fmt(r.sgst) },
    { label: 'CGST', get: r => fmt(r.cgst) },
    { label: 'Grand Total', get: r => fmt(r.total_amount) },
    { label: 'Balance', get: r => fmt(r.balance) },
    { label: 'Status', get: r => r.status },
    { label: 'Approval', get: r => r.approval_status || 'approved' },
    { label: 'Date', get: r => fmtD(r.invoice_date || r.created_at) },
  ],
};

function leadBannerTitle(lead) {
  if (!lead) return '';
  const n = (lead.name || '').trim();
  if (n) return n;
  const p = (lead.phone || '').trim();
  if (p) return p;
  return (lead.company || '').trim() || `Lead #${lead.id}`;
}

export function SalesListPage({ segment }) {
  const { show } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const tab = segment && VALID_SALES_SEGMENTS.has(segment) ? SEGMENT_TO_TAB[segment] : null;

  const [data,      setData]      = useState([]);
  const [stats,     setStats]     = useState(null);
  const [customers, setCustomers] = useState([]);
  const [modal,     setModal]     = useState(null);
  const [editCust,  setEditCust]  = useState(null);
  const [filters,   setFilters]   = useState({});
  const [selected,  setSelected]  = useState([]);
  const [bannerLead, setBannerLead] = useState(null);
  const [customerPrefillLead, setCustomerPrefillLead] = useState(null);
  const [salesExecutives, setSalesExecutives] = useState([]);
  /** `{ type, id }` when a document drawer is open (quote / order / invoice). */
  const [drawer, setDrawer] = useState(null);

  const loadStats = useCallback(() => { api.get('/sales/stats').then(r => setStats(r.data)).catch(() => {}); }, []);
  const loadData  = useCallback(() => {
    if (!tab) return;
    const paths = { Quotes:'/sales/quotations', Orders:'/sales/orders', Invoices:'/sales/invoices' };
    const params = {};
    if (filters.customer_id) params.customer_id = filters.customer_id;
    if (filters.created_by) params.created_by = filters.created_by;
    if (filters.status) params.status = filters.status;
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    api.get(paths[tab], { params }).then(r => setData(r.data || [])).catch(() => setData([]));
  }, [tab, filters]);

  const cols = LIST_COLS[tab] || [];
  const search = useSearch(data, ['invoice_number','quotation_number','order_number','customer_name','customer_gstin','created_by_name']);
  const pager  = usePagination(search.filtered);

  useEffect(() => {
    api.get('/sales/customers').then(r => setCustomers(r.data || [])).catch(() => {});
    api.get('/sales/executives').then((r) => setSalesExecutives(r.data || [])).catch(() => setSalesExecutives([]));
    loadStats();
  }, []);

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const id = sp.get(SALES_FROM_LEAD_PARAM);
    if (!id || !/^\d+$/.test(id)) {
      setBannerLead(null);
      return;
    }
    api
      .get(`/crm/leads/${id}`)
      .then((r) => {
        const lead = r.data.lead || r.data;
        setBannerLead(lead?.id ? lead : null);
      })
      .catch(() => setBannerLead(null));
  }, [location.search]);

  useEffect(() => { loadData(); }, [loadData]);

  const clearFromLead = useCallback(() => {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        sp.delete(SALES_FROM_LEAD_PARAM);
        return sp;
      },
      { replace: true },
    );
    setBannerLead(null);
  }, [setSearchParams]);

  const customerLinkedToBanner = bannerLead
    ? customers.find((c) => String(c.lead_id) === String(bannerLead.id))
    : null;

  const afterSave = () => {
    setModal(null);
    setEditCust(null);
    setCustomerPrefillLead(null);
    loadData();
    loadStats();
    api.get('/sales/customers').then(r => setCustomers(r.data || [])).catch(() => {});
  };

  const tabType = { Quotes: 'quotation', Orders: 'order', Invoices: 'invoice' };

  const openDocDrawer = (r) => {
    setDrawer({ type: tabType[tab], id: r.id });
  };

  const docLinkClick = (e, r) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    openDocDrawer(r);
  };

  if (!tab) {
    return <Navigate to="/sales/quotes" replace />;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-800 dark:text-slate-100">{LIST_PAGE_COPY[tab].title}</h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{LIST_PAGE_COPY[tab].subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <button
            type="button"
            onClick={() => {
              setCustomerPrefillLead(null);
              setModal('customer');
            }}
            className="btn-wf-secondary text-xs"
          >
            + Customer
          </button>
          <button
            type="button"
            onClick={() => navigate(salesNewPath(segment, location.search.replace(/^\?/, '')))}
            className="btn-wf-primary"
          >
            + {tab === 'Quotes' ? 'Quotation' : tab === 'Orders' ? 'Order' : 'Invoice'}
          </button>
        </div>
      </div>

      {bannerLead && (
        <div className="mb-4 rounded-xl border border-brand-500/30 dark:border-brand-500/20 bg-brand-50 dark:bg-brand-950/20 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400 mb-0.5">From CRM Lead</p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{leadBannerTitle(bannerLead)}</p>
              {bannerLead.company && (bannerLead.name || bannerLead.phone) && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{bannerLead.company}</p>
              )}
            </div>
            <button
              type="button"
              onClick={clearFromLead}
              className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded transition-colors"
              title="Dismiss"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {!customerLinkedToBanner && (
              <button
                type="button"
                className="btn-wf-secondary text-xs"
                onClick={() => { setCustomerPrefillLead(bannerLead); setModal('customer'); }}
              >
                + Create customer
              </button>
            )}
            {customerLinkedToBanner && (
              <>
                <span className="text-xs text-slate-500 dark:text-slate-400">Customer: <span className="font-medium text-slate-700 dark:text-slate-200">{customerLinkedToBanner.name}</span></span>
                <button
                  type="button"
                  className="btn-wf-primary text-xs"
                  onClick={() => {
                    const sp = new URLSearchParams(location.search);
                    sp.set('customerId', String(customerLinkedToBanner.id));
                    navigate({ pathname: '/sales/quotes/new', search: sp.toString() });
                  }}
                >
                  + New quote
                </button>
                <button
                  type="button"
                  className="btn-wf-secondary text-xs"
                  onClick={() => {
                    const sp = new URLSearchParams(location.search);
                    sp.set('customerId', String(customerLinkedToBanner.id));
                    navigate({ pathname: '/sales/orders/new', search: sp.toString() });
                  }}
                >
                  + New order
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Stats — invoice tab shows revenue breakdown like jeg CRM */}
      {stats && tab === 'Invoices' && stats.total_sales != null && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard icon="💼" label="Total Sales" value={fmt(stats.total_sales)} />
          <StatCard icon="✅" label="Paid" value={fmt(stats.paid_amount)} />
          <StatCard icon="❌" label="Unpaid" value={fmt(stats.unpaid_amount)} />
          <StatCard icon="⏳" label="Partial" value={fmt(stats.partial_amount)} />
        </div>
      )}
      {stats && tab !== 'Invoices' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <StatCard icon="📦" label="Open Orders"    value={stats.open_orders}   />
          <StatCard icon="💰" label="Revenue (Paid)" value={fmt(stats.revenue)} />
          <StatCard icon="⏳" label="Receivable"   value={fmt(stats.receivable)} sub={stats.overdue ? `${stats.overdue} overdue` : null} />
        </div>
      )}

      {/* Filters + Toolbar */}
      <FilterBar
        customers={customers}
        users={salesExecutives}
        executiveFilter
        filters={filters}
        onChange={f => { setFilters(f); setSelected([]); }}
        statusOptions={tab === 'Quotes' ? QUOTE_STATUSES : tab === 'Orders' ? ORDER_STATUSES : INVOICE_STATUSES}
      />
      <ListToolbar
        data={search.filtered}
        cols={cols}
        title={LIST_PAGE_COPY[tab]?.title || tab}
        search={search.q}
        onSearch={search.setQ}
        selected={selected}
        onDeleteSelected={() => {
          const type = tabType[tab];
          promptDestructive(show, {
            message: `Delete ${selected.length} record(s)?`,
            onConfirm: async () => {
              await Promise.all(selected.map((rid) => api.delete(`/sales/${type}s/${rid}`)));
              setSelected([]);
              loadData();
              loadStats();
              show('Deleted successfully', 'success');
            },
          });
        }}
      />

      {/* Table */}
      <div className="bg-white dark:bg-[#13152a] rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
        {pager.slice.length === 0 ? (
          <p className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">No records found</p>
        ) : tab === 'Invoices' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1040px]">
              <thead><tr className="border-b border-slate-100 dark:border-slate-700/50">
                <th className="px-3 py-3 w-8">
                  <input type="checkbox"
                    checked={selected.length === pager.slice.length && pager.slice.length > 0}
                    onChange={e => setSelected(e.target.checked ? pager.slice.map(r => r.id) : [])}
                  />
                </th>
                {['Invoice #','Customer','Sales executive','GSTIN','Before Tax','SGST','CGST','Grand Total','Balance','Status','Approval','Date',''].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                {pager.slice.map(r => {
                  const type = tabType[tab];
                  const viewTo = `${salesViewPath(segment, r.id)}${location.search || ''}`;
                  return (
                    <tr key={r.id} onClick={() => openDocDrawer(r)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer group">
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox"
                          checked={selected.includes(r.id)}
                          onChange={e => setSelected(p => e.target.checked ? [...p, r.id] : p.filter(x => x !== r.id))}
                        />
                      </td>
                      <td className="px-3 py-3 font-mono text-xs font-semibold text-brand-600 dark:text-brand-400">
                        <Link to={viewTo} className="hover:underline" onClick={(e) => { e.stopPropagation(); docLinkClick(e, r); }}>{r.invoice_number}</Link>
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-800 dark:text-slate-100">{r.customer_name}</td>
                      <td className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">{r.created_by_name || '—'}</td>
                      <td className="px-3 py-3 text-xs text-slate-500">{r.customer_gstin || '—'}</td>
                      <td className="px-3 py-3 font-mono text-xs">{fmt(r.subtotal)}</td>
                      <td className="px-3 py-3 font-mono text-xs">{fmt(r.sgst)}</td>
                      <td className="px-3 py-3 font-mono text-xs">{fmt(r.cgst)}</td>
                      <td className="px-3 py-3 font-semibold font-mono text-xs">{fmt(r.total_amount)}</td>
                      <td className="px-3 py-3 font-mono text-xs text-amber-600 dark:text-amber-400">{fmt(r.balance)}</td>
                      <td className="px-3 py-3"><StatusBadge s={r.status} /></td>
                      <td className="px-3 py-3"><ApprovalBadge s={r.approval_status} /></td>
                      <td className="px-3 py-3 text-xs text-slate-500">{fmtD(r.invoice_date || r.created_at)}</td>
                      <td className="px-3 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <SettingsDropdown options={[
                          { icon: '👁', label: 'View in drawer', onClick: () => openDocDrawer(r) },
                          { icon: '↗', label: 'Open full page', onClick: () => navigate(viewTo) },
                          { icon: '✏️', label: 'Edit', onClick: () => navigate(`${salesEditPath(segment, r.id)}${location.search || ''}`) },
                          { icon: '🗑', label: 'Delete', danger: true, onClick: () => {
                            promptDestructive(show, {
                              message: 'Delete this record?',
                              onConfirm: async () => {
                                await api.delete(`/sales/${type}s/${r.id}`);
                                loadData();
                                loadStats();
                                show('Record deleted successfully', 'success');
                              },
                            });
                          }},
                        ]} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <table className="w-full text-sm min-w-[640px]">
            <thead><tr className="border-b border-slate-100 dark:border-slate-700/50">
              <th className="px-3 py-3 w-8">
                <input type="checkbox"
                  checked={selected.length === pager.slice.length && pager.slice.length > 0}
                  onChange={e => setSelected(e.target.checked ? pager.slice.map(r => r.id) : [])}
                />
              </th>
              {['Number','Customer','Status','Approval','Date','Sales executive','Amount',''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
              {pager.slice.map(r => {
                const num  = r.invoice_number || r.quotation_number || r.order_number;
                const date = r.invoice_date || r.order_date || r.created_at;
                const type = tabType[tab];
                const viewTo = `${salesViewPath(segment, r.id)}${location.search || ''}`;
                return (
                  <tr key={r.id} onClick={() => openDocDrawer(r)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer group">
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox"
                        checked={selected.includes(r.id)}
                        onChange={e => setSelected(p => e.target.checked ? [...p, r.id] : p.filter(x => x !== r.id))}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-600 dark:text-brand-400">
                      <Link to={viewTo} className="hover:underline" onClick={(e) => { e.stopPropagation(); docLinkClick(e, r); }}>{num}</Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{r.customer_name}</td>
                    <td className="px-4 py-3"><StatusBadge s={r.status} /></td>
                    <td className="px-4 py-3"><ApprovalBadge s={r.approval_status} /></td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{fmtD(date)}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{r.created_by_name || '—'}</td>
                    <td className="px-4 py-3 font-semibold font-mono text-slate-800 dark:text-slate-100">{fmt(r.total_amount)}</td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <SettingsDropdown options={[
                        { icon: '👁', label: 'View in drawer', onClick: () => openDocDrawer(r) },
                        { icon: '↗', label: 'Open full page', onClick: () => navigate(viewTo) },
                        { icon: '✏️', label: 'Edit', onClick: () => navigate(`${salesEditPath(segment, r.id)}${location.search || ''}`) },
                        { icon: '🗑', label: 'Delete', danger: true, onClick: () => {
                          promptDestructive(show, {
                            message: 'Delete this record?',
                            onConfirm: async () => {
                              await api.delete(`/sales/${type}s/${r.id}`);
                              loadData();
                              loadStats();
                              show('Record deleted successfully', 'success');
                            },
                          });
                        }},
                      ]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <Pagination page={pager.page} total={pager.total} count={pager.count} onChange={pager.setPage} />
      </div>

      {drawer && (
        <DetailDrawer
          type={drawer.type}
          id={drawer.id}
          fullPage={false}
          onClose={() => setDrawer(null)}
          onRefresh={() => { loadData(); loadStats(); }}
          onEditQuotation={drawer.type === 'quotation' ? (qid) => {
            setDrawer(null);
            navigate({ pathname: salesEditPath('quotes', qid), search: location.search });
          } : undefined}
          onEditInvoice={drawer.type === 'invoice' ? (iid) => {
            setDrawer(null);
            navigate({ pathname: salesEditPath('invoices', iid), search: location.search });
          } : undefined}
          onEditOrder={drawer.type === 'order' ? (oid) => {
            setDrawer(null);
            navigate({ pathname: salesEditPath('orders', oid), search: location.search });
          } : undefined}
        />
      )}

      {/* Modals */}
      {modal === 'customer' && (
        <CustomerModal
          key={customerPrefillLead ? `crm-${customerPrefillLead.id}` : 'cust-new'}
          crmLeadPrefill={customerPrefillLead}
          onClose={() => {
            setModal(null);
            setCustomerPrefillLead(null);
          }}
          onSaved={afterSave}
        />
      )}
      {modal === 'edit-customer' && editCust && (
        <CustomerModal customer={editCust} onClose={() => { setModal(null); setEditCust(null); }} onSaved={afterSave} />
      )}
    </div>
  );
}

// ─── Customers Page ───────────────────────────────────────────

export function SalesCustomersPage() {
  const { show } = useToast();
  const [customers, setCustomers] = useState([]);
  const [modal,     setModal]     = useState(null); // 'new' | 'edit'
  const [editCust,  setEditCust]  = useState(null);
  const [selected,  setSelected]  = useState([]);
  const search = useSearch(customers, ['name','phone','email','gstin','billing_address','shipping_address','address','created_by_name']);
  const pager  = usePagination(search.filtered);
  const cols = [
    { label: 'Name',    get: r => r.name },
    { label: 'Phone',   get: r => r.phone || '' },
    { label: 'Email',   get: r => r.email || '' },
    { label: 'GSTIN',   get: r => r.gstin || '' },
    { label: 'Created by', get: r => r.created_by_name || '' },
    { label: 'Created at', get: r => fmtDT(r.created_at) },
    { label: 'Billing Address', get: r => r.billing_address || r.address || '' },
    { label: 'Shipping Address', get: r => r.shipping_address || '' },
  ];

  const load = useCallback(() => {
    api.get('/sales/customers').then(r => setCustomers(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const afterSave = () => { setModal(null); setEditCust(null); load(); };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-800 dark:text-slate-100">Customers</h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Manage your customer list</p>
        </div>
        <button type="button" className="btn-wf-primary" onClick={() => setModal('new')}>+ Customer</button>
      </div>

      <ListToolbar
        data={search.filtered} cols={cols} title="Customers"
        search={search.q} onSearch={search.setQ}
        selected={selected}
        onDeleteSelected={() => {
          promptDestructive(show, {
            message: `Delete ${selected.length} customer(s)?`,
            onConfirm: async () => {
              await Promise.all(selected.map((cid) => api.delete(`/sales/customers/${cid}`)));
              setSelected([]);
              load();
              show('Deleted successfully', 'success');
            },
          });
        }}
      />

      <div className="bg-white dark:bg-[#13152a] rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
        {pager.slice.length === 0 ? (
          <p className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">No customers yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 dark:border-slate-700/50">
              <th className="px-3 py-3 w-8">
                <input type="checkbox"
                  checked={selected.length === pager.slice.length && pager.slice.length > 0}
                  onChange={e => setSelected(e.target.checked ? pager.slice.map(r => r.id) : [])}
                />
              </th>
              {['Name','Phone','Email','GSTIN','Created by','Created at','Billing Address','Shipping Address',''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
              {pager.slice.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-3 py-3">
                    <input type="checkbox"
                      checked={selected.includes(c.id)}
                      onChange={e => setSelected(p => e.target.checked ? [...p, c.id] : p.filter(x => x !== c.id))}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{c.name}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs font-mono">{c.gstin || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{c.created_by_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{fmtDT(c.created_at)}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs max-w-[180px] truncate">{c.billing_address || c.address || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs max-w-[180px] truncate">{c.shipping_address || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <SettingsDropdown options={[
                      { icon: '✏️', label: 'Edit', onClick: () => { setEditCust(c); setModal('edit'); } },
                      { icon: '🗑', label: 'Delete', danger: true, onClick: () => {
                        promptDestructive(show, {
                          message: 'Delete this customer?',
                          onConfirm: async () => {
                            await api.delete(`/sales/customers/${c.id}`);
                            load();
                            show('Customer deleted successfully', 'success');
                          },
                        });
                      }},
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={pager.page} total={pager.total} count={pager.count} onChange={pager.setPage} />
      </div>

      {modal === 'new'  && <CustomerModal onClose={() => setModal(null)} onSaved={afterSave} />}
      {modal === 'edit' && editCust && <CustomerModal customer={editCust} onClose={() => { setModal(null); setEditCust(null); }} onSaved={afterSave} />}
    </div>
  );
}

// ─── Payment In (invoice receipts ledger) ─────────────────────

export function SalesPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [salesExecutives, setSalesExecutives] = useState([]);
  const [filters, setFilters] = useState({});

  const load = useCallback(() => {
    const params = {};
    if (filters.customer_id) params.customer_id = filters.customer_id;
    if (filters.created_by) params.created_by = filters.created_by;
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    api.get('/sales/payments', { params }).then((r) => setPayments(r.data || [])).catch(() => setPayments([]));
  }, [filters]);

  useEffect(() => {
    api.get('/sales/customers').then((r) => setCustomers(r.data || [])).catch(() => {});
    api.get('/sales/executives').then((r) => setSalesExecutives(r.data || [])).catch(() => setSalesExecutives([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const search = useSearch(payments, ['invoice_number', 'customer_name', 'reference', 'created_by_name']);
  const pager = usePagination(search.filtered);
  const cols = [
    { label: 'Date', get: (p) => fmtD(p.payment_date) },
    { label: 'Reference No.', get: (p) => p.reference || '' },
    { label: 'Invoice #', get: (p) => p.invoice_number },
    { label: 'Customer', get: (p) => p.customer_name },
    { label: 'Paid', get: (p) => fmt(p.amount) },
    { label: 'Method', get: (p) => p.method?.replace('_', ' ') || '' },
    { label: 'Sales executive', get: (p) => p.created_by_name || '' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-800 dark:text-slate-100">Payment In</h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">All recorded invoice payments</p>
        </div>
      </div>

      <FilterBar
        customers={customers}
        users={salesExecutives}
        executiveFilter
        filters={filters}
        onChange={(f) => setFilters(f)}
      />
      <ListToolbar
        data={search.filtered}
        cols={cols}
        title="Payment In"
        search={search.q}
        onSearch={search.setQ}
        selected={[]}
        onDeleteSelected={() => {}}
      />

      <div className="bg-white dark:bg-[#13152a] rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
        {pager.slice.length === 0 ? (
          <p className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">No payments found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700/50">
                  {['Date', 'Reference No.', 'Invoice #', 'Customer', 'Paid', 'Method', 'Sales executive'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                {pager.slice.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 text-xs text-slate-500">{fmtD(p.payment_date)}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500">{p.reference || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-brand-600 dark:text-brand-400">{p.invoice_number}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{p.customer_name}</td>
                    <td className="px-4 py-3 font-semibold font-mono text-xs text-emerald-600 dark:text-emerald-400">{fmt(p.amount)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{p.method?.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{p.created_by_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={pager.page} total={pager.total} count={pager.count} onChange={pager.setPage} />
      </div>
    </div>
  );
}

// ─── Sale Returns Page ────────────────────────────────────────

function ReturnPaymentModal({ ret, onClose, onSaved }) {
  const { show } = useToast();
  const balance = Number(ret.total_amount) - Number(ret.paid_amount || 0);
  const [form, setForm] = useState({ amount: balance.toFixed(2), method: 'bank_transfer', payment_date: '', reference: '' });
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await api.post(`/sales/returns/${ret.id}/payments`, form);
      show('Payment recorded successfully', 'success');
      onSaved();
    } catch (err) {
      show(apiErrorMessage(err, 'Could not record payment'), 'error');
    } finally { setLoading(false); }
  };
  return (
    <Modal title="Make Payment (Return)" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-sm">
          <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Return total</span><span className="font-semibold">{fmt(ret.total_amount)}</span></div>
          <div className="flex justify-between mt-1"><span className="text-slate-500 dark:text-slate-400">Balance</span><span className="font-bold text-amber-600 dark:text-amber-400">{fmt(balance)}</span></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount *"><input type="number" step="0.01" min="0.01" className={inputCls} value={form.amount} onChange={set('amount')} required /></Field>
          <Field label="Payment Date"><input type="date" className={inputCls} value={form.payment_date} onChange={set('payment_date')} /></Field>
        </div>
        <Field label="Method">
          <select className={selectCls} value={form.method} onChange={set('method')}>
            {['bank_transfer','cash','cheque','upi','card','other'].map(m => <option key={m} value={m}>{m.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
          </select>
        </Field>
        <FormActions onCancel={onClose} submitLabel="Make Payment" loading={loading} />
      </form>
    </Modal>
  );
}

export function SalesReturnsPage() {
  const { show } = useToast();
  const [returns,   setReturns]   = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products,  setProducts]  = useState([]);
  const [salesExecutives, setSalesExecutives] = useState([]);
  const [modal,     setModal]     = useState(null); // 'new' | { type: 'pay', ret }
  const [filters,   setFilters]   = useState({});
  const [selected,  setSelected]  = useState([]);

  const search = useSearch(returns, ['return_number','customer_name','reference_no','created_by_name']);
  const pager  = usePagination(search.filtered);
  const cols = [
    { label: 'Number',   get: r => r.return_number },
    { label: 'Customer', get: r => r.customer_name },
    { label: 'Sales executive', get: r => r.created_by_name || '' },
    { label: 'Date',     get: r => fmtD(r.return_date || r.created_at) },
    { label: 'Amount',   get: r => fmt(r.total_amount) },
    { label: 'Status',   get: r => r.status || '' },
  ];

  const load = useCallback(() => {
    const params = {};
    if (filters.customer_id) params.customer_id = filters.customer_id;
    if (filters.created_by) params.created_by = filters.created_by;
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    api.get('/sales/returns', { params }).then(r => setReturns(r.data || [])).catch(() => setReturns([]));
  }, [filters]);

  useEffect(() => {
    load();
    api.get('/sales/customers').then(r => setCustomers(r.data || [])).catch(() => {});
    api.get('/sales/executives').then((r) => setSalesExecutives(r.data || [])).catch(() => setSalesExecutives([]));
    api.get('/inventory/products').then(r => setProducts(r.data.products || r.data || [])).catch(() => {});
  }, [load]);

  const [newForm, setNewForm] = useState({
    customer_id:'', return_date:'', reference_no:'', notes:'', is_interstate: false,
    discount_amount: 0, round_off: 0,
  });
  const [newItems, setNewItems] = useState([{ ...EMPTY_LINE }]);
  const [saving,   setSaving]   = useState(false);
  const setF = k => e => setNewForm(f => ({ ...f, [k]: e.target.value }));

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const lines = newItems.map(calcLine).map(l => ({
        product_id: l.product_id || null, description: l.description,
        quantity: Number(l.quantity), unit_price: Number(l.unit_price),
        discount: Number(l.discount || 0), gst_rate: Number(l.gst_rate),
        cgst: newForm.is_interstate ? 0 : l.gst / 2,
        sgst: newForm.is_interstate ? 0 : l.gst / 2,
        igst: newForm.is_interstate ? l.gst : 0,
        total: l.total,
      }));
      await api.post('/sales/returns', { ...newForm, items: lines });
      setModal(null);
      setNewForm({ customer_id:'', return_date:'', reference_no:'', notes:'', is_interstate: false, discount_amount: 0, round_off: 0 });
      setNewItems([{ ...EMPTY_LINE }]);
      load();
      show('Return created successfully', 'success');
    } catch (err) {
      show(apiErrorMessage(err, 'Could not create return'), 'error');
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-800 dark:text-slate-100">Sale Returns</h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Credit notes and return management</p>
        </div>
        <button type="button" className="btn-wf-primary" onClick={() => setModal('new')}>+ Return</button>
      </div>

      <FilterBar
        customers={customers}
        users={salesExecutives}
        executiveFilter
        filters={filters}
        onChange={(f) => { setFilters(f); setSelected([]); }}
      />
      <ListToolbar
        data={search.filtered} cols={cols} title="Sale Returns"
        search={search.q} onSearch={search.setQ}
        selected={selected}
        onDeleteSelected={() => {
          promptDestructive(show, {
            message: `Delete ${selected.length} return(s)?`,
            onConfirm: async () => {
              await Promise.all(selected.map((rid) => api.delete(`/sales/returns/${rid}`)));
              setSelected([]);
              load();
              show('Deleted successfully', 'success');
            },
          });
        }}
      />

      <div className="bg-white dark:bg-[#13152a] rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
        {pager.slice.length === 0 ? (
          <p className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">No returns found</p>
        ) : (
          <table className="w-full text-sm min-w-[640px]">
            <thead><tr className="border-b border-slate-100 dark:border-slate-700/50">
              <th className="px-3 py-3 w-8">
                <input type="checkbox"
                  checked={selected.length === pager.slice.length && pager.slice.length > 0}
                  onChange={e => setSelected(e.target.checked ? pager.slice.map(r => r.id) : [])}
                />
              </th>
              {['Number','Customer','Sales executive','Date','Amount','Status',''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
              {pager.slice.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-3 py-3">
                    <input type="checkbox"
                      checked={selected.includes(r.id)}
                      onChange={e => setSelected(p => e.target.checked ? [...p, r.id] : p.filter(x => x !== r.id))}
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-600 dark:text-brand-400">{r.return_number || `RET-${r.id}`}</td>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{r.customer_name}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{r.created_by_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{fmtD(r.return_date || r.created_at)}</td>
                  <td className="px-4 py-3 font-semibold font-mono text-slate-800 dark:text-slate-100">{fmt(r.total_amount)}</td>
                  <td className="px-4 py-3"><StatusBadge s={r.status || 'pending'} /></td>
                  <td className="px-4 py-3 text-right">
                    <SettingsDropdown options={[
                      { icon: '₹', label: 'Record Payment', onClick: () => setModal({ type: 'pay', ret: r }) },
                      { icon: '🗑', label: 'Delete', danger: true, onClick: () => {
                        promptDestructive(show, {
                          message: 'Delete this return?',
                          onConfirm: async () => {
                            await api.delete(`/sales/returns/${r.id}`);
                            load();
                            show('Return deleted successfully', 'success');
                          },
                        });
                      }},
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={pager.page} total={pager.total} count={pager.count} onChange={pager.setPage} />
      </div>

      {/* New Return Modal */}
      {modal === 'new' && (
        <Modal title="New Sale Return / Credit Note" onClose={() => setModal(null)} size="xl">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Customer *">
                <select className={selectCls} value={newForm.customer_id} onChange={setF('customer_id')} required>
                  <option value="">Select customer…</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Return Date"><input type="date" className={inputCls} value={newForm.return_date} onChange={setF('return_date')} /></Field>
              <Field label="Reference No."><input className={inputCls} value={newForm.reference_no} onChange={setF('reference_no')} /></Field>
              <Field label="Discount (₹)"><input type="number" min="0" step="0.01" className={inputCls} value={newForm.discount_amount} onChange={setF('discount_amount')} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" checked={newForm.is_interstate} onChange={e => setNewForm(f => ({ ...f, is_interstate: e.target.checked }))} />
              Interstate supply (IGST)
            </label>
            <LineItems items={newItems} onChange={setNewItems} products={products} interstate={newForm.is_interstate} showDiscount />
            <TotalSummary lines={newItems} interstate={newForm.is_interstate} discountAmount={newForm.discount_amount} roundOff={newForm.round_off} />
            <Field label="Notes"><textarea className={inputCls + ' h-16 resize-none'} value={newForm.notes} onChange={setF('notes')} /></Field>
            <FormActions onCancel={() => setModal(null)} submitLabel="Create Return" loading={saving} />
          </form>
        </Modal>
      )}

      {/* Payment Modal */}
      {modal?.type === 'pay' && (
        <ReturnPaymentModal ret={modal.ret} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
    </div>
  );
}
