import React, { useEffect, useState } from 'react';
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Database } from '../types/supabase';

interface AuthGuardProps {
  isPasswordResetFlow: boolean;
  children?: React.ReactNode;
}

const RECOVERY_FLAG = 'password_recovery_active';
const RECOVERY_EXPIRY = 'password_recovery_expiry';

const AuthGuard: React.FC<AuthGuardProps> = ({ isPasswordResetFlow }) => {
  const { session, isLoading: loadingSession } = useSessionContext();
  const supabase = useSupabaseClient<Database>();
  const location = useLocation();

  const [targetAal, setTargetAal] = useState<'aal1' | 'aal2' | null>(null);
  const [loadingAuthChecks, setLoadingAuthChecks] = useState(true);

  // Read recovery flag + expiry
  const recoveryActive = (() => {
    const flag = localStorage.getItem(RECOVERY_FLAG);
    const expiry = localStorage.getItem(RECOVERY_EXPIRY);
    if (!flag || !expiry) return false;
    const expiryTime = parseInt(expiry, 10);
    if (isNaN(expiryTime) || Date.now() > expiryTime) {
      // expired, clean up
      localStorage.removeItem(RECOVERY_FLAG);
      localStorage.removeItem(RECOVERY_EXPIRY);
      return false;
    }
    return flag === 'true';
  })();

  // Check URL hash directly
  const hashParams = new URLSearchParams(location.hash.substring(1));
  const isRecoveryHashPresent = hashParams.get('type') === 'recovery';

  console.log('AuthGuard Debug:', {
    isPasswordResetFlow,
    recoveryActive,
    isRecoveryHashPresent,
    pathname: location.pathname,
    session: !!session,
  });

  // === ABSOLUTE PRIORITY: recovery session ===
  if (recoveryActive || isRecoveryHashPresent) {
    if (location.pathname !== '/reset-password') {
      console.log('AuthGuard: Recovery active. Redirecting to /reset-password.');
      return <Navigate to="/reset-password" replace />;
    }
    // Only allow reset-password page
    return <Outlet />;
  }

  // === Normal authentication flow (runs only if NOT in recovery) ===
  useEffect(() => {
    const checkAuthStatus = async () => {
      if (loadingSession) return;

      setLoadingAuthChecks(true);

      if (!session?.user) {
        setTargetAal(null);
        setLoadingAuthChecks(false);
        return;
      }

      try {
        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) {
          console.error('AuthGuard: Error listing MFA factors:', factorsError);
          setTargetAal('aal2'); // Fallback
          setLoadingAuthChecks(false);
          return;
        }

        const hasMfaEnrolled = factors.totp.length > 0;
        console.log('AuthGuard: User has MFA enrolled:', hasMfaEnrolled);

        if (hasMfaEnrolled) {
          const mfaPassedFlag = localStorage.getItem('mfa_passed');
          if (mfaPassedFlag === 'true') {
            console.log('AuthGuard: MFA passed. Granting access.');
            setTargetAal('aal2');
          } else {
            console.log('AuthGuard: MFA required. Redirecting to challenge.');
            setTargetAal('aal1');
          }
        } else {
          console.log('AuthGuard: No MFA enrolled. Granting access.');
          setTargetAal('aal2');
        }
      } catch (err) {
        console.error('AuthGuard: Unexpected error during MFA check:', err);
        setTargetAal('aal2'); // Fallback
      } finally {
        setLoadingAuthChecks(false);
      }
    };

    checkAuthStatus();
  }, [session, loadingSession, supabase]);

  // === Loading state ===
  if (loadingSession || loadingAuthChecks) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  // === Redirects for normal auth flow ===
  if (!session || !session.user) {
    console.log('AuthGuard: No active session. Redirecting to login.');
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (targetAal === 'aal1') {
    console.log('AuthGuard: MFA required. Redirecting.');
    return <Navigate to={`/mfa-challenge?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (targetAal === 'aal2') {
    console.log('AuthGuard: Authenticated. Rendering protected content.');
    return <Outlet />;
  }

  console.warn('AuthGuard: Unexpected state. Redirecting to login.');
  return <Navigate to="/login" replace />;
};

export default AuthGuard;