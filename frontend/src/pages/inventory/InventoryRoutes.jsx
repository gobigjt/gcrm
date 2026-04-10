import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import InventoryProductsPage from './Inventory';
import InventoryProductForm from './InventoryProductForm';
import InventoryProductDetail from './InventoryProductDetail';
import InventoryWarehousesPage from './InventoryWarehouses';
import InventoryBrandsPage from './InventoryBrands';
import InventoryCategoriesPage from './InventoryCategories';
import InventoryAdjustmentsPage from './InventoryAdjustments';

function InventoryIndexRedirect() {
  const [searchParams] = useSearchParams();
  const raw = (searchParams.get('tab') || '').toLowerCase().replace(/[\s_-]+/g, '');
  if (raw === 'warehouses' || raw === 'inventory') return <Navigate to="warehouses" replace />;
  return <Navigate to="products" replace />;
}

export default function InventoryRoutes() {
  return (
    <Routes>
      <Route index element={<InventoryIndexRedirect />} />
      <Route path="products/new" element={<InventoryProductForm />} />
      <Route path="products/:id/edit" element={<InventoryProductForm />} />
      <Route path="products/:id" element={<InventoryProductDetail />} />
      <Route path="products" element={<InventoryProductsPage />} />
      <Route path="warehouses" element={<InventoryWarehousesPage />} />
      <Route path="adjustments" element={<InventoryAdjustmentsPage />} />
      <Route path="brands" element={<InventoryBrandsPage />} />
      <Route path="categories" element={<InventoryCategoriesPage />} />
      <Route path="*" element={<Navigate to="products" replace />} />
    </Routes>
  );
}

