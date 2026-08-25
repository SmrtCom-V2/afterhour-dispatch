import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PmProvider } from './context/PmContext';
import { OnboardingProvider } from './context/OnboardingContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { VerifyEmail } from './pages/VerifyEmail';
import { Dashboard } from './pages/Dashboard';
import { Incidents } from './pages/Incidents';
import { IncidentDetail } from './pages/IncidentDetail';
import { PmCompanies } from './pages/PmCompanies';
import { PmWorkspace } from './pages/PmWorkspace';
import { Buildings } from './pages/Buildings';
import { Tenants } from './pages/Tenants';
import { ServiceProviders } from './pages/ServiceProviders';
import { Reports } from './pages/Reports';
import { Employees } from './pages/Employees';
import { Settings } from './pages/Settings';
import { SpReportSubmit } from './pages/SpReportSubmit';
import { Cockpit } from './pages/Cockpit';
import { Impressum } from './pages/legal/Impressum';
import { Datenschutz } from './pages/legal/Datenschutz';
import { Terms } from './pages/legal/Terms';
import { Refund } from './pages/legal/Refund';
import { Erstattung } from './pages/legal/Erstattung';
import { AdminDashboard } from './pages/AdminDashboard';
import { SaAuthProvider, useSaAuth } from './sa/SaAuthContext';
import { SaLayout } from './sa/SaLayout';
import { SaLogin } from './sa/pages/SaLogin';
import { SaDashboard } from './sa/pages/SaDashboard';
import { SaCompanies } from './sa/pages/SaCompanies';
import { SaCompanyDetail } from './sa/pages/SaCompanyDetail';
import { SaAuditLogs } from './sa/pages/SaAuditLogs';
import { SaTrials } from './sa/pages/SaTrials';
import { SaBilling } from './sa/pages/SaBilling';
import { SaUsage } from './sa/pages/SaUsage';
import { SaUsers } from './sa/pages/SaUsers';
import { SaSystemHealth } from './sa/pages/SaSystemHealth';
import { SaSettings } from './sa/pages/SaSettings';
import { SaPlaceholder } from './sa/pages/SaPlaceholder';
import { SaExport } from './sa/pages/SaExport';
import { SaSupport } from './sa/pages/SaSupport';
import { SaFeatureFlags } from './sa/pages/SaFeatureFlags';
import { SaGdpr } from './sa/pages/SaGdpr';
import SaCompanyBilling from './sa/pages/SaCompanyBilling';
import { CookieConsent } from './components/CookieConsent';
import { EntitlementsProvider } from './context/EntitlementsContext';
import SettingsPlanAddons from './pages/SettingsPlanAddons';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <Navigate to="/login" />;

  return <Layout>{children}</Layout>;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <Navigate to="/login" />;

  const isAdmin =
    user?.is_platform_admin === true ||
    user?.role === 'platform_admin';

  if (!isAdmin) return <Navigate to="/" />;

  return <Layout>{children}</Layout>;
}

function SaProtectedRoute({ children }) {
  const { user, loading } = useSaAuth();

  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <Navigate to="/sa/login" />;

  return <SaLayout>{children}</SaLayout>;
}

