import React, { useEffect, useState } from 'react';
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Database } from '../types/supabase';

const AdminGuard: React.FC = () => {
  const { session, isLoading: loadingSession } = useSessionContext();
  const supabase = useSupabaseClient<Database>();
  const location = useLocation();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingAdminStatus, setLoadingAdminStatus] = useState(true);
  const [mfaRequired, setMfaRequired] = useState<boolean | null>(null); // null: checking, true: required, false: not required

  useEffect(() => {
    const checkAdminAndMfaStatus = async () => {
      if (loadingSession) return;

      if (!session?.user) {
        setIsAdmin(false);
        setLoadingAdminStatus(false);
        setMfaRequired(false); // No user, so MFA not required (will redirect to login)
        return;
      }

      try {
        // First, check admin status
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileError) {
          console.error('AdminGuard: Error fetching admin status:', profileError);
          setIsAdmin(false);
        } else {
          setIsAdmin(profile?.is_admin || false);
        }
        setLoadingAdminStatus(false);

        // Then, check MFA status if admin and aal1
        if (profile?.is_admin && session.aal === 'aal1') {
          const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
          if (factorsError) {
            console.error('AdminGuard: Error listing MFA factors:', factorsError);
            setMfaRequired(false); // Treat error as no MFA required for now
            return;
          }

          if (factors.totp.length > 0) {
            // Admin user has MFA enrolled but session is aal1, MFA is required
            setMfaRequired(true);
          } else {
            // No MFA factors enrolled, MFA is not required
            setMfaRequired(false);
          }
        } else {
          // Either not an admin, or already aal2, or no MFA enrolled, so MFA is not required
          setMfaRequired(false);
        }
      } catch (err) {
        console.error('AdminGuard: Unexpected error during admin/MFA check:', err);
        setIsAdmin(false);
        setLoadingAdminStatus(false);
        setMfaRequired(false); // Treat unexpected error as no MFA required
      }
    };

    setMfaRequired(null); // Reset state to 'checking' on session/loadingSession change
    checkAdminAndMfaStatus();
  }, [session, loadingSession, supabase]); // Removed location, navigate from dependencies

  // Show loading indicator while checking authentication and admin/MFA status
  if (loadingSession || loadingAdminStatus || mfaRequired === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  // If not loading, check if a user session exists.
  if (!session || !session.user) {
    console.log('AdminGuard: No active user session found. Redirecting to login page.');
    return <Navigate to="/login" replace />;
  }

  // Admin specific check
  if (!isAdmin) {
    console.log('AdminGuard: User is not an admin. Redirecting to dashboard.');
    return <Navigate to="/dashboard" replace />;
  }

  // MFA check for admin
  if (mfaRequired) {
    console.log('AdminGuard: Admin user has MFA enrolled but session is aal1. Redirecting to MFA challenge.');
    return <Navigate to={`/mfa-challenge?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  // If an authenticated admin user is found and MFA check passed, render the protected content.
  // ADDED: Explicitly check for aal2 here to ensure full authentication level.
  if (session.aal === 'aal2') {
    console.log('AdminGuard: User is an admin and MFA check passed. Rendering protected content.');
    return <Outlet />;
  } else {
    // This case should ideally not be hit if logic is perfect, but acts as a safeguard.
    console.warn('AdminGuard: Admin user authenticated but AAL is not aal2. Redirecting to MFA challenge as a fallback.');
    return <Navigate to={`/mfa-challenge?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
};

export default AdminGuard;