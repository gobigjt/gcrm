import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider }   from './context/AuthContext';
import { ThemeProvider }  from './context/ThemeContext';
import { ModuleProvider } from './context/ModuleContext';
import PrivateRoute from './components/PrivateRoute';

import Login         from './pages/auth/Login';
import Register      from './pages/auth/Register';
import Dashboard     from './pages/Dashboard';
import CRM           from './pages/crm/CRM';
import Sales         from './pages/sales/Sales';
import Purchase      from './pages/purchase/Purchase';
import Inventory     from './pages/inventory/Inventory';
import Production    from './pages/production/Production';
import Finance       from './pages/finance/Finance';
import HR            from './pages/hr/HR';
import Communication from './pages/communication/Communication';
import Settings      from './pages/settings/Settings';
import Users         from './pages/users/Users';
import Notifications from './pages/notifications/Notifications';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <ModuleProvider>
            <Routes>
              <Route path="/login"    element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/"              element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/crm"           element={<PrivateRoute module="crm"><CRM /></PrivateRoute>} />
              <Route path="/sales"         element={<PrivateRoute module="sales"><Sales /></PrivateRoute>} />
              <Route path="/purchase"      element={<PrivateRoute module="purchase"><Purchase /></PrivateRoute>} />
              <Route path="/inventory"     element={<PrivateRoute module="inventory"><Inventory /></PrivateRoute>} />
              <Route path="/production"    element={<PrivateRoute module="production"><Production /></PrivateRoute>} />
              <Route path="/finance"       element={<PrivateRoute module="finance"><Finance /></PrivateRoute>} />
              <Route path="/hr"            element={<PrivateRoute module="hr"><HR /></PrivateRoute>} />
              <Route path="/communication" element={<PrivateRoute module="communication"><Communication /></PrivateRoute>} />
              <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
              <Route path="/settings"      element={<PrivateRoute module="settings"><Settings /></PrivateRoute>} />
              <Route path="/users"         element={<PrivateRoute module="users"><Users /></PrivateRoute>} />
              <Route path="*"              element={<Navigate to="/" replace />} />
            </Routes>
          </ModuleProvider>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
