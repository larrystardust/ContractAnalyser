import React, { useEffect, useState } from 'react';
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Database } from '../types/supabase';

interface AuthGuardProps {
  isPasswordResetFlow: boolean;
  children?: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ isPasswordResetFlow }) => {
  const { session, isLoading: loadingSession } = useSessionContext();
  const supabase = useSupabaseClient<Database>();
  const location = useLocation();
  
  const [targetAal, setTargetAal] = useState<'aal1' | 'aal2' | null>(null);
  const [loadingAuthChecks, setLoadingAuthChecks] = useState(true);
  const [isRecoverySession, setIsRecoverySession] = useState(false);

  // Check if this is a recovery session (password reset flow)
  useEffect(() => {
    const checkRecoverySession = () => {
      if (session) {
        // Check URL hash for recovery type
        const hashParams = new URLSearchParams(location.hash.substring(1));
        const hashType = hashParams.get('type');
        
        if (hashType === 'recovery') {
          setIsRecoverySession(true);
          console.log('AuthGuard: Recovery session detected from URL hash');
        } else {
          setIsRecoverySession(false);
        }
      }
    };

    checkRecoverySession();
  }, [session, location.hash]);

  // CRITICAL: Handle password reset flow - redirect ALL routes except reset-password to reset-password
  useEffect(() => {
    if (isPasswordResetFlow || isRecoverySession) {
      console.log('AuthGuard: Password reset flow detected');
      
      // If we're in password reset flow but not on the reset-password page, redirect to reset-password
      if (location.pathname !== '/reset-password') {
        console.log('AuthGuard: Redirecting to reset-password during password reset flow');
        // Preserve the hash (contains the recovery token) when redirecting
        const redirectUrl = `/reset-password${location.hash}`;
        return <Navigate to={redirectUrl} replace />;
      }
    }
  }, [isPasswordResetFlow, isRecoverySession, location.pathname, location.hash]);

  // Show loading indicator for initial session loading
  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  // BLOCK ACCESS DURING PASSWORD RESET FLOW - PRESERVE SESSION BUT RESTRICT NAVIGATION
  if (isPasswordResetFlow || isRecoverySession) {
    if (location.pathname === '/reset-password') {
      // Allow access to reset-password page only - session is preserved
      console.log('AuthGuard: Allowing access to reset-password during recovery flow');
      return <Outlet />;
    } else {
      // Redirect all other routes to reset-password during password reset flow
      // This preserves the auth session but forces user to stay on reset-password
      console.log('AuthGuard: Redirecting to reset-password to preserve recovery session');
      const redirectUrl = `/reset-password${location.hash}`;
      return <Navigate to={redirectUrl} replace />;
    }
  }

  // Normal authentication flow (only if NOT a password reset flow)
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
          setTargetAal('aal2');
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
        setTargetAal('aal2');
      } finally {
        setLoadingAuthChecks(false);
      }
    };

    checkAuthStatus();
  }, [session, loadingSession, supabase]);

  if (loadingAuthChecks) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

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

  console.warn('AuthGuard: Unexpected state. Redirecting to login.');
  return <Navigate to="/login" replace />;
};

export default AuthGuard;