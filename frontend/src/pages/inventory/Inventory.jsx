import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import Table from '../../components/Table';
import { useToast } from '../../context/ToastContext';
import { apiErrorMessage } from '../../utils/apiErrorMessage';

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
  const [deletingId, setDeletingId] = useState(null);
  const { show } = useToast();

  const loadProducts = useCallback(() => {
    api.get('/inventory/products')
      .then((r) => setProducts(r.data.products || r.data || []))
      .catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const promptDelete = (pid, displayName) => {
    show(`Delete “${displayName}”? This cannot be undone.`, 'warning', {
      actions: [
        { label: 'Cancel', variant: 'secondary', onClick: () => {} },
        {
          label: 'Delete',
          variant: 'danger',
          onClick: async () => {
            setDeletingId(pid);
            try {
              await api.delete(`/inventory/products/${pid}`);
              setProducts((list) =>
                list.filter((p) => Number(p.id ?? p.product_id) !== Number(pid)),
              );
              show('Product deleted', 'success');
    } catch (err) {
      show(apiErrorMessage(err, 'Could not delete product'), 'error');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    });
  };

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
        relaxLastColumnWrap
        cols={['Image','Name','SKU','Code','Category','Brand','Unit','Stock','Purchase Price','Sale Price','Actions']}
        rows={products.map((p) => {
          const pid = p.id ?? p.product_id;
          return [
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
            pid != null && pid !== '' ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <Link
                  className="btn-wf-secondary text-[11px] py-1 px-2.5 rounded-lg inline-flex"
                  to={`/inventory/products/${pid}`}
                >
                  View
                </Link>
                <Link
                  className="btn-wf-primary text-[11px] py-1 px-2.5 rounded-lg inline-flex"
                  to={`/inventory/products/${pid}/edit`}
                >
                  Edit
                </Link>
                <button
                  type="button"
                  className="btn-wf-danger text-[11px] py-1 px-2.5 rounded-lg inline-flex disabled:opacity-50"
                  disabled={deletingId === pid}
                  onClick={() => promptDelete(pid, (p.name || 'Product').toString())}
                >
                  {deletingId === pid ? '…' : 'Delete'}
                </button>
              </div>
            ) : (
              '—'
            ),
          ];
        })}
      />
    </div>
  );
}

