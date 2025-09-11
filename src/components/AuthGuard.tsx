import React, { useEffect, useState } from 'react';
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Database } from '../types/supabase';

interface AuthGuardProps {
  isPasswordResetFlow: boolean; // NEW PROP
  children?: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ isPasswordResetFlow }) => { // ACCEPT NEW PROP
  const { session, isLoading: loadingSession } = useSessionContext();
  const supabase = useSupabaseClient<Database>();
  const location = useLocation();

  // State for normal auth checks (MFA, etc.)
  const [targetAal, setTargetAal] = useState<'aal1' | 'aal2' | null>(null);
  const [loadingAuthChecks, setLoadingAuthChecks] = useState(true);

  // --- CRITICAL: Immediate checks for password reset flow ---
  // This logic runs on every render, ensuring immediate redirection if needed.
  // It directly checks the URL hash for the 'type=recovery' parameter.
  const hashParams = new URLSearchParams(location.hash.substring(1));
  const isRecoveryHashPresent = hashParams.get('type') === 'recovery';

  // NEW: Check shared localStorage flag for recovery active from other tabs.
  let recoveryActiveFlag = false;
  try {
    recoveryActiveFlag = localStorage.getItem('password_recovery_active') === 'true';
  } catch (err) {
    console.error('AuthGuard: error reading password_recovery_active flag:', err);
  }

  // Aggressive logging for debugging
  console.log('AuthGuard Render Check:');
  console.log('  isPasswordResetFlow (from App.tsx prop):', isPasswordResetFlow);
  console.log('  isRecoveryHashPresent (direct hash check):', isRecoveryHashPresent);
  console.log('  recoveryActiveFlag (from localStorage):', recoveryActiveFlag);
  console.log('  location.pathname:', location.pathname);
  console.log('  session:', session ? 'Exists' : 'Does NOT exist');
  console.log('  session.user:', session?.user ? 'Exists' : 'Does NOT exist');
  console.log('  loadingSession:', loadingSession);

  // If a recovery hash is present and we are on /reset-password, allow outlet (ResetPassword)
  if (isRecoveryHashPresent) {
    if (location.pathname === '/reset-password') {
      return <Outlet />;
    } else {
      console.log('AuthGuard: Recovery hash detected, but not on /reset-password. Redirecting to login.');
      return <Navigate to="/login" replace />;
    }
  }

  // If a recovery flow is active in another tab (localStorage flag), block access to protected routes
  if (recoveryActiveFlag) {
    if (location.pathname === '/reset-password') {
      // If somehow on reset-password page, allow
      return <Outlet />;
    }
    console.log('AuthGuard: password_recovery_active flag detected in localStorage. Redirecting to login to prevent premature dashboard access.');
    return <Navigate to="/login" replace />;
  }
  // --- END CRITICAL PASSWORD RESET FLOW CHECKS ---

  // --- Normal authentication flow (only if NOT a password reset flow) ---
  // This useEffect will only run if isRecoveryHashPresent is false.
  useEffect(() => {
    const checkAuthStatus = async () => {
      if (loadingSession) return; // Still loading session from auth-helpers

      setLoadingAuthChecks(true); // Start loading for normal auth checks

      if (!session?.user) {
        setTargetAal(null); // No user, will trigger redirect to login
        setLoadingAuthChecks(false);
        return;
      }

      try {
        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) {
          console.error('AuthGuard: Error listing MFA factors:', factorsError);
          setTargetAal('aal2'); // Fallback to allow access on errors
          setLoadingAuthChecks(false);
          return;
        }

        const hasMfaEnrolled = factors.totp.length > 0;
        console.log('AuthGuard: User has MFA enrolled:', hasMfaEnrolled);

        if (hasMfaEnrolled) {
          const mfaPassedFlag = localStorage.getItem('mfa_passed');
          if (mfaPassedFlag === 'true') {
            console.log('AuthGuard: MFA enrolled and mfa_passed flag found. Granting access.');
            setTargetAal('aal2');
          } else {
            console.log('AuthGuard: MFA enrolled but no mfa_passed flag. Redirecting to challenge.');
            setTargetAal('aal1');
          }
        } else {
          console.log('AuthGuard: No MFA enrolled. Granting access.');
          setTargetAal('aal2');
        }
      } catch (err) {
        console.error('AuthGuard: Unexpected error during MFA check:', err);
        setTargetAal('aal2'); // Fallback to allow access on unexpected errors
      } finally {
        setLoadingAuthChecks(false);
      }
    };

    checkAuthStatus();
  }, [session, loadingSession, supabase]); // isRecoveryHashPresent is handled above, so not a dependency here.

  // Show loading indicator for initial session loading or ongoing auth checks
  if (loadingSession || loadingAuthChecks) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  // Handle redirects for normal authentication flow (after all checks are done)
  if (!session || !session.user) {
    console.log('AuthGuard: No active user session found. Redirecting to login page.');
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (targetAal === 'aal1') {
    console.log('AuthGuard: MFA is required (aal1). Redirecting to MFA challenge.');
    return <Navigate to={`/mfa-challenge?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (targetAal === 'aal2') {
    console.log('AuthGuard: User is authenticated and AAL2 or no MFA required. Rendering protected content.');
    return <Outlet />;
  }

  // Fallback for unexpected states (should ideally not be reached)
  console.warn('AuthGuard: Unexpected state. Redirecting to login.');
  return <Navigate to="/login" replace />;
};

export default AuthGuard;