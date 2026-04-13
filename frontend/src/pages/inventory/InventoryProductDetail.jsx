import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/client';

function imgSrc(path) {
  if (!path) return '';
  const s = String(path);
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (s.startsWith('/uploads/')) return s;
  return s;
}

export default function InventoryProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [stockRows, setStockRows] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [adjLoading, setAdjLoading] = useState(false);
  const [adjForm, setAdjForm] = useState({
    mode: 'initial', // initial | add | remove
    warehouse_id: '',
    quantity: '',
    note: '',
  });

  const loadStock = () => {
    api.get(`/inventory/products/${id}/stock`)
      .then((r) => setStockRows(r.data.stock || r.data || []))
      .catch(() => setStockRows([]));
  };

  useEffect(() => {
    api.get(`/inventory/products/${id}`)
      .then((r) => setProduct(r.data?.product || r.data || null))
      .catch(() => setProduct(null));
    loadStock();
    api.get('/inventory/warehouses')
      .then((r) => setWarehouses(r.data.warehouses || r.data || []))
      .catch(() => setWarehouses([]));
  }, [id]);

  if (!product) {
    return <div className="text-sm text-slate-500 dark:text-slate-300">Loading product...</div>;
  }

  const submitAdjustment = async (e) => {
    e.preventDefault();
    const qty = Number(adjForm.quantity);
    if (!adjForm.warehouse_id || !Number.isFinite(qty) || qty <= 0) return;
    setAdjLoading(true);
    try {
      const type = adjForm.mode === 'remove' ? 'out' : 'in';
      const prefix = adjForm.mode === 'initial' ? '[INITIAL STOCK] ' : '';
      await api.post('/inventory/stock/adjust', {
        product_id: Number(id),
        warehouse_id: Number(adjForm.warehouse_id),
        type,
        quantity: qty,
        note: `${prefix}${adjForm.note || ''}`.trim() || null,
      });
      setAdjForm((f) => ({ ...f, quantity: '', note: '' }));
      loadStock();
      const refreshed = await api.get(`/inventory/products/${id}`);
      setProduct(refreshed.data?.product || refreshed.data || null);
    } finally {
      setAdjLoading(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-800 dark:text-slate-100">{product.name}</h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Product details</p>
        </div>
        <div className="flex items-center gap-2">
          <Link className="btn-wf-secondary" to={`/inventory/products/${id}/edit`}>Edit</Link>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a1d2e] rounded-2xl shadow-card border border-slate-200/80 dark:border-slate-700/50 p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            {product.image_url ? (
              <img src={imgSrc(product.image_url)} alt={product.name} className="w-full max-w-[240px] rounded-xl border border-slate-200 dark:border-slate-700 object-cover" />
            ) : (
              <div className="w-full max-w-[240px] h-[180px] rounded-xl border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-xs text-slate-400">
                No image
              </div>
            )}
          </div>
          <div className="md:col-span-2 grid grid-cols-2 gap-3 text-sm">
            <Info label="SKU" value={product.sku} />
            <Info label="Code" value={product.code} />
            <Info label="HSN" value={product.hsn_code} />
            <Info label="Category" value={product.category} />
            <Info label="Brand" value={product.brand_name} />
            <Info label="Unit" value={product.unit} />
            <Info label="Stock" value={product.total_stock} />
            <Info label="Purchase Price" value={`₹${Number(product.purchase_price || 0).toLocaleString('en-IN')}`} />
            <Info label="Sales Price" value={`₹${Number(product.sale_price || 0).toLocaleString('en-IN')}`} />
            <Info label="GST %" value={product.gst_rate} />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a1d2e] rounded-2xl shadow-card border border-slate-200/80 dark:border-slate-700/50 p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Stock by warehouse</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Use <strong>Initial stock entry</strong> for opening balance. Later use Add/Remove for adjustments.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/50">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Warehouse</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {stockRows.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-3 py-6 text-center text-slate-400 dark:text-slate-500 text-sm">No stock yet</td>
                </tr>
              ) : stockRows.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 dark:border-slate-700/40 last:border-b-0">
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{s.warehouse_name}</td>
                  <td className="px-3 py-2 text-right text-slate-800 dark:text-slate-100 font-medium">{Number(s.quantity || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form onSubmit={submitAdjustment} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Entry type</label>
            <select
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              value={adjForm.mode}
              onChange={(e) => setAdjForm((f) => ({ ...f, mode: e.target.value }))}
            >
              <option value="initial">Initial stock entry</option>
              <option value="add">Add stock</option>
              <option value="remove">Remove stock</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Warehouse</label>
            <select
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              value={adjForm.warehouse_id}
              onChange={(e) => setAdjForm((f) => ({ ...f, warehouse_id: e.target.value }))}
              required
            >
              <option value="">Select warehouse</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Quantity</label>
            <input
              type="number"
              min="0.001"
              step="0.001"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              value={adjForm.quantity}
              onChange={(e) => setAdjForm((f) => ({ ...f, quantity: e.target.value }))}
              required
            />
          </div>
          <button className="btn-wf-primary" type="submit" disabled={adjLoading}>
            {adjLoading ? 'Saving…' : 'Save adjustment'}
          </button>
          <div className="md:col-span-4">
            <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Note (optional)</label>
            <input
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              value={adjForm.note}
              onChange={(e) => setAdjForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Reason / opening stock remark"
            />
          </div>
        </form>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-[11px] text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-slate-800 dark:text-slate-100 font-medium">{(value ?? '').toString() || '—'}</div>
    </div>
  );
}

