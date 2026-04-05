import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider }   from './context/AuthContext';
import { ThemeProvider }  from './context/ThemeContext';
import { ModuleProvider } from './context/ModuleContext';
import PrivateRoute from './components/PrivateRoute';

import Login    from './pages/auth/Login';
import Dashboard from './pages/Dashboard';
import CRM       from './pages/crm/CRM';
import Sales     from './pages/sales/Sales';
import Inventory from './pages/inventory/Inventory';
import HR        from './pages/hr/HR';
import Settings  from './pages/settings/Settings';
import Users     from './pages/users/Users';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <ModuleProvider>
            <Routes>
              <Route path="/login"    element={<Login />} />
              <Route path="/"              element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/crm"           element={<PrivateRoute module="crm"><CRM /></PrivateRoute>} />
              <Route path="/sales"         element={<PrivateRoute module="sales"><Sales /></PrivateRoute>} />
              <Route path="/inventory"     element={<PrivateRoute module="inventory"><Inventory /></PrivateRoute>} />
              <Route path="/hr"            element={<PrivateRoute module="hr"><HR /></PrivateRoute>} />
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
