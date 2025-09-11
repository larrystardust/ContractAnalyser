import React, { useEffect, useState } from 'react';
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Database } from '../types/supabase';

interface AuthGuardProps {
  children?: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = () => {
  const { session, isLoading: loadingSession } = useSessionContext();
  const supabase = useSupabaseClient<Database>();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false); // Keep for AdminGuard, but not directly used here
  const [loadingAdminStatus, setLoadingAdminStatus] = useState(true); // Keep for AdminGuard
  const [targetAal, setTargetAal] = useState<'aal1' | 'aal2' | null>(null);

  useEffect(() => {
    const checkAuthStatus = async () => {
      if (loadingSession) return;

      console.log('AuthGuard: Current session AAL:', session?.aal);
      console.log('AuthGuard: Current session user:', session?.user?.id);

      // CRITICAL FIX: If on the reset-password page, and a session exists, allow it.
      // The ResetPassword component will handle the session validity for password reset.
      if (location.pathname === '/reset-password' && session?.user) {
        setTargetAal('aal2'); // Treat as sufficient for this specific page
        setLoadingAdminStatus(false); // Not relevant for this path, but set to false
        return;
      }

      if (!session?.user) {
        setTargetAal(null); // No user, will redirect to login
        setLoadingAdminStatus(false);
        return;
      }

      try {
        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) {
          console.error('AuthGuard: Error listing MFA factors:', factorsError);
          setTargetAal('aal2'); // Fallback to allow access on errors
          setLoadingAdminStatus(false);
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
        setLoadingAdminStatus(false); // Ensure this is always set
      }
    };

    setTargetAal(null); // Reset on session/loadingSession/location change
    checkAuthStatus();
  }, [session, loadingSession, supabase, location.pathname]); // Add location.pathname to dependencies

  // Show loading indicator while checking authentication and MFA status
  if (loadingSession || targetAal === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  // CRITICAL FIX: If on the reset-password page, and a session exists, allow it to render.
  // This is the key change to prevent redirection from AuthGuard for this specific flow.
  if (location.pathname === '/reset-password' && session?.user) {
    console.log('AuthGuard: Allowing access to /reset-password with existing session.');
    return <Outlet />;
  }

  // General authentication checks for all other protected routes
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

  // This should ideally not be reached
  console.warn('AuthGuard: Unexpected state. Redirecting to login.');
  return <Navigate to="/login" replace />;
};

export default AuthGuard;