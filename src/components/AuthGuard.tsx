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

  const hashParams = new URLSearchParams(location.hash.substring(1));
  const isHashRecovery = hashParams.get('type') === 'recovery';
  const isLocalStorageRecoveryActive = localStorage.getItem('passwordResetFlowActive') === 'true';
  const isPasswordResetInitiated = isHashRecovery || isLocalStorageRecoveryActive;

  // 🔒 Enforce re-check when using browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      if (!session || !session.user) {
        console.log('AuthGuard: Blocked back/forward navigation without session.');
        navigate('/login', { replace: true });
      }
      if (isPasswordResetInitiated && location.pathname !== '/reset-password') {
        console.log('AuthGuard: Blocked back/forward navigation during password reset.');
        navigate('/login', { replace: true });
      }
      if (hasMfaEnrolled && session?.aal === 'aal1' && location.pathname !== '/mfa-challenge') {
        console.log('AuthGuard: Blocked forward/back navigation requiring MFA.');
        navigate('/mfa-challenge', { replace: true });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [session, isPasswordResetInitiated, location.pathname, hasMfaEnrolled, navigate]);

  // 🔒 HARD LOCK: Prevent BFCache restores, force reload on back/forward
  useEffect(() => {
    // Disable automatic scroll restoration (prevents instant bfcache snaps)
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    const handleBeforeUnload = () => {
      // Hint to browser: don’t store this page in bfcache
      localStorage.setItem('disableBFCache', Date.now().toString());
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.log('AuthGuard: BFCache restore detected. Forcing reload for fresh auth check.');
        window.location.reload(); // Full reload ensures revalidation
      }
    };
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  // --- Recovery state enforcement ---
  useEffect(() => {
    if (isPasswordResetInitiated) {
      localStorage.setItem('passwordResetFlowActive', 'true');
      localStorage.setItem('blockModalsDuringReset', 'true');
    } else {
      localStorage.removeItem('passwordResetFlowActive');
      localStorage.removeItem('blockModalsDuringReset');
    }

    if (isPasswordResetInitiated && location.pathname !== '/reset-password') {
      setIsRedirecting(true);
      supabase.auth.signOut({ scope: 'global' }).then(() => {
        navigate('/login', { replace: true });
      }).catch(() => {
        navigate('/login', { replace: true });
      });
      return;
    }

    const handleStorageChange = async (e: StorageEvent) => {
      if (e.key === 'passwordResetFlowActive' && e.newValue === 'true') {
        if (location.pathname !== '/reset-password') {
          setIsRedirecting(true);
          await supabase.auth.signOut({ scope: 'global' });
          navigate('/login', { replace: true });
        }
      } else if (e.key === 'passwordResetFlowActive' && e.newValue === null) {
        if (isPasswordResetInitiated && location.pathname === '/reset-password') {
          setIsRedirecting(true);
          navigate('/login', { replace: true });
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => window.removeEventListener('storage', handleStorageChange);
  }, [isPasswordResetInitiated, location.pathname, navigate, supabase]);

  // --- MFA enforcement ---
  useEffect(() => {
    const checkMfaEnrollment = async () => {
      setLoadingMfaStatus(true);
      if (!session?.user) {
        setHasMfaEnrolled(false);
        setLoadingMfaStatus(false);
        return;
      }
      try {
        const { data: factors, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;
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

  if (isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  if (loadingSession || loadingMfaStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  if (isPasswordResetInitiated) {
    if (location.pathname === '/reset-password') {
      return <Outlet />;
    } else {
      supabase.auth.signOut({ scope: 'global' });
      return <Navigate to="/login" replace />;
    }
  }

  if (!session || !session.user) {
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