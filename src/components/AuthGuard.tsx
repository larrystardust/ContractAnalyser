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
  const [mfaRequired, setMfaRequired] = useState<boolean | null>(null); // null: checking, true: required, false: not required

  useEffect(() => {
    const checkMfaStatus = async () => {
      if (loadingSession) return; // Wait for session to load

      if (!session?.user) {
        // No user session, MFA not required (will redirect to login)
        setMfaRequired(false);
        return;
      }

      // If session is already aal2, no MFA challenge needed
      if (session.aal === 'aal2') {
        setMfaRequired(false);
        return;
      }

      // If aal1, check for MFA factors
      try {
        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) {
          console.error('AuthGuard: Error listing MFA factors:', factorsError);
          setMfaRequired(false); // Treat error as no MFA required for now, but log
          return;
        }

        if (factors.totp.length > 0) {
          // User has MFA enrolled but session is aal1, MFA is required
          setMfaRequired(true);
        } else {
          // No MFA factors enrolled, MFA is not required
          setMfaRequired(false);
        }
      } catch (err) {
        console.error('AuthGuard: Unexpected error during MFA check:', err);
        setMfaRequired(false); // Treat unexpected error as no MFA required
      }
    };

    setMfaRequired(null); // Reset state to 'checking' on session/loadingSession change
    checkMfaStatus();
  }, [session, loadingSession, supabase]); // Removed location, navigate from dependencies as they are used in render logic

  // Show loading indicator while checking authentication and MFA status
  if (loadingSession || mfaRequired === null) {
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

  if (mfaRequired) {
    console.log('AuthGuard: MFA is required but session is aal1. Redirecting to MFA challenge.');
    return <Navigate to={`/mfa-challenge?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  // If an authenticated user session is found, MFA is not required (or already aal2), render the protected content.
  // ADDED: Explicitly check for aal2 here to ensure full authentication level.
  if (session.aal === 'aal2') {
    console.log('AuthGuard: User is authenticated and MFA check passed. Rendering protected content.');
    return <Outlet />;
  } else {
    // This case should ideally not be hit if logic is perfect, but acts as a safeguard.
    // It means session.user exists, mfaRequired is false, but aal is not aal2.
    // This could happen if MFA was disabled, or if aal is still undefined/aal1 for some reason.
    console.warn('AuthGuard: User authenticated but AAL is not aal2. Redirecting to MFA challenge as a fallback.');
    return <Navigate to={`/mfa-challenge?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
};

export default AuthGuard;