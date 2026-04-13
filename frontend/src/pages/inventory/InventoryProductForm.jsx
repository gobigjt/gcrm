import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../api/client';
import { Field, inputCls, FormActions } from '../../components/FormField';
import { useToast } from '../../context/ToastContext';
import { apiErrorMessage } from '../../utils/apiErrorMessage';

const EMPTY = {
  name: '',
  code: '',
  sku: '',
  hsn_code: '',
  category: '',
  brand_id: '',
  unit: 'pcs',
  purchase_price: '',
  sale_price: '',
  gst_rate: '0',
  low_stock_alert: '0',
};

export default function InventoryProductForm() {
  const { id } = useParams();
  const isEdit = useMemo(() => Boolean(id), [id]);
  const nav = useNavigate();
  const { show } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);

  useEffect(() => {
    api.get('/inventory/brands')
      .then((r) => setBrands(r.data.brands || r.data || []))
      .catch(() => setBrands([]));
    api.get('/inventory/categories')
      .then((r) => setCategories(r.data.categories || r.data || []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/inventory/products/${id}`).then((r) => {
      const p = r.data?.product || r.data || {};
      setForm({
        name: p.name ?? '',
        code: p.code ?? '',
        sku: p.sku ?? '',
        hsn_code: p.hsn_code ?? '',
        category: p.category ?? '',
        brand_id: p.brand_id ?? '',
        unit: p.unit ?? 'pcs',
        purchase_price: p.purchase_price ?? '',
        sale_price: p.sale_price ?? '',
        gst_rate: p.gst_rate ?? '0',
        low_stock_alert: p.low_stock_alert ?? '0',
      });
    }).catch(() => {});
  }, [id, isEdit]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let product;
      if (isEdit) {
        const res = await api.patch(`/inventory/products/${id}`, form);
        product = res.data?.product || res.data;
      } else {
        const res = await api.post('/inventory/products', form);
        product = res.data?.product || res.data;
      }
      const productId = product?.id ?? Number(id);
      if (imageFile && productId) {
        const fd = new FormData();
        fd.append('file', imageFile);
        await api.post(`/inventory/products/${productId}/image`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      show(isEdit ? 'Product updated' : 'Product created', 'success');
      nav(`/inventory/products/${productId}`);
    } catch (err) {
      show(apiErrorMessage(err, 'Could not save product'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <h2 className="text-[16px] font-semibold text-slate-800 dark:text-slate-100">
          {isEdit ? 'Edit Product' : 'Add Product'}
        </h2>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">Product master details</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-[#1a1d2e] rounded-2xl shadow-card border border-slate-200/80 dark:border-slate-700/50 p-5">
        <Field label="Name *"><input className={inputCls} value={form.name} onChange={set('name')} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="SKU"><input className={inputCls} value={form.sku} onChange={set('sku')} /></Field>
          <Field label="Code"><input className={inputCls} value={form.code} onChange={set('code')} /></Field>
          <Field label="HSN"><input className={inputCls} value={form.hsn_code} onChange={set('hsn_code')} /></Field>
          <Field label="Category">
            <select className={inputCls} value={form.category} onChange={set('category')}>
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Brand">
            <select className={inputCls} value={form.brand_id} onChange={set('brand_id')}>
              <option value="">—</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Unit"><input className={inputCls} value={form.unit} onChange={set('unit')} /></Field>
          <Field label="Purchase Price"><input className={inputCls} type="number" step="0.01" value={form.purchase_price} onChange={set('purchase_price')} /></Field>
          <Field label="Sales Price"><input className={inputCls} type="number" step="0.01" value={form.sale_price} onChange={set('sale_price')} /></Field>
          <Field label="GST %"><input className={inputCls} type="number" step="0.01" value={form.gst_rate} onChange={set('gst_rate')} /></Field>
          <Field label="Low Stock Alert"><input className={inputCls} type="number" value={form.low_stock_alert} onChange={set('low_stock_alert')} /></Field>
        </div>
        <Field label="Image">
          <input
            className={inputCls}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
          />
        </Field>
        <div className="flex items-center justify-between">
          <Link to={isEdit ? `/inventory/products/${id}` : '/inventory/products'} className="text-sm text-slate-500 dark:text-slate-300 hover:underline">
            Cancel
          </Link>
          <FormActions onCancel={() => nav(isEdit ? `/inventory/products/${id}` : '/inventory/products')} loading={loading} submitLabel={isEdit ? 'Save' : 'Create'} />
        </div>
      </form>
    </div>
  );
}