function SaRoutes() {
  const { user, loading } = useSaAuth();

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/sa/dashboard" /> : <SaLogin />} />
      <Route path="/dashboard" element={<SaProtectedRoute><SaDashboard /></SaProtectedRoute>} />
      <Route path="/companies" element={<SaProtectedRoute><SaCompanies /></SaProtectedRoute>} />
      <Route path="/companies/:companyId" element={<SaProtectedRoute><SaCompanyDetail /></SaProtectedRoute>} />
      <Route path="/companies/:companyId/billing" element={<SaProtectedRoute><SaCompanyBilling /></SaProtectedRoute>} />
      <Route path="/audit-logs" element={<SaProtectedRoute><SaAuditLogs /></SaProtectedRoute>} />
      <Route path="/trials" element={<SaProtectedRoute><SaTrials /></SaProtectedRoute>} />
      <Route path="/billing" element={<SaProtectedRoute><SaBilling /></SaProtectedRoute>} />
      <Route path="/usage" element={<SaProtectedRoute><SaUsage /></SaProtectedRoute>} />
      <Route path="/users" element={<SaProtectedRoute><SaUsers /></SaProtectedRoute>} />
      <Route path="/support" element={<SaProtectedRoute><SaSupport /></SaProtectedRoute>} />
      <Route path="/system-health" element={<SaProtectedRoute><SaSystemHealth /></SaProtectedRoute>} />
      <Route path="/export" element={<SaProtectedRoute><SaExport /></SaProtectedRoute>} />
      <Route path="/feature-flags" element={<SaProtectedRoute><SaFeatureFlags /></SaProtectedRoute>} />
      <Route path="/gdpr" element={<SaProtectedRoute><SaGdpr /></SaProtectedRoute>} />
      <Route path="/settings" element={<SaProtectedRoute><SaSettings /></SaProtectedRoute>} />
      <Route path="*" element={<Navigate to="/sa/dashboard" />} />
    </Routes>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <Routes>
      <Route path="/sa/*" element={<SaRoutes />} />
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/signup" element={user ? <Navigate to="/" /> : <Signup />} />
      <Route path="/forgot-password" element={user ? <Navigate to="/" /> : <ForgotPassword />} />
      <Route path="/reset-password" element={user ? <Navigate to="/" /> : <ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/report/:token" element={<SpReportSubmit />} />
      <Route path="/cockpit/:token" element={<Cockpit />} />
      <Route path="/impressum" element={<Impressum />} />
      <Route path="/privacy" element={<Datenschutz />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/refund" element={<Refund />} />
      <Route path="/erstattung" element={<Erstattung />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/incidents" element={<ProtectedRoute><Incidents /></ProtectedRoute>} />
      <Route path="/incidents/:id" element={<ProtectedRoute><IncidentDetail /></ProtectedRoute>} />
      <Route path="/pm-companies" element={<ProtectedRoute><PmCompanies /></ProtectedRoute>} />
      <Route path="/pm/:pmId/*" element={<ProtectedRoute><PmWorkspace /></ProtectedRoute>} />
      <Route path="/buildings" element={<ProtectedRoute><Buildings /></ProtectedRoute>} />
      <Route path="/tenants" element={<ProtectedRoute><Tenants /></ProtectedRoute>} />
      <Route path="/service-providers" element={<ProtectedRoute><ServiceProviders /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/settings/plan-addons" element={<ProtectedRoute><SettingsPlanAddons /></ProtectedRoute>} />
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      {/*
        Catch-all. Without this, any unmatched URL rendered a completely blank
        white page — no text, no nav, no way back (QA 2026-08-09, Finding 5).
        That hit real URLs a customer can plausibly land on: /dashboard (the
        dashboard actually lives at "/"), plus stale bookmarks and old email
        links. SaRoutes already had its own catch-all; the main table did not.

        Logged out, an unknown path is almost always an expired session or an
        old link, so send them to login rather than showing a 404 they can't
        act on. Logged in, show a real 404 inside the app shell.
      */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

/**
 * 404 handler. Redirects to login when unauthenticated so a stale link never
 * dead-ends on a blank page.
 */
function NotFound() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();

  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <Layout>
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 48, margin: 0 }}>404</h1>
        <p style={{ color: '#64748b', marginTop: 8 }}>{t('pageNotFound')}</p>
        <Link to="/" style={{ display: 'inline-block', marginTop: 16 }}>
          {t('backToDashboard')}
        </Link>
      </div>
    </Layout>
  );
}

function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <EntitlementsProvider>
            <PmProvider>
              <OnboardingProvider>
                <SaAuthProvider>
                  <AppRoutes />
                  <CookieConsent />
                </SaAuthProvider>
              </OnboardingProvider>
            </PmProvider>
          </EntitlementsProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}

export default App;
