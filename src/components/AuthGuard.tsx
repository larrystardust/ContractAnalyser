import React, { useEffect, useState, useRef } from 'react'; // Import useRef
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'; // Corrected import statement
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
  const mfaPassedFlagRef = useRef(false); // Use a ref to track if MFA was passed in this session

  useEffect(() => {
    const checkAuthStatus = async () => {
      if (loadingSession) return;

      console.log('AuthGuard: Current session AAL:', session?.aal); // Log current AAL
      console.log('AuthGuard: Current session user:', session?.user?.id); // Log current user ID

      if (!session?.user) {
        setTargetAal(null); // No user, will redirect to login
        mfaPassedFlagRef.current = false; // Reset ref on logout
        return;
      }

      // Check localStorage for the mfa_passed flag only once per session
      // This needs to be done before any async calls that might cause re-renders
      if (!mfaPassedFlagRef.current && localStorage.getItem('mfa_passed') === 'true') {
        mfaPassedFlagRef.current = true;
        // localStorage.removeItem('mfa_passed'); // REMOVED: Clear it immediately after reading, now delayed
        console.log('AuthGuard: MFA passed flag detected.');
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
          // If MFA is enrolled, and we have the mfaPassedFlagRef set, or session.aal is aal2
          if (mfaPassedFlagRef.current || session.aal === 'aal2') {
            console.log('AuthGuard: MFA enrolled and either flag or AAL2 detected. Granting access.');
            setTargetAal('aal2');
          } else {
            // MFA enrolled but no flag/AAL2, redirect to challenge
            console.log('AuthGuard: MFA enrolled but no flag/AAL2. Redirecting to challenge.');
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

  // New useEffect to clear the localStorage flag after a delay
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (targetAal === 'aal2' && mfaPassedFlagRef.current) {
      // Clear the flag after a short delay to ensure navigation and rendering stabilize
      timer = setTimeout(() => {
        localStorage.removeItem('mfa_passed');
        mfaPassedFlagRef.current = false; // Reset ref after clearing
        console.log('AuthGuard: Cleared mfa_passed from localStorage after delay.');
      }, 500); // 500ms delay
    }
    return () => clearTimeout(timer); // Cleanup the timer
  }, [targetAal]); // Run this effect when targetAal changes

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