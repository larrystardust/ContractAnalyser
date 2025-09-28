import React, { useEffect, useState } from 'react'; // Removed useCallback as it's not strictly needed here
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Database } from '../types/supabase';
import { useTranslation } from 'react-i18next';

interface AuthGuardProps {
  children?: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = () => {
  const { session, isLoading: loadingSession, error: sessionError } = useSessionContext();
  const supabase = useSupabaseClient<Database>();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [hasMfaEnrolled, setHasMfaEnrolled] = useState(false);
  const [loadingMfaStatus, setLoadingMfaStatus] = useState(true);
  // Removed isSessionValidated state

  // --- Determine recovery state directly in render cycle for immediate effect ---
  const hashParams = new URLSearchParams(location.hash.substring(1));
  const isHashRecovery = hashParams.get('type') === 'recovery';
  
  // Check localStorage flag, which helps sync across tabs quickly
  const isLocalStorageRecoveryActive = localStorage.getItem('passwordResetFlowActive') === 'true';

  // CRITICAL: This flag indicates that a password reset *process* has been initiated.
  // It should be true if either the hash indicates recovery, or localStorage indicates it.
  const isPasswordResetInitiated = isHashRecovery || isLocalStorageRecoveryActive;

  // --- Effect to manage localStorage flags for recovery state ---
  useEffect(() => {
    if (isPasswordResetInitiated) {
      localStorage.setItem('passwordResetFlowActive', 'true');
      localStorage.setItem('blockModalsDuringReset', 'true');
    } else {
      localStorage.removeItem('passwordResetFlowActive');
      localStorage.removeItem('blockModalsDuringReset');
    }

    // Listen for storage events to sync state across tabs
    const handleStorageChange = async (e: StorageEvent) => { // Made async
      if (e.key === 'passwordResetFlowActive' && e.newValue === 'true') {
        // If a password reset is initiated in another tab, and this tab is not on the reset page,
        // force sign out and redirect.
        if (location.pathname !== '/reset-password') {
          console.log('AuthGuard: Detected password reset flow initiated in another tab via localStorage. Forcing sign out and redirecting to login.');
          await supabase.auth.signOut(); // Force sign out in this tab
          navigate('/login', { replace: true });
        }
      } else if (e.key === 'passwordResetFlowActive' && e.newValue === null) {
        // If the flag is cleared in another tab (e.g., reset completed or timed out),
        // ensure this tab also clears its state if it was previously in a reset flow.
        // This might not be strictly necessary with the other checks, but adds robustness.
        if (isPasswordResetInitiated && location.pathname === '/reset-password') {
          console.log('AuthGuard: Detected password reset flow cleared in another tab. Redirecting to login.');
          navigate('/login', { replace: true });
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Also run on 'pageshow' event to catch bfcache restores
    const handlePageShow = async (event: PageTransitionEvent) => { // Made async
      if (event.persisted) { // If page is restored from bfcache
        console.log('AuthGuard: Page restored from bfcache. Re-checking password reset status.');
        // Force a re-evaluation of the AuthGuard's state by navigating to current location
        // This effectively forces a re-render and re-evaluation of all useEffects and conditions.
        // A simple navigate(location.pathname) might not work if the path is the same.
        // A more aggressive approach is to force a sign out if the flag is active.
        if (isPasswordResetInitiated && location.pathname !== '/reset-password') {
          console.log('AuthGuard: BFcache restore detected during active password reset. Forcing sign out and redirecting.');
          await supabase.auth.signOut();
          navigate('/login', { replace: true });
        }
      }
    };
    window.addEventListener('pageshow', handlePageShow);


    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [isPasswordResetInitiated, location.pathname, navigate, supabase]); // Added location.pathname, navigate, supabase

  // --- ALL HOOKS MUST BE CALLED ABOVE THIS LINE ---

  // Show loading indicator while session or MFA status is loading
  if (loadingSession || loadingMfaStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  // CRITICAL: This block MUST be the first conditional check after loading states
  // It ensures that if a password reset is initiated, the user is *only* allowed on the /reset-password page.
  if (isPasswordResetInitiated) {
    console.log('AuthGuard: isPasswordResetInitiated is TRUE. Current location:', location.pathname);
    console.log('AuthGuard: DEBUG - Session details when isPasswordResetInitiated is TRUE:', JSON.stringify(session, null, 2));
    console.log('AuthGuard: DEBUG - isHashRecovery:', isHashRecovery);
    // isSessionRecoveryFromSupabase is not directly used here, but its logic is part of isPasswordResetInitiated
    console.log('AuthGuard: DEBUG - isLocalStorageRecoveryActive:', isLocalStorageRecoveryActive);
    
    // Ensure the blockModalsDuringReset flag is set for all tabs if a recovery session is active
    localStorage.setItem('blockModalsDuringReset', 'true'); 
    
    if (location.pathname === '/reset-password') {
      return <Outlet />;
    } else {
      // Force sign out and redirect to login if trying to access any other page during reset flow
      console.log(`AuthGuard: Password reset initiated, but not on reset page. Forcing sign out and redirecting to login.`);
      supabase.auth.signOut(); // Force sign out
      return <Navigate to="/login" replace />;
    }
  } else {
    // If no password reset is initiated, ensure the flags are cleared
    localStorage.removeItem('passwordResetFlowActive');
    localStorage.removeItem('blockModalsDuringReset');
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
  if (session.aal === 'aal1' && location.pathname !== '/mfa-challenge') {
      console.log('AuthGuard: Session is aal1 and not a recovery or MFA challenge. Redirecting to login as AAL is insufficient.');
      return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  // If we reach here, the user is authenticated with sufficient AAL for the current context.
  // Either session.aal is aal2, or session.aal is aal1 and it's an MFA challenge page.
  // Or session.aal is aal1, no MFA enrolled, and it's a protected route (which is fine).
  return <Outlet />;
};

export default AuthGuard;