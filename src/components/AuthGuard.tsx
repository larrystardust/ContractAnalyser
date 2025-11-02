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
  const [isMobileCameraFlowActive, setIsMobileCameraFlowActive] = useState(false);

  // --- Detect reset-password flow ---
  const hashParams = new URLSearchParams(location.hash.substring(1));
  const isHashRecovery = hashParams.get('type') === 'recovery';
  const isLocalStorageRecoveryActive = localStorage.getItem('passwordResetFlowActive') === 'true';
  const isPasswordResetInitiated = isHashRecovery || isLocalStorageRecoveryActive;

  // Effect to determine if mobile camera flow is active
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams(location.hash.substring(1));

    const hasScanSessionId = searchParams.has('scanSessionId') || hashParams.has('scanSessionId');
    const hasAuthToken = searchParams.has('auth_token') || hashParams.has('auth_token');

    const isActive = location.pathname === '/upload' && hasScanSessionId && hasAuthToken;
    setIsMobileCameraFlowActive(isActive);
  }, [location.pathname, location.search, location.hash]);


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
    const handlePopState = (e: PopStateEvent) => {
      if (isMobileCameraFlowActive) {
        // If in mobile camera flow, always force back to /upload if trying to navigate away
        if (location.pathname !== '/upload') {
          const scanSessionId = new URLSearchParams(location.search).get('scanSessionId') || new URLSearchParams(location.hash.substring(1)).get('scanSessionId');
          const authToken = new URLSearchParams(location.search).get('auth_token') || new URLSearchParams(location.hash.substring(1)).get('auth_token');
          if (scanSessionId && authToken) {
            navigate(`/upload?scanSessionId=${scanSessionId}&auth_token=${authToken}`, { replace: true });
          } else {
            navigate('/upload', { replace: true }); // Fallback
          }
        }
        // If already on /upload, do nothing, let the browser handle it (or the beforeunload in UploadPage)
      } else if (isPasswordResetInitiated) {
        // Normal password reset flow
        if (location.pathname !== '/reset-password') {
          navigate('/reset-password', { replace: true });
        }
      } else if (!session) {
        // If not authenticated and not in password reset, redirect to login
        // This list of public paths is getting long and hard to maintain.
        // A better approach might be to have a list of protected paths and redirect if current path is protected.
        const publicPaths = [
          '/', '/public-report-view', '/checkout/success', '/checkout/cancel',
          '/sample-dashboard', '/landing-pricing', '/login', '/signup',
          '/auth/callback', '/accept-invitation', '/auth/email-sent',
          '/mfa-challenge', '/reset-password', '/disclaimer', '/terms',
          '/privacy-policy', '/help', '/maintenance', '/blog'
        ];
        const currentPathBase = location.pathname.split('?')[0].split('#')[0];
        const isPublicPath = publicPaths.some(p => {
          if (p.includes(':slug')) { // Handle dynamic blog post routes
            const regexPattern = new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:slug/g, '[^/]+') + '$');
            return regexPattern.test(currentPathBase);
          }
          return p === currentPathBase;
        });

        if (!isPublicPath) {
          navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`, { replace: true });
        }
      }
    };

    // REMOVED: handlePageShow listener entirely as it was causing issues with reloads.
    // window.addEventListener('pageshow', handlePageShow);

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      // window.removeEventListener('pageshow', handlePageShow); // REMOVED
    };
  }, [isMobileCameraFlowActive, isPasswordResetInitiated, session, navigate, location.pathname, location.search, location.hash]);

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

  // --- CRITICAL FIX: Nuclear Trap for Mobile Camera Flow ---
  // This must be the absolute highest priority check after initial loading.
  if (isMobileCameraFlowActive) {
    // If the user is on the /upload page, let it render
    if (location.pathname === '/upload') {
      return <Outlet />;
    } else {
      // If somehow navigated away from /upload while in mobile camera flow, force back
      const scanSessionId = new URLSearchParams(location.search).get('scanSessionId') || new URLSearchParams(location.hash.substring(1)).get('scanSessionId');
      const authToken = new URLSearchParams(location.search).get('auth_token') || new URLSearchParams(location.hash.substring(1)).get('auth_token');
      if (scanSessionId && authToken) {
        return <Navigate to={`/upload?scanSessionId=${scanSessionId}&auth_token=${authToken}`} replace />;
      } else {
        // Fallback if parameters are lost, go to generic upload
        return <Navigate to="/upload" replace />;
      }
    }
  }

  // --- Enforce reset-password lockdown (only if NOT in mobile camera flow) ---
  if (isPasswordResetInitiated) {
    if (location.pathname === '/reset-password' || location.pathname === '/') {
      return <Outlet />;
    } else {
      return <Navigate to="/reset-password" replace />;
    }
  }

  // --- Enforce normal auth rules (only if NOT in mobile camera flow or password reset) ---
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