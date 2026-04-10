import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import Table from '../../components/Table';

function stockLabel(v) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-IN', { maximumFractionDigits: 3 });
}

function imgSrc(path) {
  if (!path) return '';
  const s = String(path);
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (s.startsWith('/uploads/')) return s;
  return s;
}

export default function InventoryProductsPage() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    api.get('/inventory/products')
      .then((r) => setProducts(r.data.products || r.data || []))
      .catch(() => setProducts([]));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-800 dark:text-slate-100">Products</h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Inventory catalog</p>
        </div>
        <Link to="/inventory/products/new" className="btn-wf-primary">
          + New Product
        </Link>
      </div>

      <Table
        cols={['Image','Name','SKU','Code','Category','Brand','Unit','Stock','Purchase Price','Sale Price','Actions']}
        rows={products.map((p) => [
          p.image_url ? <img alt="" src={imgSrc(p.image_url)} className="h-8 w-8 object-cover rounded border border-slate-200 dark:border-slate-700" /> : '—',
          p.name,
          p.sku,
          p.code,
          p.category,
          p.brand_name || '—',
          p.unit,
          stockLabel(p.total_stock),
          `₹${Number(p.purchase_price).toLocaleString('en-IN')}`,
          `₹${Number(p.sale_price).toLocaleString('en-IN')}`,
          <div className="flex items-center gap-2">
            <Link className="text-brand-600 dark:text-brand-400 hover:underline" to={`/inventory/products/${p.id}`}>View</Link>
            <Link className="text-slate-600 dark:text-slate-300 hover:underline" to={`/inventory/products/${p.id}/edit`}>Edit</Link>
          </div>,
        ])}
      />
    </div>
  );
}

