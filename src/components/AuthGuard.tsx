import React, { useEffect, useState } from 'react';
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Database } from '../types/supabase';

interface AuthGuardProps {
  isPasswordResetFlow: boolean;
  children?: React.ReactNode;
}

const RECOVERY_FLAG_KEY = 'password_recovery_active';

const AuthGuard: React.FC<AuthGuardProps> = () => {
  const { session, isLoading: loadingSession } = useSessionContext();
  const supabase = useSupabaseClient<Database>();
  const location = useLocation();

  const [targetAal, setTargetAal] = useState<'aal1' | 'aal2' | null>(null);
  const [loadingAuthChecks, setLoadingAuthChecks] = useState(true);

  // --- Recovery check (with expiry) ---
  const checkRecoveryFlag = () => {
    try {
      const raw = localStorage.getItem(RECOVERY_FLAG_KEY);
      if (!raw) return false;

      const parsed = JSON.parse(raw);
      if (parsed.active && typeof parsed.expiresAt === 'number') {
        if (parsed.expiresAt > Date.now()) {
          return true;
        } else {
          console.log('AuthGuard: Recovery flag expired, clearing.');
          localStorage.removeItem(RECOVERY_FLAG_KEY);
        }
      }
    } catch (err) {
      console.error('AuthGuard: error parsing recovery flag:', err);
    }
    return false;
  };

  const recoveryActive = checkRecoveryFlag();
  const hashParams = new URLSearchParams(location.hash.substring(1));
  const isRecoveryHashPresent = hashParams.get('type') === 'recovery';

  // === ABSOLUTE PRIORITY: recovery session ===
  if (recoveryActive || isRecoveryHashPresent) {
    // Kill any Supabase session so rehydration can't sneak them in
    if (session) {
      supabase.auth.signOut().catch(() => {});
    }

    if (location.pathname !== '/reset-password') {
      console.log('AuthGuard: Recovery active. Redirecting to /reset-password.');
      return <Navigate to="/reset-password" replace />;
    }

    // Only /reset-password is allowed
    return <Outlet />;
  }

  // === Normal authentication ===
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
          setTargetAal('aal2');
          setLoadingAuthChecks(false);
          return;
        }

        const hasMfaEnrolled = factors.totp.length > 0;
        if (hasMfaEnrolled) {
          const mfaPassedFlag = localStorage.getItem('mfa_passed');
          setTargetAal(mfaPassedFlag === 'true' ? 'aal2' : 'aal1');
        } else {
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

  if (loadingSession || loadingAuthChecks) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  if (!session || !session.user) {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  }

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