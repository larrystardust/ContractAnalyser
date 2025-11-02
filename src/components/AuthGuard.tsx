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

  // --- IMMEDIATE mobile camera flow detection ---
  const detectMobileCameraFlow = () => {
    const searchParams = new URLSearchParams(location.search);
    return location.pathname === '/upload' && 
           searchParams.has('scanSessionId') && 
           searchParams.has('auth_token');
  };

  const mobileCameraFlowActive = detectMobileCameraFlow();

  // Effect to handle mobile camera flow state and base URL redirection
  useEffect(() => {
    // Store current state if in mobile camera flow
    if (mobileCameraFlowActive) {
      sessionStorage.setItem('mobileCameraFlowActive', 'true');
      sessionStorage.setItem('originalUploadUrl', window.location.href);
      
      // Also store in localStorage as backup for cross-tab persistence
      localStorage.setItem('mobileCameraFlowActive', 'true');
    } else {
      // Only clear if we're not in mobile flow AND not on base URL redirect
      const wasMobileCameraFlowActive = sessionStorage.getItem('mobileCameraFlowActive') === 'true';
      if (!wasMobileCameraFlowActive || location.pathname !== '/') {
        sessionStorage.removeItem('mobileCameraFlowActive');
        sessionStorage.removeItem('originalUploadUrl');
        localStorage.removeItem('mobileCameraFlowActive');
      }
    }
  }, [location.pathname, mobileCameraFlowActive]);

  // --- Redirect back to upload page if mobile flow was active ---
  useEffect(() => {
    const wasMobileCameraFlowActive = sessionStorage.getItem('mobileCameraFlowActive') === 'true' || 
                                     localStorage.getItem('mobileCameraFlowActive') === 'true';
    
    if (wasMobileCameraFlowActive && !mobileCameraFlowActive) {
      // If we were in mobile flow but now we're not on upload page, redirect back
      if (location.pathname !== '/upload') {
        const originalUploadUrl = sessionStorage.getItem('originalUploadUrl');
        if (originalUploadUrl) {
          // Use hard redirect to prevent any React Router interference
          console.log('Redirecting back to upload page from:', location.pathname);
          window.location.replace(originalUploadUrl);
          return;
        } else {
          // Fallback: reconstruct upload URL from sessionStorage params
          const scanSessionId = sessionStorage.getItem('scanSessionId');
          const authToken = sessionStorage.getItem('authToken');
          if (scanSessionId && authToken) {
            const fallbackUrl = `/upload?scanSessionId=${scanSessionId}&auth_token=${authToken}`;
            window.location.replace(fallbackUrl);
            return;
          }
        }
      }
    }
  }, [location.pathname, mobileCameraFlowActive]);

  // --- Store URL parameters for fallback redirect ---
  useEffect(() => {
    if (mobileCameraFlowActive) {
      const searchParams = new URLSearchParams(location.search);
      const scanSessionId = searchParams.get('scanSessionId');
      const authToken = searchParams.get('auth_token');
      
      if (scanSessionId) sessionStorage.setItem('scanSessionId', scanSessionId);
      if (authToken) sessionStorage.setItem('authToken', authToken);
    }
  }, [location.search, mobileCameraFlowActive]);

  // --- CRITICAL: Mobile camera flow takes ABSOLUTE priority ---
  if (mobileCameraFlowActive) {
    return <Outlet />;
  }

  // --- Show loading while we might be redirecting ---
  const wasMobileCameraFlowActive = sessionStorage.getItem('mobileCameraFlowActive') === 'true' || 
                                   localStorage.getItem('mobileCameraFlowActive') === 'true';
  
  if (wasMobileCameraFlowActive && !mobileCameraFlowActive && location.pathname !== '/upload') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting back to upload page...</p>
        </div>
      </div>
    );
  }

  // --- Only run normal auth logic if NOT in mobile camera flow ---

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