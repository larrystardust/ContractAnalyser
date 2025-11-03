import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
// REMOVED: Direct imports for page components

import { ContractProvider } from './context/ContractContext';
import './index.css';
import AuthGuard from './components/AuthGuard'; // Keep direct import for AuthGuard
import AdminGuard from './components/AdminGuard'; // Keep direct import for AdminGuard
import { useTheme } from './hooks/useTheme';
import MainLayout from './components/layout/MainLayout'; // Keep direct import for MainLayout
import ErrorBoundary from './components/ErrorBoundary';
import { useAppSettings } from './hooks/useAppSettings';
import { useIsAdmin } from './hooks/useIsAdmin';
import { useTranslation } from 'react-i18next'; 

// MODIFIED: Lazy load all page components
const Dashboard = lazy(() => import('./components/dashboard/Dashboard'));
const PricingSection = lazy(() => import('./components/pricing/PricingSection'));
const CheckoutSuccess = lazy(() => import('./components/checkout/CheckoutSuccess'));
const CheckoutCancel = lazy(() => import('./components/checkout/CheckoutCancel'));
const UploadPage = lazy(() => import('./pages/UploadPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const EmailConfirmationPage = lazy(() => import('./pages/EmailConfirmationPage'));
const EmailSentPage = lazy(() => import('./pages/EmailSentPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ContractsPage = lazy(() => import('./pages/ContractsPage'));
const DisclaimerPage = lazy(() => import('./pages/DisclaimerPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const HelpPage = lazy(() => import('./pages/HelpPage'));
const AcceptInvitationPage = lazy(() => import('./pages/AcceptInvitationPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const AdminInquiriesPage = lazy(() => import('./pages/AdminInquiriesPage'));
const AdminSupportTicketsPage = lazy(() => import('./pages/AdminSupportTicketsPage'));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'));
const AdminContractsPage = lazy(() => import('./pages/AdminContractsPage'));
const AdminSettingsPage = lazy(() => import('./pages/AdminSettingsPage'));
const AdminReportsPage = lazy(() => import('./pages/AdminReportsPage'));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));
const MfaChallengePage = lazy(() => import('./pages/MfaChallengePage'));
const PublicReportViewerPage = lazy(() => import('./pages/PublicReportViewerPage'));
const LandingPageSampleDashboard = lazy(() => import('./components/dashboard/LandingPageSampleDashboard'));
const LandingPagePricingSection = lazy(() => import('./components/pricing/LandingPagePricingSection')); 
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const MaintenancePage = lazy(() => import('./pages/MaintenancePage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const BlogPostPage = lazy(() => import('./pages/BlogPostPage'));
const DashboardHelpModal = lazy(() => import('./components/dashboard/DashboardHelpModal')); // This is a route, so lazy load it.
const MobileCameraApp = lazy(() => import('./pages/MobileCameraApp')); // ADDED: Lazy load MobileCameraApp
const MobileCameraRedirect = lazy(() => import('./pages/MobileCameraRedirect')); // ADDED: Lazy load MobileCameraRedirect

function App() {
  // REMOVED: isDashboardHelpModalOpen state
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  // REMOVED: useSessionContext and useSupabaseClient as they are not directly used here anymore
  const { settings: appSettings, loading: loadingAppSettings } = useAppSettings();
  const { isAdmin, loadingAdminStatus } = useIsAdmin();
  const { t } = useTranslation();

  useTheme();

  // MODIFIED: Removed session and isSessionLoading from dependencies as they are not directly used here
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
      '/mobile-camera', // ADDED: Mobile camera app is a public path
      '/mobile-camera-redirect', // ADDED: Mobile camera redirect is a public path
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

    // The AuthGuard now handles redirection for unauthenticated users
    // if (!isSessionLoading && !session && !isPublicPath(currentPathBase)) {
    //   navigate('/', { replace: true });
    // }
  }, [location, navigate, appSettings, loadingAppSettings, isAdmin, loadingAdminStatus]); // MODIFIED: Removed session, isSessionLoading, supabase from dependencies

  // MODIFIED: handleOpenHelpModal now navigates to the help page
  const handleOpenHelpModal = () => {
    // The AuthGuard will handle authentication checks for /dashboard-help
    navigate('/dashboard-help'); // Navigate to the standalone help page
  };

  return (
    <ContractProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-700">
        <ErrorBoundary>
          {/* MODIFIED: Added Suspense for lazy-loaded routes */}
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-700"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div></div>}>
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
              <Route path="/mobile-camera" element={<MobileCameraApp />} /> {/* ADDED: New route for mobile camera app */}
              <Route path="/mobile-camera-redirect" element={<MobileCameraRedirect />} /> {/* ADDED: New route for mobile camera redirect */}

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
          </Suspense> {/* END Suspense */}
        </ErrorBoundary>
      </div>
    </ContractProvider>
  );
}

export default App;