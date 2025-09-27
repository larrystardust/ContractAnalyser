import React, { useEffect, useState } from 'react';
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Database } from '../types/supabase';
import { useTranslation } from 'react-i18next';

interface AuthGuardProps {
  children?: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = () => {
  const { session, isLoading: loadingSession } = useSessionContext();
  const supabase = useSupabaseClient<Database>();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [targetAal, setTargetAal] = useState<'aal1' | 'aal2' | null>(null);
  const [loadingAuthChecks, setLoadingAuthChecks] = useState(true);
  const [isRecoverySessionActive, setIsRecoverySessionActive] = useState(false);
  // REMOVED: const [hasPasswordResetCompleted, setHasPasswordResetCompleted] = useState(false); // Removed this state

  // REMOVED: useEffect for hasPasswordResetCompleted

  // Effect to determine if a recovery session is active based on hash and localStorage
  useEffect(() => {
    const checkRecoveryState = () => {
      const hashParams = new URLSearchParams(location.hash.substring(1));
      const isHashRecovery = hashParams.get('type') === 'recovery';

      const isLocalStorageFlowActive = localStorage.getItem('passwordResetFlowActive') === 'true';
      const startTime = localStorage.getItem('passwordResetFlowStartTime');
      const isLocalStorageFlowValid = isLocalStorageFlowActive && startTime && (Date.now() - parseInt(startTime)) < 15 * 60 * 1000;

      // A recovery session is active if the hash indicates it OR localStorage indicates it AND it's still valid.
      const currentlyActive = isHashRecovery || isLocalStorageFlowValid;
      setIsRecoverySessionActive(currentlyActive);

      // If hash indicates recovery, ensure localStorage flags are set for cross-tab sync
      if (isHashRecovery && !isLocalStorageFlowActive) {
        localStorage.setItem('passwordResetFlowActive', 'true');
        localStorage.setItem('passwordResetFlowStartTime', Date.now().toString());
      } 
      // If neither hash nor valid localStorage indicates recovery, and localStorage was active, clear it.
      // This ensures a clean exit from the recovery state.
      else if (!isHashRecovery && !isLocalStorageFlowValid && isLocalStorageFlowActive) { // CRITICAL FIX: Corrected typo from isLocalStorageValid to isLocalStorageFlowValid
          localStorage.removeItem('passwordResetFlowActive');
          localStorage.removeItem('passwordResetFlowStartTime');
      }
    };

    checkRecoveryState();

    // Listen for storage changes to react to other tabs clearing the flags
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'passwordResetFlowActive' || e.key === 'passwordResetFlowStartTime') {
        checkRecoveryState(); // Re-evaluate if flags change
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [location.hash]); // Depend on location.hash


  // Normal authentication flow check (moved to be unconditional)
  useEffect(() => {
    const checkAuthStatus = async () => {
      if (loadingSession) return; // Wait for session to load

      setLoadingAuthChecks(true);

      if (!session?.user) {
        setTargetAal(null);
        setLoadingAuthChecks(false);
        return;
      }

      try {
        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) {
          setTargetAal('aal2');
          setLoadingAuthChecks(false);
          return;
        }

        const hasMfaEnrolled = factors.totp.length > 0;

        if (hasMfaEnrolled) {
          const mfaPassedFlag = localStorage.getItem('mfa_passed');
          if (mfaPassedFlag === 'true') {
            setTargetAal('aal2');
          } else {
            setTargetAal('aal1');
          }
        } else {
          setTargetAal('aal2');
        }
      } catch (err) {
        console.error("AuthGuard: Error during MFA check:", err);
        setTargetAal('aal2'); // Fallback to allow access on unexpected errors
      } finally {
        setLoadingAuthChecks(false);
      }
    };

    checkAuthStatus();
  }, [session, loadingSession, supabase]);


  // --- ALL HOOKS MUST BE CALLED ABOVE THIS LINE ---

  // BLOCK ALL ACCESS DURING PASSWORD RESET FLOW
  // The blocking condition is now simply isRecoverySessionActive
  if (isRecoverySessionActive) { // MODIFIED: Simplified condition
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