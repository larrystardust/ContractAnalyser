import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate, useNavigationType } from 'react-router-dom'; // MODIFIED: Added useLocation, useNavigate, useNavigationType
// REMOVED: import Header from './components/layout/Header';
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
import PasswordResetPage from './pages/PasswordResetPage';
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
// REMOVED: import Modal from './components/ui/Modal';
// REMOVED: import DashboardHelpModal from './components/dashboard/DashboardHelpModal';
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
import MfaChallengePage from './pages/MfaChallengePage'; // ADDED: Import MfaChallengePage
import { useSession } from '@supabase/auth-helpers-react'; // MODIFIED: Import useSession

function App() {
  const [isDashboardHelpModalOpen, setIsDashboardHelpModal] = useState(false);
  const location = useLocation(); // MODIFIED
  const navigate = useNavigate(); // MODIFIED
  const navigationType = useNavigationType(); // MODIFIED
  const session = useSession(); // MODIFIED

  useTheme();

  // MODIFIED: Effect to handle back button redirection after logout
  useEffect(() => {
    // If there's no session (user is logged out)
    // AND the navigation type is 'POP' (browser back/forward button)
    // AND the current path is not the landing page
    if (!session && navigationType === 'POP' && location.pathname !== '/') {
      navigate('/', { replace: true }); // Redirect to landing page and replace the history entry
    }
  }, [location, navigationType, session, navigate]); // Dependencies for the effect

  const handleOpenHelpModal = () => setIsDashboardHelpModal(true);

  return (
    <ContractProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-700">
        <Routes>
          {/* Routes without Header (truly no header) */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/password-reset" element={<PasswordResetPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
          <Route path="/checkout/success" element={<CheckoutSuccess />} />
          <Route path="/checkout/cancel" element={<CheckoutCancel />} />
          <Route path="/mfa-challenge" element={<MfaChallengePage />} /> {/* ADDED: MFA Challenge Route */}

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