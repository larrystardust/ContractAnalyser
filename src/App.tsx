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
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react'; // ✅ FIXED
import PublicReportViewerPage from './pages/PublicReportViewerPage';
import LandingPageSampleDashboard from './components/dashboard/LandingPageSampleDashboard';
import LandingPagePricingSection from './components/pricing/LandingPagePricingSection'; 
import ResetPassword from './pages/ResetPassword';
import ErrorBoundary from './components/ErrorBoundary';
import MaintenancePage from './pages/MaintenancePage';
import { useAppSettings } from './hooks/useAppSettings';
import { useIsAdmin } from './hooks/useIsAdmin';
import BlogPage from './pages/BlogPage';
import BlogPostPage from './pages/BlogPostPage';
import Modal from './components/ui/Modal'; 
import DashboardHelpModal from './components/dashboard/DashboardHelpModal'; 
import { useTranslation } from 'react-i18next'; 

function App() {
  // REMOVED: isDashboardHelpModalOpen state
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const { session, isLoading: isSessionLoading } = useSessionContext();
  const supabase = useSupabaseClient(); // ✅ FIXED: Add supabase client
  const { settings: appSettings, loading: loadingAppSettings } = useAppSettings();
  const { isAdmin, loadingAdminStatus } = useIsAdmin();
  const { t } = useTranslation();

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
      '/maintenance',
      '/blog',
      '/blog/:slug',
    ];
    
    const currentPathBase = location.pathname.split('?')[0].split('#')[0];

    const isPublicPath = (pathToCheck: string) => {
      return publicPaths.some(publicPathPattern => {
        if (publicPathPattern.includes(':slug')) {
          const regexPattern = new RegExp('^' + publicPathPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:slug/g, '[^/]+') + '$');
          return regexPattern.test(pathToCheck);
        }
        return publicPathPattern === pathToCheck;
      });
    };

    if (!loadingAppSettings && appSettings?.is_maintenance_mode && !isAdmin && !isPublicPath(currentPathBase)) {
      navigate('/maintenance', { replace: true });
      return;
    }

    if (!isSessionLoading && !session && !isPublicPath(currentPathBase)) {
      navigate('/', { replace: true });
    }
  }, [location, session, navigate, isSessionLoading, appSettings, loadingAppSettings, isAdmin, loadingAdminStatus]);

  // MODIFIED: handleOpenHelpModal now navigates to the help page
  const handleOpenHelpModal = async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      navigate('/dashboard-help'); // Navigate to the standalone help page
    } else {
      navigate('/'); // kick unauthenticated users back to landing
    }
  };

  return (
    <ContractProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-700">
        <ErrorBoundary>
          <Routes>
            <Route path="/maintenance" element={<MaintenancePage />} />

            {/* Routes without Header */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
            <Route path="/checkout/success" element={<CheckoutSuccess />} />
            <Route path="/checkout/cancel" element={<CheckoutCancel />} />
            <Route path="/mfa-challenge" element={<MfaChallengePage />} />
            <Route path="/public-report-view" element={<PublicReportViewerPage />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Routes with Header (MainLayout) */}
            <Route element={<MainLayout
              onOpenHelpModal={handleOpenHelpModal}
              // REMOVED: isDashboardHelpModalOpen and setIsDashboardHelpModal props
            />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/auth/email-sent" element={<EmailSentPage />} />
              <Route path="/disclaimer" element={<DisclaimerPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="/help" element={<HelpPage />} />            
              <Route path="/sample-dashboard" element={<LandingPageSampleDashboard />} />
              <Route path="/landing-pricing" element={<LandingPagePricingSection />} /> 
              <Route path="/blog" element={<BlogPage />} />
              <Route path="/blog/:slug" element={<BlogPostPage />} />

              {/* Protected Routes */}
              <Route element={<AuthGuard />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/contracts" element={<ContractsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/settings/*" element={<SettingsPage />} />
                <Route path="/pricing" element={<PricingSection />} />
                <Route path="/upload" element={<UploadPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />

                {/* MODIFIED: DashboardHelpModal is now a standalone route */}
                <Route path="/dashboard-help" element={<DashboardHelpModal />} />
              </Route>

              {/* Admin Protected Routes */}
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