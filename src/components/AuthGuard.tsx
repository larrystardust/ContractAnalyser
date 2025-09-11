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
  const [isAdmin, setIsAdmin] = useState(false); // Keep for AdminGuard, but not directly used here
  const [loadingAdminStatus, setLoadingAdminStatus] = useState(true); // Keep for AdminGuard
  const [targetAal, setTargetAal] = useState<'aal1' | 'aal2' | null>(null);

  useEffect(() => {
    const checkAuthStatus = async () => {
      if (loadingSession) return;

      console.log('AuthGuard: Current session AAL:', session?.aal);
      console.log('AuthGuard: Current session user:', session?.user?.id);
      console.log('AuthGuard: isPasswordResetFlow:', isPasswordResetFlow); // Log new prop

      // CRITICAL FIX: If it's a password reset flow, strictly enforce access to /reset-password only.
      if (isPasswordResetFlow) {
        if (location.pathname === '/reset-password') {
          setTargetAal('aal2'); // Allow access to the reset password page
          setLoadingAdminStatus(false);
        } else {
          // If it's a password reset flow but not on the /reset-password page, redirect to login.
          // This prevents the recovery session from granting access to other protected routes.
          console.log('AuthGuard: Password reset flow detected, but not on /reset-password. Redirecting to login.');
          setTargetAal(null); // Force redirect to login
          setLoadingAdminStatus(false);
          // Optionally, you might want to sign out here to clear the session immediately
          // if the user tries to navigate away from /reset-password.
          // However, the redirect to /login should handle it.
        }
        return; // Exit early from this useEffect as we've handled the password reset flow.
      }

      // Normal authentication flow (if not a password reset flow)
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
  }, [session, loadingSession, supabase, location.pathname, isPasswordResetFlow]); // Add isPasswordResetFlow to dependencies

  // Show loading indicator while checking authentication and MFA status
  if (loadingSession || targetAal === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  // Handle redirects based on targetAal
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