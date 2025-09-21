import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import Dashboard from './components/dashboard/Dashboard';
import PricingSection from './components/pricing/PricingSection';
import CheckoutSuccess from './components/checkout/CheckoutSuccess';
import CheckoutCancel from './components/checkout/CheckoutCancel';
import UploadPage from './pages/UploadPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import EmailConfirmationPage from './pages/EmailConfirmationPage';
import EmailSentPage from './pages/EmailSentPage';
import AuthGuard from './components/AuthGuard';
import AdminGuard from './components/AdminGuard';
import { ContractProvider } from './context/ContractContext';
import './index.css';
import SearchPage from './pages/SearchPage';
import NotificationsPage from './pages/NotificationsPage';
import ContractsPage from './pages/ContractsPage';
import DisclaimerPage from './pages/DisclaimerPage';
import TermsPage from './pages/TermsPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import HelpPage from './pages/HelpPage';
import AcceptInvitationPage from './pages/AcceptInvitationPage';
import { useTheme } from './hooks/useTheme';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminInquiriesPage from './pages/AdminInquiriesPage';
import AdminSupportTicketsPage from './pages/AdminSupportTicketsPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminContractsPage from './pages/AdminContractsPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import AdminReportsPage from './pages/AdminReportsPage';

import MainLayout from './components/layout/MainLayout';
import AuthCallbackPage from './pages/AuthCallbackPage';
import MfaChallengePage from './pages/MfaChallengePage';
import { useSessionContext } from '@supabase/auth-helpers-react';
import PublicReportViewerPage from './pages/PublicReportViewerPage';
import LandingPageSampleDashboard from './components/dashboard/LandingPageSampleDashboard';
import LandingPagePricingSection from './components/pricing/LandingPagePricingSection'; 
import ResetPassword from './pages/ResetPassword';
import ErrorBoundary from './components/ErrorBoundary';
import MaintenancePage from './pages/MaintenancePage'; // ADDED: Import MaintenancePage
import { useAppSettings } from './hooks/useAppSettings'; // ADDED: Import useAppSettings
import { useIsAdmin } from './hooks/useIsAdmin'; // ADDED: Import useIsAdmin

function App() {
  const [isDashboardHelpModalOpen, setIsDashboardHelpModal] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const { session, isLoading: isSessionLoading } = useSessionContext();
  const { settings: appSettings, loading: loadingAppSettings } = useAppSettings(); // ADDED: Fetch app settings
  const { isAdmin, loadingAdminStatus } = useIsAdmin(); // ADDED: Fetch admin status

  useTheme();

  useEffect(() => {
    const publicPaths = [
      '/',
      '/public-report-view',
      '/checkout/success',
      '/checkout/cancel',
      '/sample-dashboard',
      '/landing-pricing',
      '/login',
      '/signup',
      '/auth/callback',
      '/accept-invitation',
      '/auth/email-sent',
      '/mfa-challenge',
      '/reset-password',
      '/disclaimer',
      '/terms',
      '/privacy-policy',
      '/help',
      '/maintenance', // ADDED: Maintenance page is public
    ];
    
    const currentPathBase = location.pathname.split('?')[0].split('#')[0];

    // ADDED: Maintenance Mode Redirection Logic
    if (!loadingAppSettings && appSettings?.is_maintenance_mode && !isAdmin && !publicPaths.includes(currentPathBase)) {
      navigate('/maintenance', { replace: true });
      return; // Stop further redirection checks
    }

    if (!isSessionLoading && !session && !publicPaths.includes(currentPathBase)) {
      navigate('/', { replace: true });
    }
  }, [location, session, navigate, isSessionLoading, appSettings, loadingAppSettings, isAdmin, loadingAdminStatus]); // MODIFIED: Add appSettings, loadingAppSettings, isAdmin, loadingAdminStatus to dependency array

  const handleOpenHelpModal = () => {
    if (session) {
      setIsDashboardHelpModal(true);
    } else {
      navigate('/login?redirect=' + encodeURIComponent(location.pathname + location.search));
    }
  };

  return (
    <ContractProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-700">
        <ErrorBoundary>
          <Routes>
            {/* ADDED: Maintenance Page Route */}
            <Route path="/maintenance" element={<MaintenancePage />} />

            {/* Routes without Header (truly no header) */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
            <Route path="/checkout/success" element={<CheckoutSuccess />} />
            <Route path="/checkout/cancel" element={<CheckoutCancel />} />
            <Route path="/mfa-challenge" element={<MfaChallengePage />} />
            <Route path="/public-report-view" element={<PublicReportViewerPage />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Routes with Header (using MainLayout) */}
            <Route element={<MainLayout
              onOpenHelpModal={handleOpenHelpModal}
              isDashboardHelpModalOpen={isDashboardHelpModalOpen}
              setIsDashboardHelpModal={setIsDashboardHelpModal}
            />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/auth/email-sent" element={<EmailSentPage />} />
              <Route path="/disclaimer" element={<DisclaimerPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="/help" element={<HelpPage />} />            
              <Route path="/sample-dashboard" element={<LandingPageSampleDashboard />} />
              <Route path="/landing-pricing" element={<LandingPagePricingSection />} /> 

              {/* Protected Routes - wrapped with AuthGuard */}
              <Route element={<AuthGuard />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/contracts" element={<ContractsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/settings/*" element={<SettingsPage />} />
                <Route path="/pricing" element={<PricingSection />} />
                <Route path="/upload" element={<UploadPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
              </Route>

              {/* Admin Protected Routes - wrapped with AdminGuard */}
              <Route element={<AdminGuard />}>
                <Route path="/admin" element={<AdminDashboardPage />} />
                <Route path="/admin/inquiries" element={<AdminInquiriesPage />} />
                <Route path="/admin/support-tickets" element={<AdminSupportTicketsPage />} />
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/admin/contracts" element={<AdminContractsPage />} />
                <Route path="/admin/settings" element={<AdminSettingsPage />} />
                <Route path="/admin/reports" element={<AdminReportsPage />} />
              </Route>
            </Route>
          </Routes>
        </ErrorBoundary>
      </div>
    </ContractProvider>
  );
}

export default App;