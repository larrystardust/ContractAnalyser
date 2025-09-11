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

  // Check if user has successfully logged in after password reset
  useEffect(() => {
    const checkLoginStatus = () => {
      const resetFlowCompleted = localStorage.getItem('passwordResetCompleted');
      if (resetFlowCompleted === 'true') {
        // Clear the reset flow flags if user has completed login
        localStorage.removeItem('passwordResetFlowActive');
        localStorage.removeItem('passwordResetFlowStartTime');
        localStorage.removeItem('passwordResetCompleted');
        setIsRecoverySession(false);
      }
    };

    checkLoginStatus();
  }, [session]); // Re-check when session changes

  // Global state to track password reset flow across all browser tabs
  useEffect(() => {
    // Set a global flag to indicate password reset flow is active
    if (isPasswordResetFlow) {
      localStorage.setItem('passwordResetFlowActive', 'true');
      localStorage.setItem('passwordResetFlowStartTime', Date.now().toString());
    }

    // Check if password reset flow is active from other tabs
    const checkGlobalResetFlow = () => {
      const resetFlowActive = localStorage.getItem('passwordResetFlowActive');
      const startTime = localStorage.getItem('passwordResetFlowStartTime');
      
      if (resetFlowActive === 'true' && startTime) {
        const elapsedTime = Date.now() - parseInt(startTime);
        // If within 15 minutes, consider reset flow active
        if (elapsedTime < 15 * 60 * 1000) {
          setIsRecoverySession(true);
        } else {
          // Clear expired reset flow
          localStorage.removeItem('passwordResetFlowActive');
          localStorage.removeItem('passwordResetFlowStartTime');
        }
      }
    };

    checkGlobalResetFlow();

    // Listen for storage events (changes from other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'passwordResetFlowActive' && e.newValue === 'true') {
        setIsRecoverySession(true);
      } else if (e.key === 'passwordResetCompleted' && e.newValue === 'true') {
        // Clear reset flow when completed from other tab
        localStorage.removeItem('passwordResetFlowActive');
        localStorage.removeItem('passwordResetFlowStartTime');
        setIsRecoverySession(false);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isPasswordResetFlow]);

  // Check URL for recovery session
  useEffect(() => {
    const checkRecoverySession = () => {
      const hashParams = new URLSearchParams(location.hash.substring(1));
      const hashType = hashParams.get('type');
      
      if (hashType === 'recovery') {
        setIsRecoverySession(true);
        localStorage.setItem('passwordResetFlowActive', 'true');
        localStorage.setItem('passwordResetFlowStartTime', Date.now().toString());
      }
    };

    checkRecoverySession();
  }, [location.hash]);

  // Show loading indicator for initial session loading
  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  // CRITICAL: Check if user has a valid session and is not in recovery mode
  // This allows dashboard access after successful login
  if (session?.user && !isRecoverySession) {
    console.log('AuthGuard: Valid session detected, allowing access to protected routes');
    // Continue with normal auth flow checks below
  }

  // BLOCK ALL ACCESS DURING PASSWORD RESET FLOW - REDIRECT ALL ROUTES TO RESET-PASSWORD
  if (isPasswordResetFlow || isRecoverySession) {
    if (location.pathname === '/reset-password') {
      // Allow access to reset-password page only - session is preserved
      return <Outlet />;
    } else {
      // Redirect ALL other routes (including dashboard, base URL, etc.) to reset-password
      // This blocks all open browsers, navigational paths, and back buttons
      
      // Preserve the hash if it exists, otherwise use current hash
      const redirectHash = location.hash.includes('type=recovery') ? location.hash : '';
      const redirectUrl = `/reset-password${redirectHash}`;
      
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

        if (hasMfaEnrolled) {
          const mfaPassedFlag = localStorage.getItem('mfa_passed');
          if (mfaPassedFlag === 'true') {
            setTargetAal('aal2');
          } else {
            setTargetAal('aal1');
          }
        } else {
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
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (targetAal === 'aal1') {
    return <Navigate to={`/mfa-challenge?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (targetAal === 'aal2') {
    return <Outlet />;
  }

  return <Navigate to="/login" replace />;
};

export default AuthGuard;