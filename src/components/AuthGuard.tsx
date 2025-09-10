import React, { useEffect, useState } from 'react'; // Removed useRef
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Database } from '../types/supabase';

interface AuthGuardProps {
  children?: React.ReactNode; // Optional, as Outlet is used
}

const AuthGuard: React.FC<AuthGuardProps> = () => {
  const { session, isLoading: loadingSession } = useSessionContext();
  const supabase = useSupabaseClient<Database>();
  const location = useLocation();
  const navigate = useNavigate();
  const [targetAal, setTargetAal] = useState<'aal1' | 'aal2' | null>(null); // null: checking, 'aal1': needs MFA, 'aal2': good to go
  // Removed mfaPassedFlagRef and its associated useEffect for clearing localStorage

  useEffect(() => {
    const checkAuthStatus = async () => {
      if (loadingSession) return;

      console.log('AuthGuard: Current session AAL:', session?.aal); // Log current AAL
      console.log('AuthGuard: Current session user:', session?.user?.id); // Log current user ID

      if (!session?.user) {
        setTargetAal(null); // No user, will redirect to login
        return;
      }

      // ADDED: Check for email confirmation
      if (!session.user.email_confirmed_at) {
        console.log('AuthGuard: User email not confirmed. Redirecting to email confirmation page.');
        navigate('/email-not-confirmed', { replace: true });
        return; // Stop further checks and redirection
      }

      try {
        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) {
          console.error('AuthGuard: Error listing MFA factors:', factorsError);
          // If error fetching factors, assume no MFA is required for now to avoid blocking
          setTargetAal('aal2');
          return;
        }

        const hasMfaEnrolled = factors.totp.length > 0;
        console.log('AuthGuard: User has MFA enrolled:', hasMfaEnrolled);

        if (hasMfaEnrolled) {
          // If MFA is enrolled, check localStorage for the mfa_passed flag
          const mfaPassedFlag = localStorage.getItem('mfa_passed');
          if (mfaPassedFlag === 'true') {
            console.log('AuthGuard: MFA enrolled and mfa_passed flag found. Granting access.');
            setTargetAal('aal2');
          } else {
            // MFA enrolled but no flag, redirect to challenge
            console.log('AuthGuard: MFA enrolled but no mfa_passed flag. Redirecting to challenge.');
            setTargetAal('aal1'); // User needs to complete MFA challenge
          }
        } else {
          // If no MFA is enrolled, AAL1 is sufficient.
          console.log('AuthGuard: No MFA enrolled. Granting access.');
          setTargetAal('aal2');
        }
      } catch (err) {
        console.error('AuthGuard: Unexpected error during MFA check:', err);
        setTargetAal('aal2'); // Fallback to allow access on unexpected errors
      }
    };

    setTargetAal(null); // Reset on session/loadingSession change
    checkAuthStatus();
  }, [session, loadingSession, supabase, navigate]); // ADDED navigate to dependencies

  // Removed useEffect to clear localStorage flag after delay

  // Show loading indicator while checking authentication and MFA status
  if (loadingSession || targetAal === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  // If not loading and MFA check is complete, evaluate redirection
  if (!session || !session.user) {
    console.log('AuthGuard: No active user session found. Redirecting to login page.');
    // MODIFIED: Pass current path and search as redirect parameter
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  // This check is now redundant here as it's handled in the useEffect above
  // if (!session.user.email_confirmed_at) {
  //   console.log('AuthGuard: User email not confirmed. Redirecting to email confirmation page.');
  //   return <Navigate to="/email-not-confirmed" replace />;
  // }

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