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
    const checkRecoverySession = async () => {
      if (session) {
        try {
          // Check if this session was created from a password reset flow
          const { data } = await supabase.auth.getSession();
          if (data.session?.user?.app_metadata?.provider === 'email' && 
              data.session.user.aud === 'authenticated' &&
              data.session.user.role === 'authenticated' &&
              location.hash.includes('type=recovery')) {
            setIsRecoverySession(true);
          } else {
            setIsRecoverySession(false);
          }
        } catch (error) {
          console.error('Error checking recovery session:', error);
          setIsRecoverySession(false);
        }
      }
    };

    checkRecoverySession();
  }, [session, location.hash, supabase.auth]);

  // CRITICAL: Handle password reset flow - redirect ALL routes except reset-password to login
  useEffect(() => {
    if (isPasswordResetFlow || isRecoverySession) {
      console.log('AuthGuard: Password reset flow detected, blocking access to protected routes');
      
      // If we're in password reset flow but not on the reset-password page, redirect to login
      if (location.pathname !== '/reset-password') {
        console.log('AuthGuard: Redirecting to login during password reset flow');
        // Clear any existing session to prevent access
        supabase.auth.signOut().catch(console.error);
      }
    }
  }, [isPasswordResetFlow, isRecoverySession, location.pathname, supabase.auth]);

  // Show loading indicator for initial session loading
  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  // BLOCK ACCESS DURING PASSWORD RESET FLOW
  if (isPasswordResetFlow || isRecoverySession) {
    if (location.pathname === '/reset-password') {
      // Allow access to reset-password page only
      return <Outlet />;
    } else {
      // Redirect all other routes to login during password reset flow
      console.log('AuthGuard: Blocking access during password reset flow, redirecting to login');
      return <Navigate to="/login" replace />;
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