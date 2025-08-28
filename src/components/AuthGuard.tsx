import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    const checkAuthStatus = async () => {
      if (loadingSession) return;

      console.log('AuthGuard: Current session AAL:', session?.aal); // Log current AAL
      console.log('AuthGuard: Current session user:', session?.user?.id); // Log current user ID

      if (!session?.user) {
        setTargetAal(null); // No user, will redirect to login
        return;
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

        // Check localStorage flag for MFA completion
        const mfaPassedFlag = localStorage.getItem('mfa_passed');

        if (hasMfaEnrolled) {
          // If MFA is enrolled AND the mfa_passed flag is set, assume AAL2
          if (mfaPassedFlag === 'true') {
            console.log('AuthGuard: MFA enrolled and mfa_passed flag found. Assuming aal2.');
            // localStorage.removeItem('mfa_passed'); // REMOVED: MfaChallengePage will handle clearing this
            setTargetAal('aal2');
          } else {
            // MFA enrolled but no flag, or aal is not aal2, redirect to challenge
            console.log('AuthGuard: MFA enrolled but no mfa_passed flag. Redirecting to challenge.');
            setTargetAal('aal1'); // User needs to complete MFA challenge
          }
        } else {
          // If no MFA is enrolled, AAL1 is sufficient (or aal2 if they somehow got it).
          // In this case, they are considered fully authenticated for access.
          console.log('AuthGuard: No MFA enrolled. Assuming aal2.');
          setTargetAal('aal2');
        }
      } catch (err) {
        console.error('AuthGuard: Unexpected error during MFA check:', err);
        setTargetAal('aal2'); // Fallback to allow access on unexpected errors
      }
    };

    setTargetAal(null); // Reset on session/loadingSession change
    checkAuthStatus();
  }, [session, loadingSession, supabase]);

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
    return <Navigate to="/login" replace />;
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