import { Navigate, Route, Routes } from 'react-router-dom';
import { SalesListPage, SalesFormPage, SalesDetailPage, SalesCustomersPage, SalesReturnsPage, SalesPaymentsPage } from './Sales';

export default function SalesRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="invoices" replace />} />
      {/* Quotes */}
      <Route path="quotes/new" element={<SalesFormPage segment="quotes" />} />
      <Route path="quotes/:id/edit" element={<SalesFormPage segment="quotes" />} />
      <Route path="quotes/:id" element={<SalesDetailPage segment="quotes" />} />
      <Route path="quotes" element={<SalesListPage segment="quotes" />} />
      {/* Orders */}
      <Route path="orders/new" element={<SalesFormPage segment="orders" />} />
      <Route path="orders/:id/edit" element={<SalesFormPage segment="orders" />} />
      <Route path="orders/:id" element={<SalesDetailPage segment="orders" />} />
      <Route path="orders" element={<SalesListPage segment="orders" />} />
      {/* Invoices */}
      <Route path="invoices/new" element={<SalesFormPage segment="invoices" />} />
      <Route path="invoices/:id/edit" element={<SalesFormPage segment="invoices" />} />
      <Route path="invoices/:id" element={<SalesDetailPage segment="invoices" />} />
      <Route path="invoices" element={<SalesListPage segment="invoices" />} />
      <Route path="payments" element={<SalesPaymentsPage />} />
      {/* Sale Returns */}
      <Route path="returns" element={<SalesReturnsPage />} />
      {/* Customers */}
      <Route path="customers" element={<SalesCustomersPage />} />
      <Route path="*" element={<Navigate to="invoices" replace />} />
    </Routes>
  );
}
