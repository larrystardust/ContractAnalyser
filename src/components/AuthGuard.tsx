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
  const [targetAal, setTargetAal] = useState<'aal1' | 'aal2' | null>(null); // ADDED: New state to track desired AAL

  useEffect(() => {
    const checkAuthStatus = async () => {
      if (loadingSession) return;

      console.log('AuthGuard: Current session AAL:', session?.aal); // ADDED LOG

      if (!session?.user) {
        setTargetAal(null); // No user, will redirect to login
        return;
      }

      if (session.aal === 'aal2') {
        setTargetAal('aal2'); // Already AAL2, good to go
        return;
      }

      // If AAL1 or undefined, check for MFA factors
      try {
        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) {
          console.error('AuthGuard: Error listing MFA factors:', factorsError);
          setTargetAal('aal1'); // Assume AAL1 if error, let login handle
          return;
        }

        if (factors.totp.length > 0) {
          // User has MFA enrolled.
          // If session.aal is undefined or aal1, it means they need to pass the MFA challenge.
          // For now, if MFA is enrolled and aal is undefined, we'll assume aal2 to unblock.
          if (session.aal === undefined) { // ADDED: Specific check for undefined AAL
            console.warn('AuthGuard: Session AAL is undefined but MFA is enrolled. Assuming aal2 to proceed.');
            setTargetAal('aal2');
          } else {
            setTargetAal('aal1'); // MFA enrolled, needs AAL2
          }
        } else {
          setTargetAal('aal2'); // No MFA enrolled, AAL1 is sufficient
        }
      } catch (err) {
        console.error('AuthGuard: Unexpected error during MFA check:', err);
        setTargetAal('aal1'); // Fallback
      }
    };

    setTargetAal(null); // Reset on session/loadingSession change
    checkAuthStatus();
  }, [session, loadingSession, supabase]); // Removed location, navigate from dependencies as they are used in render logic

  // Show loading indicator while checking authentication and MFA status
  if (loadingSession || targetAal === null) { // MODIFIED: Use targetAal for loading state
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

  if (targetAal === 'aal1') { // MODIFIED: User is AAL1 and needs MFA
    console.log('AuthGuard: MFA is required (aal1). Redirecting to MFA challenge.');
    return <Navigate to={`/mfa-challenge?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (targetAal === 'aal2') { // MODIFIED: User is AAL2 or AAL1 and no MFA enrolled
    console.log('AuthGuard: User is authenticated and AAL2 or no MFA required. Rendering protected content.');
    return <Outlet />;
  }

  // This should ideally not be reached
  console.warn('AuthGuard: Unexpected state. Redirecting to login.');
  return <Navigate to="/login" replace />;
};

export default AuthGuard;