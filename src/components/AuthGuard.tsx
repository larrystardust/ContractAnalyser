import React, { useEffect, useState } from 'react'; // Removed useRef
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Database } from '../types/supabase';
import { useTranslation } from 'react-i18next'; // ADDED: Import useTranslation

interface AuthGuardProps {
  children?: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = () => {
  const { session, isLoading: loadingSession } = useSessionContext();
  const supabase = useSupabaseClient<Database>();
  const location = useLocation();
  const navigate = useNavigate(); // useNavigate must be called unconditionally
  const { t } = useTranslation(); // ADDED: Initialize useTranslation

  const [targetAal, setTargetAal] = useState<'aal1' | 'aal2' | null>(null);
  const [loadingAuthChecks, setLoadingAuthChecks] = useState(true);
  const [isRecoverySessionActive, setIsRecoverySessionActive] = useState(false); // Renamed for clarity
  const [hasPasswordResetCompleted, setHasPasswordResetCompleted] = useState(false); // New state

  // Effect to track if password reset has completed
  useEffect(() => {
    const resetFlowCompleted = localStorage.getItem('passwordResetCompleted');
    if (resetFlowCompleted === 'true') {
      setHasPasswordResetCompleted(true);
      // Clear these localStorage items immediately once detected as completed
      localStorage.removeItem('passwordResetFlowActive');
      localStorage.removeItem('passwordResetFlowStartTime');
      localStorage.removeItem('passwordResetCompleted');
    } else {
      setHasPasswordResetCompleted(false);
    }
  }, [session]); // Re-run when session changes (e.g., after signOut)

  // Effect to determine if a recovery session is active based on hash and localStorage
  useEffect(() => {
    const hashParams = new URLSearchParams(location.hash.substring(1));
    const hashType = hashParams.get('type');
    const isHashRecovery = hashType === 'recovery';

    const isLocalStorageActive = localStorage.getItem('passwordResetFlowActive') === 'true';
    const startTime = localStorage.getItem('passwordResetFlowStartTime');
    const isLocalStorageValid = isLocalStorageActive && startTime && (Date.now() - parseInt(startTime)) < 15 * 60 * 1000;

    // A recovery session is active if the hash indicates it OR localStorage indicates it.
    setIsRecoverySessionActive(isHashRecovery || isLocalStorageValid);

    // If hash is recovery, ensure localStorage flags are set for cross-tab sync
    if (isHashRecovery && !isLocalStorageActive) {
      localStorage.setItem('passwordResetFlowActive', 'true');
      localStorage.setItem('passwordResetFlowStartTime', Date.now().toString());
    }
  }, [location.hash]);

  // --- ALL HOOKS MUST BE CALLED ABOVE THIS LINE ---

  // BLOCK ALL ACCESS DURING PASSWORD RESET FLOW
  // Only consider it a recovery session if isRecoverySessionActive is true AND the reset hasn't completed.
  const shouldBlockForRecovery = isRecoverySessionActive && !hasPasswordResetCompleted;

  if (shouldBlockForRecovery) {
    // Set global flag to block modals and overlays
    localStorage.setItem('blockModalsDuringReset', 'true');
    
    if (location.pathname === '/reset-password') {
      return <Outlet />;
    } else {
      const redirectHash = location.hash.includes('type=recovery') ? location.hash : '';
      const redirectUrl = `/reset-password${redirectHash}`;
      return <Navigate to={redirectUrl} replace />;
    }
  } else {
    // Clear modal blocking when not in an active recovery flow
    localStorage.removeItem('blockModalsDuringReset');
  }

  // Show loading indicator for initial session loading
  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  // Show loading indicator for authentication checks (MFA, admin status etc.)
  if (loadingAuthChecks) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  // If not authenticated, redirect to login
  if (!session || !session.user) {
    console.log(t('auth_session_missing'));
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  // If MFA is required (aal1), redirect to MFA challenge
  if (targetAal === 'aal1') {
    return <Navigate to={`/mfa-challenge?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  // If authenticated and MFA passed (aal2), render protected content
  if (targetAal === 'aal2') {
    return <Outlet />;
  }

  // Fallback: Should ideally not be reached, but redirects to login if an unexpected state occurs
  return <Navigate to="/login" replace />;
};

export default AuthGuard;