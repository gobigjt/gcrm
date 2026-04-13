import { useEffect, useState, useCallback } from 'react';
import api from '../../api/client';
import Modal from '../../components/Modal';
import Tabs  from '../../components/Tabs';
import { Field, inputCls, selectCls, FormActions } from '../../components/FormField';
import { useToast } from '../../context/ToastContext';
import { apiErrorMessage } from '../../utils/apiErrorMessage';
import { promptDestructive } from '../../utils/promptDestructive';

// ─── Helpers ─────────────────────────────────────────────────

const fmt  = n  => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtD = dt => dt ? new Date(dt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';

const STATUS_CLS = {
  draft:     'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  sent:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  approved:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  received:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  partial:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  cancelled: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  paid:      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  unpaid:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};
const StatusBadge = ({ s }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CLS[s] || STATUS_CLS.draft}`}>{s}</span>
);

const StatCard = ({ icon, label, value }) => (
  <div className="bg-white dark:bg-[#1a1d2e] rounded-2xl border border-slate-200/80 dark:border-slate-700/50 shadow-card p-4 flex items-center gap-3">
    <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-lg flex-shrink-0">{icon}</div>
    <div>
      <p className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-none">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
    </div>
  </div>
);

// ─── PO Line Item Editor ──────────────────────────────────────

const EMPTY_LINE = { product_id: '', quantity: 1, unit_price: 0, gst_rate: 0 };

function calcLine(l) {
  const base = Number(l.quantity) * Number(l.unit_price);
  const gst  = base * Number(l.gst_rate) / 100;
  return { ...l, base, gst, total: base + gst };
}

function POLineItems({ items, onChange, products }) {
  const lines    = items.map(calcLine);
  const subtotal = lines.reduce((s, l) => s + l.base, 0);
  const totalGst = lines.reduce((s, l) => s + l.gst, 0);

  const update = (i, key, val) => {
    const next = items.map((l, idx) => idx === i ? { ...l, [key]: val } : l);
    if (key === 'product_id') {
      const p = products.find(p => String(p.id) === String(val));
      if (p) next[i] = { ...next[i], unit_price: Number(p.purchase_price || p.sale_price), gst_rate: Number(p.gst_rate) };
    }
    onChange(next);
  };

  const th = 'px-2 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide';
  const td = 'px-2 py-1.5';

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/50">
        <table className="w-full text-sm min-w-[480px]">
          <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/50">
            <tr>
              <th className={th} style={{width:'35%'}}>Product</th>
              <th className={th} style={{width:'10%'}}>Qty</th>
              <th className={th} style={{width:'16%'}}>Unit Price</th>
              <th className={th} style={{width:'10%'}}>GST%</th>
              <th className={th} style={{width:'16%'}}>Total</th>
              <th className={th} style={{width:'5%'}}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
            {lines.map((l, i) => (
              <tr key={i}>
                <td className={td}>
                  <select className={selectCls} value={l.product_id} onChange={e => update(i, 'product_id', e.target.value)}>
                    <option value="">— Select —</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </td>
                <td className={td}><input type="number" min="0.001" step="0.001" className={inputCls+' w-16'} value={l.quantity} onChange={e => update(i,'quantity',e.target.value)} /></td>
                <td className={td}><input type="number" min="0" step="0.01" className={inputCls+' w-24'} value={l.unit_price} onChange={e => update(i,'unit_price',e.target.value)} /></td>
                <td className={td}><input type="number" min="0" max="28" step="0.5" className={inputCls+' w-14'} value={l.gst_rate} onChange={e => update(i,'gst_rate',e.target.value)} /></td>
                <td className={td+' text-right font-semibold font-mono text-xs text-slate-800 dark:text-slate-100'}>{fmt(l.total)}</td>
                <td className={td}>
                  <button type="button" onClick={() => onChange(items.filter((_,idx)=>idx!==i))}
                    className="text-slate-300 dark:text-slate-600 hover:text-red-500 text-lg leading-none">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => onChange([...items, {...EMPTY_LINE}])}
        className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium">+ Add item</button>
      <div className="flex justify-end">
        <div className="w-48 space-y-1 text-sm">
          <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>Subtotal</span><span className="font-mono">{fmt(subtotal)}</span></div>
          <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>GST</span><span className="font-mono">{fmt(totalGst)}</span></div>
          <div className="flex justify-between font-bold text-slate-800 dark:text-slate-100 border-t border-slate-200 dark:border-slate-700 pt-1">
            <span>Total</span><span className="font-mono">{fmt(subtotal + totalGst)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Vendor Modal ─────────────────────────────────────────────

function VendorModal({ vendor, onClose, onSaved }) {
  const { show } = useToast();
  const [form, setForm] = useState(vendor || { name:'', email:'', phone:'', gstin:'', address:'' });
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      vendor ? await api.patch(`/purchase/vendors/${vendor.id}`, form)
             : await api.post('/purchase/vendors', form);
      show(vendor ? 'Vendor updated' : 'Vendor created', 'success');
      onSaved();
    } catch (err) {
      show(apiErrorMessage(err, 'Could not save vendor'), 'error');
    } finally { setLoading(false); }
  };

  return (
    <Modal title={vendor ? 'Edit Vendor' : 'New Vendor'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Name *"><input className={inputCls} value={form.name} onChange={set('name')} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><input className={inputCls} value={form.phone||''} onChange={set('phone')} /></Field>
          <Field label="Email"><input className={inputCls} type="email" value={form.email||''} onChange={set('email')} /></Field>
        </div>
        <Field label="GSTIN"><input className={inputCls} value={form.gstin||''} onChange={set('gstin')} placeholder="22AAAAA0000A1Z5" /></Field>
        <Field label="Address"><textarea className={inputCls+' h-16 resize-none'} value={form.address||''} onChange={set('address')} /></Field>
        <FormActions onCancel={onClose} submitLabel={vendor ? 'Save' : 'Add Vendor'} loading={loading} />
      </form>
    </Modal>
  );
}

// ─── PO Modal ─────────────────────────────────────────────────

function POModal({ vendors, products, onClose, onSaved }) {
  const { show } = useToast();
  const [form,  setForm]  = useState({ vendor_id:'', order_date:'', expected_date:'', notes:'' });
  const [items, setItems] = useState([{ ...EMPTY_LINE }]);
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const lines = items.map(calcLine).map(l => ({
        product_id: l.product_id, quantity: Number(l.quantity),
        unit_price: Number(l.unit_price), gst_rate: Number(l.gst_rate), total: l.total,
      }));
      await api.post('/purchase/pos', { ...form, items: lines });
      show('Purchase order created', 'success');
      onSaved();
    } catch (err) {
      show(apiErrorMessage(err, 'Could not create PO'), 'error');
    } finally { setLoading(false); }
  };

  return (
    <Modal title="New Purchase Order" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Vendor *">
          <select className={selectCls} value={form.vendor_id} onChange={set('vendor_id')} required>
            <option value="">Select vendor…</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Order Date"><input type="date" className={inputCls} value={form.order_date} onChange={set('order_date')} /></Field>
          <Field label="Expected Delivery"><input type="date" className={inputCls} value={form.expected_date} onChange={set('expected_date')} /></Field>
        </div>
        <POLineItems items={items} onChange={setItems} products={products} />
        <Field label="Notes"><textarea className={inputCls+' h-16 resize-none'} value={form.notes} onChange={set('notes')} /></Field>
        <FormActions onCancel={onClose} submitLabel="Create PO" loading={loading} />
      </form>
    </Modal>
  );
}

// ─── GRN Modal ────────────────────────────────────────────────

function GRNModal({ openPOs, products, onClose, onSaved }) {
  const { show } = useToast();
  const [form,  setForm]  = useState({ po_id:'', notes:'' });
  const [items, setItems] = useState([{ product_id:'', quantity:1, warehouse_id:1 }]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    api.get('/inventory/warehouses').then(r => setWarehouses(r.data || [])).catch(() => setWarehouses([{ id:1, name:'Main Warehouse' }]));
  }, []);

  // Pre-fill items from selected PO
  useEffect(() => {
    if (!form.po_id) return;
    api.get(`/purchase/pos/${form.po_id}`).then(r => {
      const po = r.data.po;
      if (po?.items?.length) {
        setItems(po.items.map(i => ({ product_id: String(i.product_id), quantity: i.quantity, warehouse_id: warehouses[0]?.id || 1 })));
      }
    }).catch(() => {});
  }, [form.po_id]);

  const updateItem = (i, k, v) => setItems(prev => prev.map((l, idx) => idx === i ? { ...l, [k]: v } : l));

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await api.post('/purchase/grns', { ...form, items });
      show('GRN saved', 'success');
      onSaved();
    } catch (err) {
      show(apiErrorMessage(err, 'Could not save GRN'), 'error');
    } finally { setLoading(false); }
  };

  return (
    <Modal title="Receive Goods (GRN)" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Purchase Order *">
          <select className={selectCls} value={form.po_id} onChange={set('po_id')} required>
            <option value="">Select PO…</option>
            {openPOs.map(p => <option key={p.id} value={p.id}>{p.po_number} — {p.vendor_name}</option>)}
          </select>
        </Field>

        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Items to Receive</p>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-3 gap-2 items-end">
                <Field label="Product">
                  <select className={selectCls} value={it.product_id} onChange={e => updateItem(i,'product_id',e.target.value)} required>
                    <option value="">—</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
                <Field label="Qty">
                  <input type="number" min="0.001" step="0.001" className={inputCls} value={it.quantity}
                    onChange={e => updateItem(i,'quantity',e.target.value)} required />
                </Field>
                <Field label="Warehouse">
                  <select className={selectCls} value={it.warehouse_id} onChange={e => updateItem(i,'warehouse_id',e.target.value)}>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </Field>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setItems(p => [...p, { product_id:'', quantity:1, warehouse_id: warehouses[0]?.id || 1 }])}
            className="text-xs text-brand-600 dark:text-brand-400 hover:underline mt-1">+ Add row</button>
        </div>

        <Field label="Notes"><textarea className={inputCls+' h-14 resize-none'} value={form.notes} onChange={set('notes')} /></Field>
        <FormActions onCancel={onClose} submitLabel="Receive Goods" loading={loading} />
      </form>
    </Modal>
  );
}

// ─── PO Detail Drawer ─────────────────────────────────────────

function PODrawer({ id, onClose, onRefresh }) {
  const { show } = useToast();
  const [po, setPO] = useState(null);
  const load = useCallback(() => { api.get(`/purchase/pos/${id}`).then(r => setPO(r.data.po)); }, [id]);
  useEffect(() => { load(); }, [load]);

  const changeStatus = async (status) => {
    try {
      await api.patch(`/purchase/pos/${id}`, { status });
      load();
      onRefresh();
      show('PO status updated', 'success');
    } catch (err) {
      show(apiErrorMessage(err, 'Could not update status'), 'error');
    }
  };

  if (!po) return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1" onClick={onClose} />
      <div className="w-full max-w-md bg-white dark:bg-[#13152a] flex items-center justify-center border-l border-slate-200 dark:border-slate-700">
        <p className="text-slate-400">Loading…</p>
      </div>
    </div>
  );

  const STATUSES = ['draft','sent','approved','received','cancelled'];

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md bg-white dark:bg-[#13152a] shadow-2xl flex flex-col border-l border-slate-200/80 dark:border-slate-700/50 overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700/50 flex-shrink-0">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{po.po_number}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{po.vendor_name}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge s={po.status} />
              <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xl px-1">×</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map(s => (
              <button key={s} onClick={() => changeStatus(s)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${po.status === s
                  ? `${STATUS_CLS[s] || STATUS_CLS.draft} border-current`
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400'}`}>
                {s.charAt(0).toUpperCase()+s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[['Order Date', fmtD(po.order_date)], ['Expected', fmtD(po.expected_date)], ['Total', fmt(po.total_amount)], ['Status', po.status]].map(([k,v]) => (
              <div key={k} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2">
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">{k}</p>
                <p className="font-semibold text-slate-700 dark:text-slate-200">{v}</p>
              </div>
            ))}
          </div>

          {po.items?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Line Items</p>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>{['Product','Qty','Price','Total'].map(h=><th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                    {po.items.map((it,i)=>(
                      <tr key={i}>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{it.product_name}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{it.quantity}</td>
                        <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">{fmt(it.unit_price)}</td>
                        <td className="px-3 py-2 font-semibold font-mono text-slate-800 dark:text-slate-100">{fmt(it.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {po.notes && (
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-800/30 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Notes</p>
              <p className="text-sm text-amber-800 dark:text-amber-300">{po.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Purchase Page ───────────────────────────────────────

const TABS = ['Vendors', 'Purchase Orders', 'GRNs'];

export default function Purchase() {
  const { show } = useToast();
  const [tab,      setTab]      = useState('Vendors');
  const [data,     setData]     = useState([]);
  const [stats,    setStats]    = useState(null);
  const [vendors,  setVendors]  = useState([]);
  const [openPOs,  setOpenPOs]  = useState([]);
  const [products, setProducts] = useState([]);
  const [modal,    setModal]    = useState(null); // 'vendor' | 'edit-vendor' | 'po' | 'grn'
  const [editV,    setEditV]    = useState(null);
  const [drawer,   setDrawer]   = useState(null);
  const [search,   setSearch]   = useState('');

  const loadStats = useCallback(() => { api.get('/purchase/stats').then(r => setStats(r.data)).catch(()=>{}); }, []);
  const loadData  = useCallback(() => {
    const paths = { Vendors:'/purchase/vendors', 'Purchase Orders':'/purchase/pos', GRNs:'/purchase/grns' };
    const params = tab === 'Vendors' && search ? { search } : {};
    api.get(paths[tab], { params }).then(r => setData(r.data || [])).catch(() => setData([]));
  }, [tab, search]);

  useEffect(() => {
    api.get('/inventory/products').then(r => setProducts(r.data.products || r.data || [])).catch(()=>{});
    api.get('/purchase/vendors').then(r => setVendors(r.data || [])).catch(()=>{});
    api.get('/purchase/pos').then(r => setOpenPOs((r.data || []).filter(p => !['received','cancelled'].includes(p.status)))).catch(()=>{});
    loadStats();
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDelete = (type, id, e) => {
    e.stopPropagation();
    promptDestructive(show, {
      message: 'Delete this record?',
      onConfirm: async () => {
        await api.delete(`/purchase/${type}/${id}`);
        loadData();
        loadStats();
        show('Deleted', 'success');
      },
    });
  };

  const afterSave = () => {
    setModal(null); setEditV(null); loadData(); loadStats();
    api.get('/purchase/vendors').then(r => setVendors(r.data || []));
    api.get('/purchase/pos').then(r => setOpenPOs((r.data||[]).filter(p=>!['received','cancelled'].includes(p.status))));
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">Purchase</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Vendors · Purchase Orders · Goods Receipt</p>
        </div>
        <button onClick={() => setModal(tab === 'Vendors' ? 'vendor' : tab === 'Purchase Orders' ? 'po' : 'grn')}
          className="btn-wf-primary text-sm px-4 py-2 rounded-xl shadow-sm transition-all active:scale-[0.98]">
          + {tab === 'Vendors' ? 'Vendor' : tab === 'Purchase Orders' ? 'Purchase Order' : 'Receive Goods'}
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatCard icon="🏭" label="Active Vendors"    value={stats.vendors} />
          <StatCard icon="📋" label="Pending POs"       value={stats.pending_pos} />
          <StatCard icon="💰" label="Total PO Value"    value={fmt(stats.total_po_value)} />
          <StatCard icon="📦" label="GRNs This Month"   value={stats.grns_this_month} />
        </div>
      )}

      <Tabs tabs={TABS} active={tab} onChange={t => { setTab(t); setSearch(''); }} />

      {tab === 'Vendors' && (
        <div className="mb-4">
          <input className={inputCls+' max-w-sm'} placeholder="Search vendors…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-[#1a1d2e] rounded-2xl border border-slate-200/80 dark:border-slate-700/50 shadow-card overflow-hidden">
        {data.length === 0 ? (
          <p className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">No records found</p>
        ) : tab === 'Vendors' ? (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 dark:border-slate-700/50">
              {['Name','Phone','Email','GSTIN',''].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
              {data.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 group">
                  <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{r.name}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.phone||'—'}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.email||'—'}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">{r.gstin||'—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditV(r); setModal('edit-vendor'); }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors text-xs">✏️</button>
                      <button onClick={e => handleDelete('vendors', r.id, e)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-xs">🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === 'Purchase Orders' ? (
          <table className="w-full text-sm min-w-[520px]">
            <thead><tr className="border-b border-slate-100 dark:border-slate-700/50">
              {['PO Number','Vendor','Status','Order Date','Expected','Total',''].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
              {data.map(r => (
                <tr key={r.id} onClick={() => setDrawer(r.id)} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer group">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-600 dark:text-brand-400">{r.po_number}</td>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{r.vendor_name}</td>
                  <td className="px-4 py-3"><StatusBadge s={r.status} /></td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{fmtD(r.order_date)}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{fmtD(r.expected_date)}</td>
                  <td className="px-4 py-3 font-semibold font-mono text-slate-800 dark:text-slate-100">{fmt(r.total_amount)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e=>e.stopPropagation()}>
                      <button onClick={e => handleDelete('pos', r.id, e)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-xs">🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 dark:border-slate-700/50">
              {['GRN Number','PO Number','Vendor','Received At'].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
              {data.map(r=>(
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-600 dark:text-brand-400">{r.grn_number}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.po_number}</td>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{r.vendor_name}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{fmtD(r.received_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {modal === 'vendor'      && <VendorModal onClose={() => setModal(null)} onSaved={afterSave} />}
      {modal === 'edit-vendor' && editV && <VendorModal vendor={editV} onClose={() => { setModal(null); setEditV(null); }} onSaved={afterSave} />}
      {modal === 'po'  && <POModal  vendors={vendors}  products={products} onClose={() => setModal(null)} onSaved={afterSave} />}
      {modal === 'grn' && <GRNModal openPOs={openPOs} products={products} onClose={() => setModal(null)} onSaved={afterSave} />}

      {/* PO Detail drawer */}
      {drawer && <PODrawer id={drawer} onClose={() => setDrawer(null)} onRefresh={() => { loadData(); loadStats(); }} />}
    </div>
  );
}
