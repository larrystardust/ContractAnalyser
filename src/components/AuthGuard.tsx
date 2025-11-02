import React, { useEffect, useState } from 'react';
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Database } from '../types/supabase';
import { useTranslation } from 'react-i18next';

interface AuthGuardProps {
  children?: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = () => {
  const { session, isLoading: loadingSession } = useSessionContext();
  const supabase = useSupabaseClient<Database>();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [hasMfaEnrolled, setHasMfaEnrolled] = useState(false);
  const [loadingMfaStatus, setLoadingMfaStatus] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // --- ULTRA AGGRESSIVE mobile camera flow detection ---
  const detectMobileCameraFlow = () => {
    // Check current URL
    const searchParams = new URLSearchParams(location.search);
    const isCurrentlyActive = location.pathname === '/upload' && 
           searchParams.has('scanSessionId') && 
           searchParams.has('auth_token');
    
    // Also check if we should be in mobile flow based on stored state
    const wasMobileCameraFlowActive = sessionStorage.getItem('mobileCameraFlowActive') === 'true';
    
    return isCurrentlyActive || wasMobileCameraFlowActive;
  };

  const mobileCameraFlowActive = detectMobileCameraFlow();

  // --- ABSOLUTE PRIORITY: Mobile camera flow takes over everything ---
  if (mobileCameraFlowActive) {
    // Store state persistently
    sessionStorage.setItem('mobileCameraFlowActive', 'true');
    
    const searchParams = new URLSearchParams(location.search);
    const scanSessionId = searchParams.get('scanSessionId');
    const authToken = searchParams.get('auth_token');
    
    if (scanSessionId) sessionStorage.setItem('scanSessionId', scanSessionId);
    if (authToken) sessionStorage.setItem('authToken', authToken);
    
    // If we're not currently on the upload page but should be, redirect immediately
    if (location.pathname !== '/upload') {
      const originalUploadUrl = sessionStorage.getItem('originalUploadUrl');
      if (originalUploadUrl) {
        window.location.replace(originalUploadUrl);
      } else {
        // Reconstruct URL
        const storedScanSessionId = sessionStorage.getItem('scanSessionId');
        const storedAuthToken = sessionStorage.getItem('authToken');
        if (storedScanSessionId && storedAuthToken) {
          const uploadUrl = `/upload?scanSessionId=${storedScanSessionId}&auth_token=${storedAuthToken}`;
          window.location.replace(uploadUrl);
        }
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Redirecting to upload page...</p>
          </div>
        </div>
      );
    }
    
    // Store current URL as the original upload URL
    sessionStorage.setItem('originalUploadUrl', window.location.href);
    
    // RENDER OUTLET IMMEDIATELY - NO AUTH CHECKS
    return <Outlet />;
  }

  // --- Clean up mobile flow state when not active ---
  useEffect(() => {
    if (!mobileCameraFlowActive) {
      sessionStorage.removeItem('mobileCameraFlowActive');
      sessionStorage.removeItem('originalUploadUrl');
    }
  }, [mobileCameraFlowActive]);

  // --- ONLY RUN NORMAL AUTH LOGIC IF NOT IN MOBILE CAMERA FLOW ---

  // --- Detect reset-password flow ---
  const hashParams = new URLSearchParams(location.hash.substring(1));
  const isHashRecovery = hashParams.get('type') === 'recovery';
  const isLocalStorageRecoveryActive = localStorage.getItem('passwordResetFlowActive') === 'true';
  const isPasswordResetInitiated = isHashRecovery || isLocalStorageRecoveryActive;

  // --- Global invalidation when reset starts ---
  useEffect(() => {
    if (isPasswordResetInitiated) {
      // Broadcast reset state across all tabs
      localStorage.setItem('passwordResetFlowActive', 'true');
      localStorage.setItem('blockModalsDuringReset', 'true');

      // Force sign out globally (all sessions, all browsers)
      supabase.auth.signOut({ scope: 'global' }).finally(() => {
        if (location.pathname !== '/reset-password') {
          setIsRedirecting(true);
          navigate('/reset-password', { replace: true });
        }
      });
    } else {
      // Clean up flags once reset flow ends
      localStorage.removeItem('passwordResetFlowActive');
      localStorage.removeItem('blockModalsDuringReset');
    }

    // Sync reset status across open tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'passwordResetFlowActive' && e.newValue === 'true') {
        supabase.auth.signOut({ scope: 'global' }).finally(() => {
          navigate('/reset-password', { replace: true });
        });
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => window.removeEventListener('storage', handleStorageChange);
  }, [isPasswordResetInitiated, location.pathname, navigate, supabase]);

  // --- HARD lock back/forward buttons + BFCache ---
  useEffect(() => {
    const handlePopState = () => {
      if (isPasswordResetInitiated || !session) {
        navigate('/reset-password', { replace: true });
      }
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        window.location.reload();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [isPasswordResetInitiated, session, navigate]);

  // --- MFA check ---
  useEffect(() => {
    const checkMfaEnrollment = async () => {
      setLoadingMfaStatus(true);
      if (!session?.user) {
        setHasMfaEnrolled(false);
        setLoadingMfaStatus(false);
        return;
      }
      try {
        const { data: factors, error: getFactorsError } = await supabase.auth.mfa.listFactors();
        if (getFactorsError) throw getFactorsError;

        const totpFactor = factors?.totp.find(f => f.status === 'verified');
        setHasMfaEnrolled(!!totpFactor);
      } catch (err: any) {
        console.error("AuthGuard: MFA check error:", err);
        setHasMfaEnrolled(false);
      } finally {
        setLoadingMfaStatus(false);
      }
    };
    checkMfaEnrollment();
  }, [session?.user?.id, supabase]);

  // Show loading indicator while checking authentication and admin/MFA status
  if (isRedirecting || loadingSession || loadingMfaStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  // --- Enforce reset-password lockdown ---
  if (isPasswordResetInitiated) {
    if (location.pathname === '/reset-password' || location.pathname === '/') {
      return <Outlet />;
    } else {
      return <Navigate to="/reset-password" replace />;
    }
  }

  // --- Enforce normal auth rules ---
  if (!session || !session.user) {
    // For all other protected routes, redirect to login
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  // Only redirect to MFA challenge if MFA is ENROLLED and AAL is aal1.
  // This check should happen AFTER ensuring the user is authenticated.
  if (hasMfaEnrolled && session.aal === 'aal1' && location.pathname !== '/mfa-challenge') {
    return <Navigate to={`/mfa-challenge?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  // If all checks pass, render the protected content
  return <Outlet />;
};

export default AuthGuard;