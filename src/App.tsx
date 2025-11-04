import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { useSupabaseClient, useSessionContext } from '@supabase/auth-helpers-react'; // ADDED: Import useSupabaseClient and useSessionContext

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
// REMOVED: MobileAuthLanding

const MOBILE_AUTH_CONTEXT_KEY = 'mobile_auth_context'; // ADDED: Define key for localStorage

function App() {
  const supabase = useSupabaseClient(); // ADDED: Get Supabase client
  const { session } = useSessionContext(); // ADDED: Get session context
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const { settings: appSettings, loading: loadingAppSettings } = useAppSettings();
  const { isAdmin, loadingAdminStatus } = useIsAdmin();
  const { t } = useTranslation();

  useTheme();

  // ADDED: New useEffect for handling mobile authentication redirect
  useEffect(() => {
    const handleMobileAuthRedirect = async () => {
      const queryParams = new URLSearchParams(location.search);
      const hashParams = new URLSearchParams(location.hash.substring(1));

      const queryScanSessionId = queryParams.get('scanSessionId');
      const queryAuthToken = queryParams.get('auth_token');
      const supabaseAccessToken = hashParams.get('access_token');
      const supabaseRefreshToken = hashParams.get('refresh_token');

      // Scenario 1: Initial landing from QR code scan (has query params)
      if (queryScanSessionId && queryAuthToken) {
        console.log('App.tsx: Detected scanSessionId and auth_token in query parameters.');
        // Store context in localStorage
        localStorage.setItem(MOBILE_AUTH_CONTEXT_KEY, JSON.stringify({
          scanSessionId: queryScanSessionId,
          authToken: queryAuthToken,
        }));
        console.log('App.tsx: Context stored in localStorage.');

        // Clear query parameters from the URL
        navigate(location.pathname, { replace: true });

        // Now, invoke the mobile-auth Edge Function to get the magic link
        try {
          const appBaseUrl = window.location.origin;
          const supabaseRedirectTarget = `${appBaseUrl}/`; // Supabase will redirect here with its tokens in hash

          console.log('App.tsx: Invoking mobile-auth Edge Function.');
          const { data, error: invokeError } = await supabase.functions.invoke('mobile-auth', {
            body: {
              auth_token: queryAuthToken,
              redirect_to_url: supabaseRedirectTarget,
            },
          });

          if (invokeError) throw invokeError;
          if (!data?.redirectToUrl) throw new Error('Failed to get redirect URL from server.');

          console.log('App.tsx: Received magic link. Redirecting to:', data.redirectToUrl);
          window.location.replace(data.redirectToUrl); // This will trigger Supabase's auth flow
          return;

        } catch (err: any) {
          console.error('App.tsx: Error during mobile authentication initiation:', err);
          localStorage.removeItem(MOBILE_AUTH_CONTEXT_KEY); // Clean up on error
          navigate('/login', { replace: true }); // Redirect to login on error
          return;
        }
      }

      // Scenario 2: Redirect back from Supabase auth (has hash params, context in localStorage)
      const storedContext = localStorage.getItem(MOBILE_AUTH_CONTEXT_KEY);
      if (supabaseAccessToken && supabaseRefreshToken && storedContext) {
        console.log('App.tsx: Detected Supabase session tokens in URL hash and stored context.');
        try {
            const { scanSessionId: storedScanSessionId, authToken: storedAuthToken } = JSON.parse(storedContext);

            // Set the Supabase session
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: supabaseAccessToken,
              refresh_token: supabaseRefreshToken,
            });

            if (sessionError) {
              console.error('App.tsx: Error setting Supabase session from hash:', sessionError);
              localStorage.removeItem(MOBILE_AUTH_CONTEXT_KEY);
              navigate('/login', { replace: true });
              return;
            }

            console.log('App.tsx: Supabase session set. Clearing stored context.');
            localStorage.removeItem(MOBILE_AUTH_CONTEXT_KEY);

            // Construct the final URL for MobileCameraApp with all parameters in hash
            const finalMobileCameraUrl = `/mobile-camera#scanSessionId=${storedScanSessionId}&auth_token=${storedAuthToken}&access_token=${supabaseAccessToken}&refresh_token=${supabaseRefreshToken}`;
            
            console.log('App.tsx: Final redirecting to MobileCameraApp:', finalMobileCameraUrl);
            navigate(finalMobileCameraUrl, { replace: true });
            return;

          } catch (err: any) {
            console.error('App.tsx: Error processing stored mobile auth context:', err);
            localStorage.removeItem(MOBILE_AUTH_CONTEXT_KEY);
            navigate('/login', { replace: true });
            return;
          }
        } else if (supabaseAccessToken && supabaseRefreshToken && !storedContext) {
          console.warn('App.tsx: Supabase session tokens found, but no mobile auth context in localStorage. Assuming regular login. Redirecting to dashboard.');
          // If no context, it might be a regular login, redirect to dashboard
          navigate('/dashboard', { replace: true });
          return;
        }
      }
    };

    handleMobileAuthRedirect();
  }, [location.hash, location.search, navigate, supabase.auth]); // Depend on location.hash and location.search

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
      '/mobile-camera', // Mobile camera app is a public path
      // REMOVED: '/mobile-auth-landing', // Mobile auth landing page is no longer a separate route
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
              <Route path="/mobile-camera" element={<MobileCameraApp />} /> {/* New route for mobile camera app */}
              {/* REMOVED: <Route path="/mobile-auth-landing" element={<MobileAuthLanding />} /> */}

              {/* Routes with Header (MainLayout) */}
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