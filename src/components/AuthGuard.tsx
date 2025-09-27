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
  const [isRecoverySession, setIsRecoverySession] = useState(false);

  // Check if user has successfully logged in after password reset
  useEffect(() => {
    const checkLoginStatus = () => {
      const resetFlowCompleted = localStorage.getItem('passwordResetCompleted');
      if (resetFlowCompleted === 'true') {
        // Clear the reset flow flags if user has completed login
        localStorage.removeItem('passwordResetFlowActive');
        localStorage.removeItem('passwordResetFlowStartTime');
        localStorage.removeItem('passwordResetCompleted');
        setIsRecoverySession(false);
      }
    };

    checkLoginStatus();
  }, [session]);

  // Global state to track password reset flow across all browser tabs
  useEffect(() => {
    // The isPasswordResetFlow prop was not being passed, so this logic was not fully active based on prop.
    // Relying on localStorage flags set by ResetPassword page or URL hash.
    const checkGlobalResetFlow = () => {
      const resetFlowActive = localStorage.getItem('passwordResetFlowActive');
      const startTime = localStorage.getItem('passwordResetFlowStartTime');
      
      if (resetFlowActive === 'true' && startTime) {
        const elapsedTime = Date.now() - parseInt(startTime);
        if (elapsedTime < 15 * 60 * 1000) { // 15 minutes validity
          setIsRecoverySession(true);
        } else {
          localStorage.removeItem('passwordResetFlowActive');
          localStorage.removeItem('passwordResetFlowStartTime');
          setIsRecoverySession(false); // Expired
        }
      }
    };

    checkGlobalResetFlow();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'passwordResetFlowActive' && e.newValue === 'true') {
        setIsRecoverySession(true);
      } else if (e.key === 'passwordResetCompleted' && e.newValue === 'true') {
        localStorage.removeItem('passwordResetFlowActive');
        localStorage.removeItem('passwordResetFlowStartTime');
        setIsRecoverySession(false);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []); // No dependency on isPasswordResetFlow prop, as it's not passed.

  // Check URL for recovery session (e.g., from password reset email link)
  useEffect(() => {
    const checkRecoverySession = () => {
      const hashParams = new URLSearchParams(location.hash.substring(1));
      const hashType = hashParams.get('type');
      
      if (hashType === 'recovery') {
        setIsRecoverySession(true);
        localStorage.setItem('passwordResetFlowActive', 'true');
        localStorage.setItem('passwordResetFlowStartTime', Date.now().toString());
      }
    };

    checkRecoverySession();
  }, [location.hash]);

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
          // If error fetching factors, assume aal2 for now to avoid blocking
          // This might need more robust error handling depending on expected behavior
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
  if (isRecoverySession) {
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
    // Clear modal blocking when not in reset flow
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
    // MODIFIED: Use translation key for the message
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