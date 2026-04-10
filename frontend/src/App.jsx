import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider }   from './context/AuthContext';
import { ThemeProvider }  from './context/ThemeContext';
import { ModuleProvider } from './context/ModuleContext';
import PrivateRoute from './components/PrivateRoute';

import Login    from './pages/auth/Login';
import Dashboard from './pages/Dashboard';
import CRMRoutes from './pages/crm/CRMRoutes';
import SalesRoutes from './pages/sales/SalesRoutes';
import InventoryRoutes from './pages/inventory/InventoryRoutes';
import HR        from './pages/hr/HR';
import Settings  from './pages/settings/Settings';
import Users     from './pages/users/Users';
import Profile   from './pages/profile/Profile';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <ModuleProvider>
            <Routes>
              <Route path="/login"    element={<Login />} />
              <Route path="/"              element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/crm/*"         element={<PrivateRoute module="crm"><CRMRoutes /></PrivateRoute>} />
              <Route path="/sales/*"       element={<PrivateRoute module="sales"><SalesRoutes /></PrivateRoute>} />
              <Route path="/inventory/*"    element={<PrivateRoute module="inventory"><InventoryRoutes /></PrivateRoute>} />
              <Route path="/hr"            element={<PrivateRoute module="hr"><HR /></PrivateRoute>} />
              <Route path="/settings"      element={<PrivateRoute module="settings"><Settings /></PrivateRoute>} />
              <Route path="/profile"       element={<PrivateRoute><Profile /></PrivateRoute>} />
              <Route path="/users"         element={<PrivateRoute module="users"><Users /></PrivateRoute>} />
              <Route path="*"              element={<Navigate to="/" replace />} />
            </Routes>
          </ModuleProvider>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
