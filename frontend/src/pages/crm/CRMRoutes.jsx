import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import CRM from './CRM';
import CRMLeadFormPage from './CRMLeadFormPage';
import CRMMastersPage from './CRMMastersPage';

function LegacyLeadViewRedirect() {
  const { id } = useParams();
  if (!id) return <Navigate to="/crm" replace />;
  return <Navigate to={`/crm?lead=${encodeURIComponent(id)}`} replace />;
}

export default function CRMRoutes() {
  return (
    <Routes>
      <Route index element={<CRM />} />
      <Route path="masters" element={<CRMMastersPage />} />
      <Route path="leads/new" element={<CRMLeadFormPage />} />
      <Route path="leads/:id/edit" element={<CRMLeadFormPage />} />
      <Route path="leads/:id" element={<LegacyLeadViewRedirect />} />
      <Route path="*" element={<Navigate to="/crm" replace />} />
    </Routes>
  );
}

