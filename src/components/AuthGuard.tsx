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
  }, [session]);

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
        if (elapsedTime < 15 * 60 * 1000) {
          setIsRecoverySession(true);
        } else {
          localStorage.removeItem('passwordResetFlowActive');
          localStorage.removeItem('passwordResetFlowStartTime');
        }
      }
    };

    checkGlobalResetFlow();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'passwordResetFlowActive' && e.newValue === 'true') {
        setIsRecoverySession(true);
      } else if (e.key === 'passwordResetCompleted' && e.newValue === 'true') {
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

  // BLOCK ALL ACCESS DURING PASSWORD RESET FLOW
  if (isPasswordResetFlow || isRecoverySession) {
    // Set global flag to block modals and overlays
    localStorage.setItem('blockModalsDuringReset', 'true');
    
    if (location.pathname === '/reset-password') {
      return <Outlet />;
    } else {
      const redirectHash = location.hash.includes('type=recovery') ? location.hash : '';
      const redirectUrl = `/reset-password${redirectHash}`;
      return <Navigate to={redirectUrl} replace />;
    }
  } else {
    // Clear modal blocking when not in reset flow
    localStorage.removeItem('blockModalsDuringReset');
  }

  // Show loading indicator for initial session loading
  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  // Normal authentication flow
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