import React, { useEffect, useState } from 'react'; // Removed useRef
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
        // console.log('AuthGuard: Reset flow triggered in another tab → forcing redirect.'); // REMOVED
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
        // console.log('AuthGuard: Prevented back/forward navigation into protected route.'); // REMOVED
        navigate('/reset-password', { replace: true });
      }
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        // console.log('AuthGuard: Page restored from bfcache → forcing reload.'); // REMOVED
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
      } catch (err) {
        console.error("AuthGuard: MFA check error:", err);
        setHasMfaEnrolled(false);
      } finally {
        setLoadingMfaStatus(false);
      }
    };
    checkMfaEnrollment();
  }, [session?.user?.id, supabase]);

  // Removed useEffect to clear localStorage flag after delay

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
    // ADDED: Special handling for /upload with scanSessionId/auth_token
    const searchParams = new URLSearchParams(location.search);
    const isMobileCameraFlow = location.pathname === '/upload' && searchParams.has('scanSessionId') && searchParams.has('auth_token');

    if (isMobileCameraFlow) {
      // Allow access to /upload for unauthenticated users if it's part of the mobile camera flow.
      // The UploadPage component will handle the silent authentication.
      return <Outlet />;
    }
    
    // For all other protected routes, redirect to login
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (hasMfaEnrolled && session.aal === 'aal1' && location.pathname !== '/mfa-challenge') {
    return <Navigate to={`/mfa-challenge?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (session.aal === 'aal1' && location.pathname !== '/mfa-challenge') {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  return <Outlet />;
};

export default AuthGuard;