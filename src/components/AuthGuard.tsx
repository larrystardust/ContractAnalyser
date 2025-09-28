import React, { useEffect, useState } from 'react';
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Database } from '../types/supabase';
import { useTranslation } from 'react-i18next';

interface AuthGuardProps {
  children?: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> => {
  const { session, isLoading: loadingSession } = useSessionContext();
  const supabase = useSupabaseClient<Database>();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [hasMfaEnrolled, setHasMfaEnrolled] = useState(false);
  const [loadingMfaStatus, setLoadingMfaStatus] = useState(true);

  // --- Determine recovery state directly in render cycle for immediate effect ---
  const hashParams = new URLSearchParams(location.hash.substring(1));
  const isHashRecovery = hashParams.get('type') === 'recovery';

  // The most robust check for a recovery session from Supabase itself
  // A session is only considered a "recovery session" if it's AAL1 AND has the recovery token issued at.
  // If the session is AAL2, it means a full login has occurred, and recovery is no longer active.
  const isSessionRecoveryFromSupabase = session?.user?.app_metadata?.recovery_token_issued_at !== undefined && session?.aal === 'aal1';
  
  // Check localStorage flag, which helps sync across tabs quickly
  const isLocalStorageRecoveryActive = localStorage.getItem('passwordResetFlowActive') === 'true';

  // CRITICAL FIX: If the session is AAL2, it means a full login has occurred, and we are NOT in a recovery flow.
  // This takes precedence over any lingering recovery flags.
  const isRecoverySessionActive = session?.aal !== 'aal2' && (isHashRecovery || isSessionRecoveryFromSupabase || isLocalStorageRecoveryActive);

  // --- Effect to manage localStorage flags for recovery state ---
  useEffect(() => {
    if (isRecoverySessionActive) {
      localStorage.setItem('passwordResetFlowActive', 'true');
      localStorage.setItem('blockModalsDuringReset', 'true');
    } else {
      localStorage.removeItem('passwordResetFlowActive');
      localStorage.removeItem('blockModalsDuringReset');
    }

    // Listen for storage events to sync state across tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'passwordResetFlowActive' || e.key === 'blockModalsDuringReset') {
        // This effect will re-run due to `isRecoverySessionActive` dependency,
        // which will re-evaluate the state based on updated localStorage.
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isRecoverySessionActive]); // Re-run this effect if isRecoverySessionActive changes

  // Clear password reset flags upon successful login if not on the reset page
  useEffect(() => {
    if (session?.user && location.pathname !== '/reset-password' && !isRecoverySessionActive) {
      const isLocalStorageFlowActive = localStorage.getItem('passwordResetFlowActive') === 'true';
      if (isLocalStorageFlowActive) {
        console.log('AuthGuard: User logged in, not on reset page, clearing stale password reset flags.');
        localStorage.removeItem('passwordResetFlowActive');
        localStorage.removeItem('blockModalsDuringReset');
      }
    }
  }, [session?.user?.id, location.pathname, isRecoverySessionActive]);

  // Effect to determine if MFA is enrolled for the current user
  useEffect(() => {
    const checkMfaEnrollment = async () => {
      setLoadingMfaStatus(true);
      if (!session?.user) {
        setHasMfaEnrolled(false);
        setLoadingMfaStatus(false);
        return;
      }
      try {
        const { data: factors, error: getFactorsError } = await supabase.auth.mfa.listFactors();
        if (getFactorsError) throw getFactorsError;

        const totpFactor = factors?.totp.find(factor => factor.status === 'verified');
        if (totpFactor) {
          setHasMfaEnrolled(true);
        } else {
          setHasMfaEnrolled(false);
        }
      } catch (err) {
        console.error("AuthGuard: Unexpected error during MFA enrollment check:", err);
        setHasMfaEnrolled(false);
      } finally {
        setLoadingMfaStatus(false);
      }
    };
    checkMfaEnrollment();
  }, [session?.user?.id, supabase]);


  // --- ALL HOOKS MUST BE CALLED ABOVE THIS LINE ---

  // CRITICAL: This block MUST be the first conditional check after loading states
  // It ensures that if a recovery session is active, the user is *only* allowed on the /reset-password page.
  if (isRecoverySessionActive) {
    console.log('AuthGuard: isRecoverySessionActive is TRUE. Current location:', location.pathname);
    console.log('AuthGuard: DEBUG - Session details when isRecoverySessionActive is TRUE:', JSON.stringify(session, null, 2)); // ADDED DIAGNOSTIC LOG
    // Ensure the blockModalsDuringReset flag is set for all tabs if a recovery session is active
    localStorage.setItem('blockModalsDuringReset', 'true'); 
    
    if (location.pathname === '/reset-password') {
      return <Outlet />;
    } else {
      // Force redirect to reset page, preserving the hash if it's still there
      const redirectHash = location.hash.includes('type=recovery') ? location.hash : '';
      const redirectUrl = `/reset-password${redirectHash}`;
      console.log(`AuthGuard: Redirecting to ${redirectUrl} due to active recovery session.`);
      return <Navigate to={redirectUrl} replace />;
    }
  } else {
    // If no recovery session is active, ensure the flags are cleared
    localStorage.removeItem('passwordResetFlowActive');
    localStorage.removeItem('blockModalsDuringReset');
  }

  // Show loading indicator while session or MFA status is loading
  if (loadingSession || loadingMfaStatus) {
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

  // If MFA is enrolled AND the current session's AAL is 'aal1' (meaning MFA hasn't been completed for this session)
  // AND the user is NOT on the MFA challenge page, redirect to MFA challenge.
  if (hasMfaEnrolled && session.aal === 'aal1' && location.pathname !== '/mfa-challenge') {
    console.log('AuthGuard: User has MFA enrolled and session is aal1. Redirecting to MFA challenge.');
    return <Navigate to={`/mfa-challenge?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  // If the session AAL is 'aal1' and it's NOT a recovery flow (handled above) and NOT an MFA challenge page (handled above),
  // then it's an insufficient AAL for general protected content. Redirect to login.
  if (session.aal === 'aal1' && !isRecoverySessionActive && location.pathname !== '/mfa-challenge') {
      console.log('AuthGuard: Session is aal1 and not a recovery or MFA challenge. Redirecting to login as AAL is insufficient.');
      return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  // If we reach here, the user is authenticated with sufficient AAL for the current context.
  // Either session.aal is aal2, or session.aal is aal1 and it's an MFA challenge page.
  // Or session.aal is aal1, no MFA enrolled, and it's a protected route (which is fine).
  return <Outlet />;
};

export default AuthGuard;