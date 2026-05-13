import { Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { ResetPassword } from './pages/auth/ResetPassword';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { MyProjects } from './pages/dashboard/MyProjects';
import { MarketAnalysis } from './pages/dashboard/MarketAnalysis';
import { Materials } from './pages/dashboard/Materials';
import { Experts } from './pages/dashboard/Experts';
import { ProjectDetail } from './pages/dashboard/ProjectDetail';
import { ProjectEditor } from './pages/dashboard/ProjectEditor';
import { useAuth } from './context/AuthContext';

function App() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="w-12 h-12 border-4 border-buildorange border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<MyProjects />} />
        <Route path="market" element={<MarketAnalysis />} />
        <Route path="materials" element={<Materials />} />
        <Route path="experts" element={<Experts />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="projects/:id/editor" element={<ProjectEditor />} />
      </Route>

      {/* Orice altă rută ne-existentă (Fallback) */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
