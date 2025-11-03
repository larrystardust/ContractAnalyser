import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useLocation, useNavigate, useNavigationType } from 'react-router-dom';

import { ContractProvider } from './context/ContractContext';
import './index.css';
import AuthGuard from './components/AuthGuard';
import AdminGuard from './components/AdminGuard';
import { useTheme } from './hooks/useTheme';
import MainLayout from './components/layout/MainLayout';
import ErrorBoundary from './components/ErrorBoundary';
import { useAppSettings } from './hooks/useAppSettings';
import { useIsAdmin } from './hooks/useIsAdmin';
import { useTranslation } from 'react-i18next'; 

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
const DashboardHelpModal = lazy(() => import('./components/dashboard/DashboardHelpModal'));
// REMOVED: MobileAuthCallbackPage import

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
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
      // REMOVED: '/mobile-auth-callback',
      // The /mobile-camera and /mobile-camera-redirect routes are no longer needed
      // as the camera functionality is now integrated directly into /upload.
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
  }, [location, navigate, appSettings, loadingAppSettings, isAdmin, loadingAdminStatus]);

  const handleOpenHelpModal = () => {
    navigate('/dashboard-help');
  };

  return (
    <ContractProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-700">
        <ErrorBoundary>
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-700"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div></div>}>
            <Routes>
              <Route path="/maintenance" element={<MaintenancePage />} />

              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
              <Route path="/checkout/success" element={<CheckoutSuccess />} />
              <Route path="/checkout/cancel" element={<CheckoutCancel />} />
              <Route path="/mfa-challenge" element={<MfaChallengePage />} />
              <Route path="/public-report-view" element={<PublicReportViewerPage />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              {/* REMOVED: <Route path="/mobile-auth-callback" element={<MobileAuthCallbackPage />} /> */}

              <Route element={<MainLayout
                onOpenHelpModal={handleOpenHelpModal}
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

                <Route element={<AuthGuard />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/contracts" element={<ContractsPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/settings/*" element={<SettingsPage />} />
                  <Route path="/pricing" element={<PricingSection />} />
                  <Route path="/upload" element={<UploadPage />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />

                  <Route path="/dashboard-help" element={<DashboardHelpModal />} />
                </Route>

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
          </Suspense>
        </ErrorBoundary>
      </div>
    </ContractProvider>
  );
}

export default App;