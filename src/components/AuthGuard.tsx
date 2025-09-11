import React, { useEffect, useState } from 'react';
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Database } from '../types/supabase';

interface AuthGuardProps {
  isPasswordResetFlow: boolean; // NEW PROP
  children?: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ isPasswordResetFlow }) => {
  const { session, isLoading: loadingSession } = useSessionContext();
  const supabase = useSupabaseClient<Database>();
  const location = useLocation();

  // State for normal auth checks (MFA, etc.)
  const [targetAal, setTargetAal] = useState<'aal1' | 'aal2' | null>(null);
  const [loadingAuthChecks, setLoadingAuthChecks] = useState(true);

  // --- CRITICAL: Immediate checks for password reset flow ---
  // This logic runs on every render, ensuring immediate redirection if needed.
  const hashParams = new URLSearchParams(location.hash.substring(1));
  const isRecoveryHashPresent = hashParams.get('type') === 'recovery';

  // Shared localStorage flag for recovery active (set in ResetPassword.tsx).
  let recoveryActiveFlag = false;
  try {
    recoveryActiveFlag = localStorage.getItem('password_recovery_active') === 'true';
  } catch (err) {
    console.error('AuthGuard: error reading password_recovery_active flag:', err);
  }

  // Debug logging
  console.log('AuthGuard Render Check:');
  console.log('  isPasswordResetFlow (from App.tsx prop):', isPasswordResetFlow);
  console.log('  isRecoveryHashPresent (direct hash check):', isRecoveryHashPresent);
  console.log('  recoveryActiveFlag (from localStorage):', recoveryActiveFlag);
  console.log('  location.pathname:', location.pathname);
  console.log('  session:', session ? 'Exists' : 'Does NOT exist');
  console.log('  session.user:', session?.user ? 'Exists' : 'Does NOT exist');
  console.log('  loadingSession:', loadingSession);

  // === ABSOLUTE PRIORITY: recovery state check ===
  if (recoveryActiveFlag || isRecoveryHashPresent) {
    // Allow only the reset-password page
    if (location.pathname === '/reset-password') {
      return <Outlet />;
    } else {
      console.log(
        'AuthGuard: Recovery flow active. Blocking access and redirecting to login.'
      );
      return <Navigate to="/login" replace />;
    }
  }
  // === END RECOVERY PRIORITY ===

  // --- Normal authentication flow (only if NOT a password reset flow) ---
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
        setTargetAal('aal2'); // fallback
      } finally {
        setLoadingAuthChecks(false);
      }
    };

    checkAuthStatus();
  }, [session, loadingSession, supabase]);

  // Loading state
  if (loadingSession || loadingAuthChecks) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  // Redirect if no user
  if (!session || !session.user) {
    console.log('AuthGuard: No active session. Redirecting to login.');
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  }

  // MFA required
  if (targetAal === 'aal1') {
    console.log('AuthGuard: MFA required. Redirecting to MFA challenge.');
    return (
      <Navigate
        to={`/mfa-challenge?redirect=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  }

  // Fully authenticated
  if (targetAal === 'aal2') {
    console.log('AuthGuard: User authenticated. Rendering protected content.');
    return <Outlet />;
  }

  // Fallback
  console.warn('AuthGuard: Unexpected state. Redirecting to login.');
  return <Navigate to="/login" replace />;
};

export default AuthGuard;