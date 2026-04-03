import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import Modal from '../../components/Modal';
import Tabs  from '../../components/Tabs';
import { Field, inputCls, selectCls, FormActions } from '../../components/FormField';

// ─── Helpers ─────────────────────────────────────────────────

const fmt  = n  => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtD = dt => dt ? new Date(dt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';

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
};
const StatusBadge = ({ s }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CLS[s] || STATUS_CLS.draft}`}>{s}</span>
);

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

// ─── Line Items Editor ────────────────────────────────────────

const EMPTY_LINE = { product_id: '', description: '', quantity: 1, unit_price: 0, gst_rate: 0 };

function calcLine(l) {
  const base = Number(l.quantity) * Number(l.unit_price);
  const gst  = base * Number(l.gst_rate) / 100;
  return { ...l, base, gst, total: base + gst };
}

function LineItems({ items, onChange, products, interstate = false }) {
  const lines = items.map(calcLine);
  const subtotal = lines.reduce((s, l) => s + l.base, 0);
  const totalGst = lines.reduce((s, l) => s + l.gst, 0);
  const cgst = interstate ? 0 : totalGst / 2;
  const sgst = interstate ? 0 : totalGst / 2;
  const igst = interstate ? totalGst : 0;
  const grandTotal = subtotal + totalGst;

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
              <th className={th} style={{width:'8%'}}>Qty</th>
              <th className={th} style={{width:'14%'}}>Unit Price</th>
              <th className={th} style={{width:'8%'}}>GST%</th>
              <th className={th} style={{width:'14%'}}>Taxable</th>
              <th className={th} style={{width:'14%'}}>Total</th>
              <th className={th} style={{width:'4%'}}></th>
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
                  <input type="number" min="0.01" step="0.01" className={inputCls + ' w-16'} value={l.quantity}
                    onChange={e => update(i, 'quantity', e.target.value)} />
                </td>
                <td className={td}>
                  <input type="number" min="0" step="0.01" className={inputCls + ' w-24'} value={l.unit_price}
                    onChange={e => update(i, 'unit_price', e.target.value)} />
                </td>
                <td className={td}>
                  <input type="number" min="0" max="28" step="0.5" className={inputCls + ' w-14'} value={l.gst_rate}
                    onChange={e => update(i, 'gst_rate', e.target.value)} />
                </td>
                <td className={td + ' text-right text-slate-600 dark:text-slate-300 font-mono text-xs'}>{fmt(l.base)}</td>
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

function CustomerModal({ customer, onClose, onSaved }) {
  const [form, setForm] = useState(customer || { name:'', email:'', phone:'', gstin:'', address:'' });
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      customer ? await api.patch(`/sales/customers/${customer.id}`, form)
                : await api.post('/sales/customers', form);
      onSaved();
    } finally { setLoading(false); }
  };

  return (
    <Modal title={customer ? 'Edit Customer' : 'New Customer'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Name *"><input className={inputCls} value={form.name} onChange={set('name')} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><input className={inputCls} value={form.phone||''} onChange={set('phone')} /></Field>
          <Field label="Email"><input className={inputCls} type="email" value={form.email||''} onChange={set('email')} /></Field>
        </div>
        <Field label="GSTIN"><input className={inputCls} value={form.gstin||''} onChange={set('gstin')} placeholder="22AAAAA0000A1Z5" /></Field>
        <Field label="Address"><textarea className={inputCls+' h-16 resize-none'} value={form.address||''} onChange={set('address')} /></Field>
        <FormActions onCancel={onClose} submitLabel={customer ? 'Save' : 'Add Customer'} loading={loading} />
      </form>
    </Modal>
  );
}

// ─── Document Modal (Quotation / Order / Invoice) ─────────────

function DocumentModal({ type, customers, products, onClose, onSaved }) {
  const isQuote   = type === 'quotation';
  const isOrder   = type === 'order';
  const isInvoice = type === 'invoice';

  const [form, setForm] = useState({
    customer_id: '', valid_until: '', order_date: '', invoice_date: '', due_date: '',
    notes: '', is_interstate: false,
  });
  const [items, setItems]       = useState([{ ...EMPTY_LINE }]);
  const [totals, setTotals]     = useState({ subtotal:0, cgst:0, sgst:0, igst:0, total:0 });
  const [loading, setLoading]   = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleItems = (newItems, newTotals) => {
    setItems(newItems);
    if (Object.keys(newTotals).length) setTotals(t => ({ ...t, ...newTotals }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const lines = items.map(calcLine).map(l => ({
        product_id:  l.product_id || null,
        description: l.description,
        quantity:    Number(l.quantity),
        unit_price:  Number(l.unit_price),
        gst_rate:    Number(l.gst_rate),
        cgst:        form.is_interstate ? 0 : l.gst / 2,
        sgst:        form.is_interstate ? 0 : l.gst / 2,
        igst:        form.is_interstate ? l.gst : 0,
        total:       l.total,
      }));
      const endpoint = isQuote ? '/sales/quotations' : isOrder ? '/sales/orders' : '/sales/invoices';
      await api.post(endpoint, { ...form, items: lines });
      onSaved();
    } finally { setLoading(false); }
  };

  const title = isQuote ? 'New Quotation' : isOrder ? 'New Sales Order' : 'New Invoice';

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Customer *">
          <select className={selectCls} value={form.customer_id} onChange={set('customer_id')} required>
            <option value="">Select customer…</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          {isQuote && <Field label="Valid Until"><input type="date" className={inputCls} value={form.valid_until} onChange={set('valid_until')} /></Field>}
          {isOrder && <Field label="Order Date"><input type="date" className={inputCls} value={form.order_date} onChange={set('order_date')} /></Field>}
          {isInvoice && (
            <>
              <Field label="Invoice Date"><input type="date" className={inputCls} value={form.invoice_date} onChange={set('invoice_date')} /></Field>
              <Field label="Due Date"><input type="date" className={inputCls} value={form.due_date} onChange={set('due_date')} /></Field>
            </>
          )}
        </div>

        {isInvoice && (
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" checked={form.is_interstate}
              onChange={e => setForm(f => ({ ...f, is_interstate: e.target.checked }))} />
            Interstate supply (IGST instead of CGST+SGST)
          </label>
        )}

        <LineItems items={items} onChange={handleItems} products={products} interstate={form.is_interstate} />

        <Field label="Notes"><textarea className={inputCls+' h-16 resize-none'} value={form.notes} onChange={set('notes')} /></Field>
        <FormActions onCancel={onClose} submitLabel={`Create ${title.replace('New ','')}`} loading={loading} />
      </form>
    </Modal>
  );
}

// ─── Payment Modal ────────────────────────────────────────────

function PaymentModal({ invoice, onClose, onSaved }) {
  const balance = Number(invoice.total_amount) - (invoice.payments || []).reduce((s, p) => s + Number(p.amount), 0);
  const [form, setForm] = useState({ amount: balance.toFixed(2), method: 'bank_transfer', payment_date: '', reference: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await api.post(`/sales/invoices/${invoice.id}/payments`, form);
      onSaved();
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

function DetailDrawer({ type, id, onClose, onRefresh }) {
  const [doc,     setDoc]     = useState(null);
  const [paying,  setPaying]  = useState(false);

  const load = useCallback(() => {
    const path = { quotation:'/sales/quotations', order:'/sales/orders', invoice:'/sales/invoices' }[type];
    api.get(`${path}/${id}`).then(r => setDoc(r.data.quotation || r.data.order || r.data.invoice || r.data));
  }, [type, id]);

  useEffect(() => { load(); }, [load]);

  const changeStatus = async (status) => {
    const path = { quotation:'/sales/quotations', order:'/sales/orders' }[type];
    if (!path) return;
    await api.patch(`${path}/${id}`, { status });
    load(); onRefresh();
  };

  if (!doc) return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1" onClick={onClose} />
      <div className="w-full max-w-lg bg-white dark:bg-[#13152a] flex items-center justify-center border-l border-slate-200 dark:border-slate-700">
        <p className="text-slate-400 text-sm">Loading…</p>
      </div>
    </div>
  );

  const QUOTE_STATUSES = ['draft','sent','accepted','rejected'];
  const ORDER_STATUSES = ['pending','confirmed','processing','delivered','cancelled'];
  const statuses = type === 'quotation' ? QUOTE_STATUSES : type === 'order' ? ORDER_STATUSES : [];

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-lg bg-white dark:bg-[#13152a] shadow-2xl flex flex-col border-l border-slate-200/80 dark:border-slate-700/50 overflow-hidden">

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
              ['Date',       fmtD(doc.invoice_date || doc.order_date || doc.created_at)],
              ['Due / Valid', fmtD(doc.due_date || doc.valid_until)],
              ['Amount',      fmt(doc.total_amount)],
              ['Status',     doc.status],
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

              {/* Tax summary */}
              <div className="mt-3 flex justify-end">
                <div className="w-52 space-y-1 text-sm">
                  {doc.subtotal    != null && <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>Subtotal</span><span className="font-mono">{fmt(doc.subtotal)}</span></div>}
                  {Number(doc.cgst)  > 0 && <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>CGST</span><span className="font-mono">{fmt(doc.cgst)}</span></div>}
                  {Number(doc.sgst)  > 0 && <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>SGST</span><span className="font-mono">{fmt(doc.sgst)}</span></div>}
                  {Number(doc.igst)  > 0 && <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>IGST</span><span className="font-mono">{fmt(doc.igst)}</span></div>}
                  <div className="flex justify-between font-bold text-slate-800 dark:text-slate-100 border-t border-slate-200 dark:border-slate-700 pt-1">
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
    </div>
  );
}

// ─── Main Sales Page ──────────────────────────────────────────

const TABS = ['Customers', 'Quotations', 'Orders', 'Invoices'];

const SALES_TAB_BY_PARAM = {
  customers: 'Customers',
  quotations: 'Quotations',
  orders: 'Orders',
  invoices: 'Invoices',
  payments: 'Invoices',
};

export default function Sales() {
  const [searchParams] = useSearchParams();
  const [tab,       setTab]       = useState('Customers');
  const [data,      setData]      = useState([]);
  const [stats,     setStats]     = useState(null);
  const [products,  setProducts]  = useState([]);
  const [customers, setCustomers] = useState([]);
  const [modal,     setModal]     = useState(null); // 'customer' | 'quotation' | 'order' | 'invoice' | 'edit-customer'
  const [editCust,  setEditCust]  = useState(null);
  const [drawer,    setDrawer]    = useState(null); // { type, id }
  const [search,    setSearch]    = useState('');

  const loadStats   = useCallback(() => { api.get('/sales/stats').then(r => setStats(r.data)).catch(() => {}); }, []);
  const loadData    = useCallback(() => {
    const paths = { Customers:'/sales/customers', Quotations:'/sales/quotations', Orders:'/sales/orders', Invoices:'/sales/invoices' };
    const params = tab === 'Customers' && search ? { search } : {};
    api.get(paths[tab], { params }).then(r => setData(r.data || [])).catch(() => setData([]));
  }, [tab, search]);

  useEffect(() => {
    api.get('/inventory/products').then(r => setProducts(r.data.products || r.data || [])).catch(() => {});
    api.get('/sales/customers').then(r => setCustomers(r.data || [])).catch(() => {});
    loadStats();
  }, []);

  useEffect(() => {
    const raw = (searchParams.get('tab') || '').toLowerCase().replace(/[\s_-]+/g, '');
    const mapped = SALES_TAB_BY_PARAM[raw];
    if (mapped) setTab(mapped);
    else if (!searchParams.get('tab')) setTab('Customers');
  }, [searchParams]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDelete = async (type, id, e) => {
    e.stopPropagation();
    if (!confirm('Delete this record?')) return;
    await api.delete(`/sales/${type}/${id}`);
    loadData(); loadStats();
  };

  const afterSave = () => { setModal(null); setEditCust(null); loadData(); loadStats(); if (tab === 'Customers') api.get('/sales/customers').then(r => setCustomers(r.data || [])); };

  const tabType = { Quotations:'quotation', Orders:'order', Invoices:'invoice' };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-800 dark:text-slate-100">Sales</h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Customers, quotations, orders and invoices</p>
        </div>
        <button
          onClick={() => setModal(tab === 'Customers' ? 'customer' : tabType[tab])}
          className="btn-wf-primary"
        >
          + {tab === 'Customers' ? 'Customer' : tab.slice(0,-1)}
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard icon="👥" label="Active Customers"  value={stats.customers}            />
          <StatCard icon="📦" label="Open Orders"       value={stats.open_orders}          />
          <StatCard icon="💰" label="Revenue (Paid)"    value={fmt(stats.revenue)}         />
          <StatCard icon="⏳" label="Receivable"        value={fmt(stats.receivable)} sub={stats.overdue ? `${stats.overdue} overdue` : null} />
        </div>
      )}

      <Tabs tabs={TABS} active={tab} onChange={t => { setTab(t); setSearch(''); }} />

      {/* Search (customers only) */}
      {tab === 'Customers' && (
        <div className="mb-4">
          <input className={inputCls + ' max-w-sm'} placeholder="Search customers…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-[#13152a] rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
        {data.length === 0 ? (
          <p className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">No records found</p>
        ) : tab === 'Customers' ? (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 dark:border-slate-700/50">
              {['Name','Phone','Email','GSTIN',''].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
              {data.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 group">
                  <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{r.name}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.phone || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.email || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">{r.gstin || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditCust(r); setModal('edit-customer'); }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors text-xs">✏️</button>
                      <button onClick={e => handleDelete('customers', r.id, e)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-xs">🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm min-w-[560px]">
            <thead><tr className="border-b border-slate-100 dark:border-slate-700/50">
              {['Number','Customer','Status','Date','Amount',''].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
              {data.map(r => {
                const num  = r.invoice_number || r.quotation_number || r.order_number;
                const date = r.invoice_date || r.order_date || r.created_at;
                const type = tabType[tab];
                return (
                  <tr key={r.id} onClick={() => setDrawer({ type, id: r.id })}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer group">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-600 dark:text-brand-400">{num}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{r.customer_name}</td>
                    <td className="px-4 py-3"><StatusBadge s={r.status} /></td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{fmtD(date)}</td>
                    <td className="px-4 py-3 font-semibold font-mono text-slate-800 dark:text-slate-100">{fmt(r.total_amount)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <button onClick={e => handleDelete(type+'s', r.id, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-xs">🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {modal === 'customer' && <CustomerModal onClose={() => setModal(null)} onSaved={afterSave} />}
      {modal === 'edit-customer' && editCust && <CustomerModal customer={editCust} onClose={() => { setModal(null); setEditCust(null); }} onSaved={afterSave} />}
      {(modal === 'quotation' || modal === 'order' || modal === 'invoice') && (
        <DocumentModal type={modal} customers={customers} products={products} onClose={() => setModal(null)} onSaved={afterSave} />
      )}

      {/* Detail drawer */}
      {drawer && (
        <DetailDrawer type={drawer.type} id={drawer.id} onClose={() => setDrawer(null)} onRefresh={() => { loadData(); loadStats(); }} />
      )}
    </div>
  );
}
