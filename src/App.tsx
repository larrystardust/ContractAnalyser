import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
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
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'; // Added useSupabaseClient
import PublicReportViewerPage from './pages/PublicReportViewerPage';
import LandingPageSampleDashboard from './components/dashboard/LandingPageSampleDashboard';
import LandingPagePricingSection from './components/pricing/LandingPagePricingSection'; 
import ResetPassword from './pages/ResetPassword';
import RecoveryInProgressPage from './pages/RecoveryInProgressPage'; // NEW IMPORT

// Define constants for localStorage keys and expiry duration
const RECOVERY_FLAG = 'password_recovery_active';
const RECOVERY_EXPIRY = 'password_recovery_expiry';

function App() {
  const [isDashboardHelpModalOpen, setIsDashboardHelpModal] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const session = useSession();
  const supabase = useSupabaseClient(); // Initialize Supabase client

  // State to track global recovery status, initialized from localStorage
  const [isRecoveryActiveGlobally, setIsRecoveryActiveGlobally] = useState(() => {
    const recoveryFlagInLocalStorage = localStorage.getItem(RECOVERY_FLAG) === 'true';
    const recoveryExpiryInLocalStorage = parseInt(localStorage.getItem(RECOVERY_EXPIRY) || '0', 10);
    return recoveryFlagInLocalStorage && Date.now() < recoveryExpiryInLocalStorage;
  });

  // Function to check and update recovery status from localStorage
  const checkRecoveryStatus = () => {
    const recoveryFlagInLocalStorage = localStorage.getItem(RECOVERY_FLAG) === 'true';
    const recoveryExpiryInLocalStorage = parseInt(localStorage.getItem(RECOVERY_EXPIRY) || '0', 10);
    return recoveryFlagInLocalStorage && Date.now() < recoveryExpiryInLocalStorage;
  };

  // Effect to listen for localStorage changes and update recovery status
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === RECOVERY_FLAG || event.key === RECOVERY_EXPIRY) {
        console.log('App.tsx: Storage event detected. Re-checking recovery status.');
        setIsRecoveryActiveGlobally(checkRecoveryStatus());
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Cleanup listener on component unmount
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // --- CRITICAL: Immediate check and redirection for recovery state ---
  // This logic runs on every render, ensuring immediate enforcement.
  const currentPathBase = location.pathname.split('?')[0].split('#')[0];
  const isResetPasswordPage = currentPathBase === '/reset-password';
  const isRecoveryInProgressPage = currentPathBase === '/recovery-in-progress';

  if (isRecoveryActiveGlobally && !isResetPasswordPage && !isRecoveryInProgressPage) {
    console.log(`App.tsx: Global recovery active. Forcing sign out and redirecting ${currentPathBase} to /recovery-in-progress.`);
    // Force sign out the user in this tab immediately
    // This is a fire-and-forget, as the navigation will happen regardless.
    supabase.auth.signOut().catch(error => {
      console.error('App.tsx: Error signing out during immediate recovery enforcement:', error);
    });
    // Immediately navigate to the recovery in progress page
    navigate('/recovery-in-progress', { replace: true });
    return null; // Prevent rendering any other content while redirecting
  }

  // --- Standard authentication redirects (only if NOT in a global recovery state) ---
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
      '/recovery-in-progress',
    ];
    
    // Only proceed with other redirects if not in a global recovery state
    // or if on the designated reset/recovery page.
    if (!isRecoveryActiveGlobally || isResetPasswordPage || isRecoveryInProgressPage) {
      // If no session AND not on a public path, redirect to landing page.
      if (!session && !publicPaths.includes(currentPathBase)) {
        console.log(`App.tsx: No session and not public path. Redirecting ${currentPathBase} to /.`);
        navigate('/', { replace: true });
        return; // Stop further redirects
      }

      // If session exists and user is on login/signup/etc., redirect to dashboard.
      if (session && (currentPathBase === '/login' || currentPathBase === '/signup')) {
        console.log(`App.tsx: Session exists on login/signup. Redirecting to /dashboard.`);
        navigate('/dashboard', { replace: true });
        return; // Stop further redirects
      }
    }

  }, [location, session, navigate, isRecoveryActiveGlobally, isResetPasswordPage, isRecoveryInProgressPage]); // Added all relevant dependencies

  const handleOpenHelpModal = () => setIsDashboardHelpModal(true);

  return (
    <ContractProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-700">
        <Routes>
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
          <Route path="/recovery-in-progress" element={<RecoveryInProgressPage />} /> {/* NEW ROUTE */}

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
            <Route path="/pricing" element={<PricingSection />} />
            <Route path="/sample-dashboard" element={<LandingPageSampleDashboard />} />
            <Route path="/landing-pricing" element={<LandingPagePricingSection />} /> 

            {/* Protected Routes - wrapped with AuthGuard */}
            <Route element={<AuthGuard />}> 
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/contracts" element={<ContractsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings/*" element={<SettingsPage />} />
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
      </div>
    </ContractProvider>
  );
}

export default App;