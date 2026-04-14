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
  const [errors, setErrors] = useState({});

  const validateField = (key, value, nextForm = form, nextImage = imageFile) => {
    const v = String(value ?? '').trim();
    if (key === 'name') return v ? '' : 'Name is required.';
    if (key === 'sku') {
      if (!v) return 'SKU is required.';
      return v.length > 64 ? 'SKU is too long.' : '';
    }
    if (key === 'code') {
      if (!v) return 'Code is required.';
      return v.length > 64 ? 'Code is too long.' : '';
    }
    if (key === 'unit') return v ? '' : 'Unit is required.';
    if (key === 'purchase_price') return v !== '' && (Number.isNaN(Number(v)) || Number(v) < 0) ? 'Purchase price must be 0 or more.' : '';
    if (key === 'sale_price') return v !== '' && (Number.isNaN(Number(v)) || Number(v) < 0) ? 'Sales price must be 0 or more.' : '';
    if (key === 'gst_rate') return v !== '' && (Number.isNaN(Number(v)) || Number(v) < 0 || Number(v) > 100) ? 'GST must be between 0 and 100.' : '';
    if (key === 'low_stock_alert') return v !== '' && (!Number.isInteger(Number(v)) || Number(v) < 0) ? 'Low stock alert must be a whole number 0 or more.' : '';
    if (key === 'image') {
      if (!nextImage) return '';
      if (!String(nextImage.type || '').startsWith('image/')) return 'Choose an image file.';
      if (nextImage.size > 2 * 1024 * 1024) return 'Image must be 2 MB or smaller.';
      return '';
    }
    return '';
  };

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

  const set = (k) => (e) => {
    const v = e.target.value;
    setForm((f) => {
      const nextForm = { ...f, [k]: v };
      const msg = validateField(k, v, nextForm, imageFile);
      setErrors((prev) => {
        const next = { ...prev };
        if (msg) next[k] = msg;
        else delete next[k];
        return next;
      });
      return nextForm;
    });
  };

  const inputErrorCls = (k) => (errors[k] ? `${inputCls} border-red-500 focus:border-red-500 focus:ring-red-500` : inputCls);

  const validate = () => {
    const next = {};
    for (const key of ['name', 'sku', 'code', 'unit', 'purchase_price', 'sale_price', 'gst_rate', 'low_stock_alert']) {
      const msg = validateField(key, form[key], form, imageFile);
      if (msg) next[key] = msg;
    }
    const imageMsg = validateField('image', '', form, imageFile);
    if (imageMsg) next.image = imageMsg;
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      show('Please fix highlighted fields', 'error');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        name: String(form.name || '').trim(),
        sku: String(form.sku || '').trim(),
        code: String(form.code || '').trim(),
        hsn_code: String(form.hsn_code || '').trim(),
        category: String(form.category || '').trim(),
        brand_id: String(form.brand_id || '').trim(),
        unit: String(form.unit || '').trim() || 'pcs',
        purchase_price: String(form.purchase_price || '').trim(),
        sale_price: String(form.sale_price || '').trim(),
        gst_rate: String(form.gst_rate || '').trim(),
        low_stock_alert: String(form.low_stock_alert || '').trim(),
      };
      let product;
      if (isEdit) {
        const res = await api.patch(`/inventory/products/${id}`, payload);
        product = res.data?.product || res.data;
      } else {
        const res = await api.post('/inventory/products', payload);
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
      setErrors({});
      show(isEdit ? 'Product updated' : 'Product created', 'success');
      nav(`/inventory/products/${productId}`);
    } catch (err) {
      const msg = apiErrorMessage(err, 'Could not save product');
      const lowMsg = msg.toLowerCase();
      const fieldErrs = {};
      if (lowMsg.includes('sku')) fieldErrs.sku = msg;
      if (lowMsg.includes('code')) fieldErrs.code = msg;
      if (Object.keys(fieldErrs).length) setErrors((prev) => ({ ...prev, ...fieldErrs }));
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
        <Field label="Name *">
          <input className={inputErrorCls('name')} value={form.name} onChange={set('name')} required />
          {errors.name ? <div className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name}</div> : null}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="SKU">
            <input className={inputErrorCls('sku')} value={form.sku} onChange={set('sku')} required />
            {errors.sku ? <div className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.sku}</div> : null}
          </Field>
          <Field label="Code">
            <input className={inputErrorCls('code')} value={form.code} onChange={set('code')} required />
            {errors.code ? <div className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.code}</div> : null}
          </Field>
          <Field label="HSN"><input className={inputErrorCls('hsn_code')} value={form.hsn_code} onChange={set('hsn_code')} /></Field>
          <Field label="Category">
            <select className={inputErrorCls('category')} value={form.category} onChange={set('category')}>
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Brand">
            <select className={inputErrorCls('brand_id')} value={form.brand_id} onChange={set('brand_id')}>
              <option value="">—</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Unit">
            <input className={inputErrorCls('unit')} value={form.unit} onChange={set('unit')} />
            {errors.unit ? <div className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.unit}</div> : null}
          </Field>
          <Field label="Purchase Price">
            <input className={inputErrorCls('purchase_price')} type="number" step="0.01" value={form.purchase_price} onChange={set('purchase_price')} />
            {errors.purchase_price ? <div className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.purchase_price}</div> : null}
          </Field>
          <Field label="Sales Price">
            <input className={inputErrorCls('sale_price')} type="number" step="0.01" value={form.sale_price} onChange={set('sale_price')} />
            {errors.sale_price ? <div className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.sale_price}</div> : null}
          </Field>
          <Field label="GST %">
            <input className={inputErrorCls('gst_rate')} type="number" step="0.01" value={form.gst_rate} onChange={set('gst_rate')} />
            {errors.gst_rate ? <div className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.gst_rate}</div> : null}
          </Field>
          <Field label="Low Stock Alert">
            <input className={inputErrorCls('low_stock_alert')} type="number" value={form.low_stock_alert} onChange={set('low_stock_alert')} />
            {errors.low_stock_alert ? <div className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.low_stock_alert}</div> : null}
          </Field>
        </div>
        <Field label="Image">
          <input
            className={inputErrorCls('image')}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              setImageFile(file);
              const msg = validateField('image', '', form, file);
              setErrors((prev) => {
                const next = { ...prev };
                if (msg) next.image = msg;
                else delete next.image;
                return next;
              });
            }}
          />
          {errors.image ? <div className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.image}</div> : null}
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

