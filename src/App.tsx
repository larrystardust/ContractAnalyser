import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { useSupabaseClient, useSessionContext } from '@supabase/auth-helpers-react';

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
const MobileCameraApp = lazy(() => import('./pages/MobileCameraApp'));

const MOBILE_AUTH_CONTEXT_KEY = 'mobile_auth_context';
const MOBILE_AUTH_FLOW_ACTIVE_FLAG = 'mobile_auth_flow_active'; // NEW: Persistent flag for mobile auth flow

function App() {
  const supabase = useSupabaseClient();
  const { session } = useSessionContext();
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const { settings: appSettings, loading: loadingAppSettings } = useAppSettings();
  const { isAdmin, loadingAdminStatus } = useIsAdmin();
  const { t, i18n } = useTranslation();

  useTheme();

  const [isMobileAuthFlowInProgress, setIsMobileAuthFlowInProgress] = useState(false);

  // NEW: useEffect for persistent redirection to /mobile-camera
  useEffect(() => {
    const mobileAuthFlowActive = localStorage.getItem(MOBILE_AUTH_FLOW_ACTIVE_FLAG) === 'true';
    if (mobileAuthFlowActive && !loadingAppSettings && !loadingAdminStatus && session?.user && location.pathname !== '/mobile-camera') {
      console.log('App.tsx: Persistent mobile auth flow detected. Redirecting to /mobile-camera.');
      setIsMobileAuthFlowInProgress(true); // Show spinner during persistent redirect
      navigate('/mobile-camera', { replace: true });
    } else if (!mobileAuthFlowActive && isMobileAuthFlowInProgress && location.pathname !== '/mobile-camera') {
      // If the flag is cleared externally (e.g., by MobileCameraApp) and we are not on /mobile-camera,
      // then we can safely turn off the spinner.
      setIsMobileAuthFlowInProgress(false);
    }
  }, [session?.user, location.pathname, navigate, loadingAppSettings, loadingAdminStatus, isMobileAuthFlowInProgress]); // Added isMobileAuthFlowInProgress to dependencies


  // MODIFIED: Existing useEffect for handling mobile authentication redirect
  useEffect(() => {
    const handleMobileAuthRedirect = async () => {
      const queryParams = new URLSearchParams(location.search);
      const hashParams = new URLSearchParams(location.hash.substring(1));

      const queryScanSessionId = queryParams.get('scanSessionId');
      const queryAuthToken = queryParams.get('auth_token');
      const queryLang = queryParams.get('lang');
      const supabaseAccessToken = hashParams.get('access_token');
      const supabaseRefreshToken = hashParams.get('refresh_token');

      const isInitialMobileAuthLanding = queryScanSessionId && queryAuthToken;
      const isSupabaseRedirectAfterMagicLink = supabaseAccessToken && supabaseRefreshToken;
      // const mobileAuthFlowActiveFromStorage = localStorage.getItem(MOBILE_AUTH_FLOW_ACTIVE_FLAG) === 'true'; // REMOVED: No longer needed here

      // Only set isMobileAuthFlowInProgress if an *active* mobile auth event is detected
      // This prevents the spinner from re-activating on subsequent re-renders if the flag is still in localStorage
      if (isInitialMobileAuthLanding || isSupabaseRedirectAfterMagicLink) {
        setIsMobileAuthFlowInProgress(true);
      } else {
        // If no active event, and we are not already in the flow, then exit.
        // If we are already in the flow (e.g., persistent redirect from top useEffect),
        // then this function should not interfere with isMobileAuthFlowInProgress.
        if (!isMobileAuthFlowInProgress) { // Only return if not already showing spinner
          return;
        }
      }

      console.log('App.tsx: handleMobileAuthRedirect triggered.');
      console.log('App.tsx: Current location.search:', location.search);
      console.log('App.tsx: Current location.hash:', location.hash);
      console.log('App.tsx: queryScanSessionId:', queryScanSessionId);
      console.log('App.tsx: queryAuthToken:', queryAuthToken);
      console.log('App.tsx: queryLang:', queryLang);
      console.log('App.tsx: supabaseAccessToken (from hash):', supabaseAccessToken ? 'present' : 'absent');
      console.log('App.tsx: supabaseRefreshToken (from hash):', supabaseRefreshToken ? 'present' : 'absent');

      // Scenario 1: Initial landing from QR code scan (has query params)
      if (isInitialMobileAuthLanding) {
        console.log('App.tsx: Scenario 1 - Detected scanSessionId and auth_token in query parameters.');

        // Prevent re-processing if already handled
        if (localStorage.getItem('mobile_auth_processing_query') === 'true') {
          console.log('App.tsx: Already processing query params, skipping re-invocation.');
          return;
        }
        localStorage.setItem('mobile_auth_processing_query', 'true');
        localStorage.setItem(MOBILE_AUTH_FLOW_ACTIVE_FLAG, 'true'); // NEW: Set persistent flag

        // Store context in localStorage
        localStorage.setItem(MOBILE_AUTH_CONTEXT_KEY, JSON.stringify({
          scanSessionId: queryScanSessionId,
          authToken: queryAuthToken,
          lang: queryLang,
        }));
        console.log('App.tsx: Context stored in localStorage.');

        // Clear query parameters from the URL immediately
        // This is crucial to prevent infinite loops or re-triggering this block
        navigate(location.pathname, { replace: true });
        console.log('App.tsx: Query parameters cleared from URL.');

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

          if (invokeError) {
            console.error('App.tsx: Error invoking mobile-auth Edge Function:', invokeError);
            throw invokeError;
          }
          if (!data?.redirectToUrl) {
            console.error('App.tsx: Failed to get redirect URL from server (no redirectToUrl in response).');
            throw new Error('Failed to get redirect URL from server.');
          }

          console.log('App.tsx: Received magic link. Redirecting to:', data.redirectToUrl);
          localStorage.removeItem('mobile_auth_processing_query');
          window.location.replace(data.redirectToUrl); // This will trigger Supabase's auth flow
          return;

        } catch (err: any) {
          console.error('App.tsx: Error during mobile authentication initiation:', err);
          localStorage.removeItem(MOBILE_AUTH_CONTEXT_KEY);
          localStorage.removeItem('mobile_auth_processing_query');
          localStorage.removeItem(MOBILE_AUTH_FLOW_ACTIVE_FLAG); // NEW: Clear persistent flag on error
          setIsMobileAuthFlowInProgress(false);
          navigate('/login', { replace: true }); // Redirect to login on error
          return;
        }
      }

      // Scenario 2: Redirect back from Supabase auth (has hash params, context in localStorage)
      const storedContext = localStorage.getItem(MOBILE_AUTH_CONTEXT_KEY);
      if (isSupabaseRedirectAfterMagicLink) {
        console.log('App.tsx: Scenario 2 - Detected Supabase session tokens in URL hash.');

        if (storedContext) {
          console.log('App.tsx: Found stored mobile auth context in localStorage.');
          try {
            const { lang: storedLang } = JSON.parse(storedContext);

            if (storedLang && i18n.language !== storedLang) {
              console.log(`App.tsx: Changing i18n language to ${storedLang} from mobile auth context.`);
              await i18n.changeLanguage(storedLang);
              localStorage.setItem('i18nextLng', storedLang);
              if (storedLang === 'ar') {
                document.documentElement.setAttribute('dir', 'rtl');
              } else {
                document.documentElement.setAttribute('dir', 'ltr');
              }
            }

            const { error: sessionError } = await supabase.auth.setSession({
              access_token: supabaseAccessToken,
              refresh_token: supabaseRefreshToken,
            });

            if (sessionError) {
              console.error('App.tsx: Error setting Supabase session from hash:', sessionError);
              localStorage.removeItem(MOBILE_AUTH_CONTEXT_KEY);
              localStorage.removeItem(MOBILE_AUTH_FLOW_ACTIVE_FLAG); // NEW: Clear persistent flag on error
              setIsMobileAuthFlowInProgress(false);
              navigate('/login', { replace: true });
              return;
            }

            console.log('App.tsx: Supabase session set. Clearing stored context and redirecting to /mobile-camera.');
            localStorage.removeItem('mobile_auth_processing_query');
            setIsMobileAuthFlowInProgress(false); // MODIFIED: Set to false here to stop spinner in App.tsx
            navigate('/mobile-camera', { replace: true }); // NEW: Direct to mobile-camera
            return;

          } catch (err: any) {
            console.error('App.tsx: Error processing stored mobile auth context:', err);
            localStorage.removeItem(MOBILE_AUTH_CONTEXT_KEY);
            localStorage.removeItem('mobile_auth_processing_query');
            localStorage.removeItem(MOBILE_AUTH_FLOW_ACTIVE_FLAG); // NEW: Clear persistent flag on error
            setIsMobileAuthFlowInProgress(false);
            navigate('/login', { replace: true });
            return;
          }
        } else {
          console.warn('App.tsx: Supabase session tokens found, but no mobile auth context in localStorage. This might be a regular login or a failed mobile auth attempt. Redirecting to login.');
          localStorage.removeItem(MOBILE_AUTH_FLOW_ACTIVE_FLAG); // NEW: Clear persistent flag if context is missing
          setIsMobileAuthFlowInProgress(false);
          navigate('/login', { replace: true });
          return;
        }
      }
    };

    handleMobileAuthRedirect();
  }, [location.hash, location.search, navigate, supabase.auth, i18n]);

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
      '/mobile-camera',
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

  if (isMobileAuthFlowInProgress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-700">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
        <p className="text-gray-500 mt-4">{t('mobile_auth_landing_please_wait')}</p>
      </div>
    );
  }

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
              <Route path="/mobile-camera" element={<MobileCameraApp />} />

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
          </Suspense>
        </ErrorBoundary>
      </div>
    </ContractProvider>
  );
}

export default App;