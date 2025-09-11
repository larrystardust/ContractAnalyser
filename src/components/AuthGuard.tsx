import React, { useEffect, useState } from 'react';
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Database } from '../types/supabase';

interface AuthGuardProps {
  isPasswordResetFlow: boolean;
  children?: React.ReactNode;
}

const RECOVERY_FLAG_KEY = 'password_recovery_active';

const AuthGuard: React.FC<AuthGuardProps> = ({ isPasswordResetFlow }) => {
  const { session, isLoading: loadingSession } = useSessionContext();
  const supabase = useSupabaseClient<Database>();
  const location = useLocation();

  const [targetAal, setTargetAal] = useState<'aal1' | 'aal2' | null>(null);
  const [loadingAuthChecks, setLoadingAuthChecks] = useState(true);

  // --- Check recovery flag (with expiry) ---
  let recoveryActive = false;
  try {
    const raw = localStorage.getItem(RECOVERY_FLAG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.active && typeof parsed.expiresAt === 'number') {
        if (parsed.expiresAt > Date.now()) {
          recoveryActive = true;
        } else {
          console.log('AuthGuard: Recovery flag expired, clearing.');
          localStorage.removeItem(RECOVERY_FLAG_KEY);
        }
      }
    }
  } catch (err) {
    console.error('AuthGuard: error parsing recovery flag:', err);
  }

  // Also check if URL hash indicates recovery
  const hashParams = new URLSearchParams(location.hash.substring(1));
  const isRecoveryHashPresent = hashParams.get('type') === 'recovery';

  console.log('AuthGuard Recovery Check:', {
    recoveryActive,
    isRecoveryHashPresent,
    pathname: location.pathname,
  });

  // === ABSOLUTE PRIORITY: Recovery flow blocks everything ===
  if (recoveryActive || isRecoveryHashPresent) {
    if (location.pathname === '/reset-password') {
      return <Outlet />;
    } else {
      console.log('AuthGuard: Blocking dashboard due to active recovery session.');
      return <Navigate to="/login" replace />;
    }
  }
  // === END RECOVERY PRIORITY ===

  // --- Normal authentication flow ---
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
          setTargetAal('aal2'); // fallback
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
            console.log('AuthGuard: MFA required but not passed. Redirecting to challenge.');
            setTargetAal('aal1');
          }
        } else {
          console.log('AuthGuard: No MFA. Granting access.');
          setTargetAal('aal2');
        }
      } catch (err) {
        console.error('AuthGuard: Unexpected error during MFA check:', err);
        setTargetAal('aal2');
      } finally {
        setLoadingAuthChecks(false);
      }
    };

    checkAuthStatus();
  }, [session, loadingSession, supabase]);

  // --- Loading screen ---
  if (loadingSession || loadingAuthChecks) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  // --- Redirect if no session ---
  if (!session || !session.user) {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  }

  // --- MFA checks ---
  if (targetAal === 'aal1') {
    return (
      <Navigate
        to={`/mfa-challenge?redirect=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  }

  if (targetAal === 'aal2') {
    return <Outlet />;
  }

  return <Navigate to="/login" replace />;
};

export default AuthGuard;