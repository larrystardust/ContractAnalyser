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

  const [isRecoverySessionActive, setIsRecoverySessionActive] = useState(false);
  const [hasMfaEnrolled, setHasMfaEnrolled] = useState(false);
  const [loadingMfaStatus, setLoadingMfaStatus] = useState(true);

  // Effect to determine if a recovery session is active based on hash and localStorage
  useEffect(() => {
    const checkRecoveryState = () => {
      const hashParams = new URLSearchParams(location.hash.substring(1));
      const isHashRecovery = hashParams.get('type') === 'recovery';

      const isLocalStorageFlowActive = localStorage.getItem('passwordResetFlowActive') === 'true';
      const startTime = localStorage.getItem('passwordResetFlowStartTime');
      const isLocalStorageFlowValid = isLocalStorageFlowActive && startTime && (Date.now() - parseInt(startTime)) < 15 * 60 * 1000;

      const currentlyActive = isHashRecovery || isLocalStorageFlowValid;
      setIsRecoverySessionActive(currentlyActive);

      if (isHashRecovery && !isLocalStorageFlowActive) {
        localStorage.setItem('passwordResetFlowActive', 'true');
        localStorage.setItem('passwordResetFlowStartTime', Date.now().toString());
      } 
      else if (!isHashRecovery && !isLocalStorageFlowValid && isLocalStorageFlowActive) {
          localStorage.removeItem('passwordResetFlowActive');
          localStorage.removeItem('passwordResetFlowStartTime');
      }
    };

    checkRecoveryState();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'passwordResetFlowActive' || e.key === 'blockModalsDuringReset') {
        checkRecoveryState();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [location.hash]);

  // Clear password reset flags upon successful login if not on the reset page
  useEffect(() => {
    if (session?.user && location.pathname !== '/reset-password') {
      const isLocalStorageFlowActive = localStorage.getItem('passwordResetFlowActive') === 'true';
      if (isLocalStorageFlowActive) {
        console.log('AuthGuard: User logged in, not on reset page, clearing stale password reset flags.');
        localStorage.removeItem('passwordResetFlowActive');
        localStorage.removeItem('passwordResetFlowStartTime');
        localStorage.removeItem('blockModalsDuringReset');
        setIsRecoverySessionActive(false); 
      }
    }
  }, [session?.user?.id, location.pathname]);

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
        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) {
          console.error("AuthGuard: Error listing MFA factors:", factorsError);
          setHasMfaEnrolled(false); // Assume no MFA enrolled on error
        } else {
          setHasMfaEnrolled(factors.totp.length > 0);
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

  // BLOCK ALL ACCESS DURING PASSWORD RESET FLOW
  if (isRecoverySessionActive) {
    console.log('AuthGuard: isRecoverySessionActive is TRUE. Current location:', location.pathname);
    localStorage.setItem('blockModalsDuringReset', 'true');
    
    if (location.pathname === '/reset-password') {
      return <Outlet />;
    } else {
      const redirectHash = location.hash.includes('type=recovery') ? location.hash : '';
      const redirectUrl = `/reset-password${redirectHash}`;
      return <Navigate to={redirectUrl} replace />;
    }
  } else {
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

  // CRITICAL FIX: If the session AAL is 'aal1' and it's NOT a password reset flow (already handled by isRecoverySessionActive)
  // and NOT an MFA challenge page (handled above), then it's an insufficient AAL for general protected content.
  // This specifically catches the case where a password reset link creates an aal1 session,
  // but the user tries to access a protected route without completing the reset.
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