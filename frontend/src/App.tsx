import { Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { ResetPassword } from './pages/auth/ResetPassword';
import { VerifyEmail } from './pages/auth/VerifyEmail';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { MyProjects } from './pages/dashboard/MyProjects';
import { MarketAnalysis } from './pages/dashboard/MarketAnalysis';
import { Materials } from './pages/dashboard/Materials';
import { Experts } from './pages/dashboard/Experts';
import { ProjectDetail } from './pages/dashboard/ProjectDetail';
import { ProjectEditor } from './pages/dashboard/ProjectEditor';
import { ProjectBOM } from './pages/dashboard/ProjectBOM';
import { ProjectTimeline } from './pages/dashboard/ProjectTimeline';
import ContractorsMarketplace from './pages/dashboard/ContractorsMarketplace';
import MyQuotesClient from './pages/dashboard/MyQuotesClient';
import UserProfile from './pages/dashboard/UserProfile';
import ContractorDashboardLayout from './components/layout/ContractorDashboardLayout';
import QuoteRequestsList from './pages/contractor/QuoteRequestsList';
import ProfileEdit from './pages/contractor/ProfileEdit';
import ContractorMarketView from './pages/contractor/ContractorMarketView';
import ContractorFeed from './pages/contractor/ContractorFeed';

import AdminDashboardLayout from './components/layout/AdminDashboardLayout';
import AdminUsers from './pages/admin/AdminUsers';
import AdminMaterials from './pages/admin/AdminMaterials';

import { TermsAndConditions } from './pages/legal/TermsAndConditions';
import { PrivacyPolicy } from './pages/legal/PrivacyPolicy';
import { LandingPage } from './pages/public/LandingPage';
import { CookieConsent } from './components/layout/CookieConsent';

import { useAuth } from './context/useAuth';

function App() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="w-12 h-12 border-4 border-buildorange border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route 
          path="/" 
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />
          } 
        />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
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
        <Route path="profile" element={<UserProfile />} />
        <Route path="market" element={<MarketAnalysis />} />
        <Route path="materials" element={<Materials />} />
        <Route path="experts" element={<Experts />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="projects/:id/editor" element={<ProjectEditor />} />
        <Route path="projects/:id/bom" element={<ProjectBOM />} />
        <Route path="projects/:id/timeline" element={<ProjectTimeline />} />
        <Route path="projects/:id/contractors" element={<ContractorsMarketplace />} />
        <Route path="projects/:id/quotes" element={<MyQuotesClient />} />
      </Route>

      <Route
        path="/contractor"
        element={
          <ProtectedRoute>
            <ContractorDashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="quotes" replace />} />
        <Route path="feed" element={<ContractorFeed />} />
        <Route path="quotes" element={<QuoteRequestsList />} />
        <Route path="market" element={<MarketAnalysis />} />
        <Route path="profile" element={<ProfileEdit />} />
      </Route>

      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminDashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="users" replace />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="materials" element={<AdminMaterials />} />
      </Route>

      {/* Rute publice — Juridic */}
      <Route path="/terms" element={<TermsAndConditions />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />

      {/* Orice altă rută ne-existentă (Fallback) */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    <CookieConsent />
    </>
  );
}

export default App;
