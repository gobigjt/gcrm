import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import Table from '../../components/Table';
import Tabs  from '../../components/Tabs';
import Modal from '../../components/Modal';
import { Field, inputCls, FormActions } from '../../components/FormField';

const TABS = ['Products', 'Warehouses'];
const EMPTY = { name:'', sku:'', hsn_code:'', unit:'pcs', purchase_price:'', sale_price:'', gst_rate:'0', low_stock_alert:'0' };

const INV_TAB_BY_PARAM = {
  products: 'Products',
  warehouses: 'Warehouses',
  inventory: 'Warehouses',
};

export default function Inventory() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState('Products');
  const [products,   setProducts]   = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm]   = useState(EMPTY);
  const [loading, setLoading] = useState(false);

  const loadAll = () => {
    api.get('/inventory/products').then(r => setProducts(r.data.products||r.data||[]));
    api.get('/inventory/warehouses').then(r => setWarehouses(r.data.warehouses||r.data||[]));
  };
  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    const raw = (searchParams.get('tab') || '').toLowerCase().replace(/[\s_-]+/g, '');
    const mapped = INV_TAB_BY_PARAM[raw];
    if (mapped) setTab(mapped);
    else if (!searchParams.get('tab')) setTab('Products');
  }, [searchParams]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try { await api.post('/inventory/products', form); setModal(false); setForm(EMPTY); loadAll(); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-800 dark:text-slate-100">Inventory management</h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Products and warehouses</p>
        </div>
        {tab === 'Products' && (
          <button
            onClick={() => setModal(true)}
            className="btn-wf-primary"
          >
            + New Product
          </button>
        )}
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'Products' && (
        <Table
          cols={['Name','SKU','HSN','Unit','Purchase Price','Sale Price','GST %']}
          rows={products.map(p => [p.name, p.sku, p.hsn_code, p.unit, `₹${Number(p.purchase_price).toLocaleString('en-IN')}`, `₹${Number(p.sale_price).toLocaleString('en-IN')}`, `${p.gst_rate}%`])}
        />
      )}

      {tab === 'Warehouses' && (
        <Table cols={['Name','Location','Active']} rows={warehouses.map(w => [w.name, w.location, w.is_active ? '✓' : '—'])} />
      )}

      {modal && (
        <Modal title="New Product" onClose={() => setModal(false)}>
          <form onSubmit={handleSubmit}>
            <Field label="Name *"><input className={inputCls} value={form.name} onChange={set('name')} required /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="SKU"><input className={inputCls} value={form.sku} onChange={set('sku')} /></Field>
              <Field label="HSN Code"><input className={inputCls} value={form.hsn_code} onChange={set('hsn_code')} /></Field>
              <Field label="Unit"><input className={inputCls} value={form.unit} onChange={set('unit')} /></Field>
              <Field label="GST Rate (%)"><input className={inputCls} type="number" step="0.01" value={form.gst_rate} onChange={set('gst_rate')} /></Field>
              <Field label="Purchase Price (₹)"><input className={inputCls} type="number" step="0.01" value={form.purchase_price} onChange={set('purchase_price')} /></Field>
              <Field label="Sale Price (₹)"><input className={inputCls} type="number" step="0.01" value={form.sale_price} onChange={set('sale_price')} /></Field>
            </div>
            <Field label="Low Stock Alert"><input className={inputCls} type="number" value={form.low_stock_alert} onChange={set('low_stock_alert')} /></Field>
            <FormActions onCancel={() => setModal(false)} loading={loading} />
          </form>
        </Modal>
      )}
    </div>
  );
}
