import { useEffect, useState } from 'react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { apiErrorMessage } from '../../utils/apiErrorMessage';

const EMPTY = {
  product_id: '',
  warehouse_id: '',
  type: 'in',
  quantity: '',
  note: '',
};

export default function InventoryAdjustmentsPage() {
  const { show } = useToast();
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [movements, setMovements] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);

  const load = () => {
    api.get('/inventory/products').then((r) => setProducts(r.data.products || r.data || [])).catch(() => setProducts([]));
    api.get('/inventory/warehouses').then((r) => setWarehouses(r.data.warehouses || r.data || [])).catch(() => setWarehouses([]));
    api.get('/inventory/movements').then((r) => setMovements(r.data.movements || r.data || [])).catch(() => setMovements([]));
  };

  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/inventory/stock/adjust', {
        product_id: Number(form.product_id),
        warehouse_id: Number(form.warehouse_id),
        type: form.type,
        quantity: Number(form.quantity),
        note: form.note || null,
      });
      setForm(EMPTY);
      load();
      show('Stock adjustment saved successfully', 'success');
    } catch (err) {
      show(apiErrorMessage(err, 'Could not save adjustment'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[16px] font-semibold text-slate-800 dark:text-slate-100">Stock Adjustment</h2>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Use type <strong>in</strong> for initial/opening stock, <strong>out</strong> for stock removal.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="bg-white dark:bg-[#1a1d2e] rounded-2xl shadow-card border border-slate-200/80 dark:border-slate-700/50 p-5 grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
      >
        <div>
          <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Product</label>
          <select className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" value={form.product_id} onChange={set('product_id')} required>
            <option value="">Select</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Warehouse</label>
          <select className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" value={form.warehouse_id} onChange={set('warehouse_id')} required>
            <option value="">Select</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Type</label>
          <select className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" value={form.type} onChange={set('type')} required>
            <option value="in">In (initial/add)</option>
            <option value="out">Out (remove)</option>
            <option value="adjustment">Adjustment</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Quantity</label>
          <input type="number" min="0.001" step="0.001" className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" value={form.quantity} onChange={set('quantity')} required />
        </div>
        <button type="submit" className="btn-wf-primary" disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
        <div className="md:col-span-5">
          <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Note</label>
          <input className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" value={form.note} onChange={set('note')} placeholder="Optional remark (e.g. Opening stock)" />
        </div>
      </form>

      <div className="bg-white dark:bg-[#1a1d2e] rounded-2xl shadow-card border border-slate-200/80 dark:border-slate-700/50 p-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">Recent movements</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700/50">
                <th className="px-2 py-2 text-left text-xs uppercase text-slate-500 dark:text-slate-400">When</th>
                <th className="px-2 py-2 text-left text-xs uppercase text-slate-500 dark:text-slate-400">Product</th>
                <th className="px-2 py-2 text-left text-xs uppercase text-slate-500 dark:text-slate-400">Warehouse</th>
                <th className="px-2 py-2 text-left text-xs uppercase text-slate-500 dark:text-slate-400">Type</th>
                <th className="px-2 py-2 text-right text-xs uppercase text-slate-500 dark:text-slate-400">Qty</th>
                <th className="px-2 py-2 text-left text-xs uppercase text-slate-500 dark:text-slate-400">Note</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 dark:border-slate-700/30 last:border-b-0">
                  <td className="px-2 py-2">{m.created_at ? new Date(m.created_at).toLocaleString() : '—'}</td>
                  <td className="px-2 py-2">{m.product_name || '—'}</td>
                  <td className="px-2 py-2">{m.warehouse_name || '—'}</td>
                  <td className="px-2 py-2">{m.type || '—'}</td>
                  <td className="px-2 py-2 text-right">{Number(m.quantity || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })}</td>
                  <td className="px-2 py-2">{m.note || '—'}</td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-8 text-center text-slate-400 dark:text-slate-500">No movements yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

