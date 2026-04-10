import { Navigate, Route, Routes } from 'react-router-dom';
import CRM from './CRM';
import CRMLeadFormPage from './CRMLeadFormPage';
import CRMLeadDetailPage from './CRMLeadDetailPage';

export default function CRMRoutes() {
  return (
    <Routes>
      <Route index element={<CRM />} />
      <Route path="leads/new" element={<CRMLeadFormPage />} />
      <Route path="leads/:id/edit" element={<CRMLeadFormPage />} />
      <Route path="leads/:id" element={<CRMLeadDetailPage />} />
      <Route path="*" element={<Navigate to="/crm" replace />} />
    </Routes>
  );
}

