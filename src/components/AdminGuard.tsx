import React, { useEffect, useState } from 'react'; // Removed useRef
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
  const [targetAal, setTargetAal] = useState<'aal1' | 'aal2' | null>(null); // null: checking, 'aal1': needs MFA, 'aal2': good to go
  // Removed mfaPassedFlagRef and its associated useEffect for clearing localStorage

  useEffect(() => {
    const checkAdminAndMfaStatus = async () => {
      if (loadingSession) return;

      // console.log('AdminGuard: Current session AAL:', session?.aal); // REMOVED
      // console.log('AdminGuard: Current session user:', session?.user?.id); // REMOVED

      if (!session?.user) {
        setIsAdmin(false);
        setLoadingAdminStatus(false);
        setTargetAal(null); // No user, will redirect to login
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

        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) {
          console.error('AdminGuard: Error listing MFA factors:', factorsError);
          // If error fetching factors, assume no MFA is required for now to avoid blocking
          setTargetAal('aal2');
          return;
        }

        const hasMfaEnrolled = factors.totp.length > 0;
        // console.log('AdminGuard: User has MFA enrolled:', hasMfaEnrolled); // REMOVED

        if (hasMfaEnrolled) {
          // If MFA is enrolled, check localStorage for the mfa_passed flag
          const mfaPassedFlag = localStorage.getItem('mfa_passed');
          if (mfaPassedFlag === 'true') {
            // console.log('AdminGuard: MFA enrolled and mfa_passed flag found. Granting access.'); // REMOVED
            setTargetAal('aal2');
          } else {
            // MFA enrolled but no flag, redirect to challenge
            // console.log('AdminGuard: MFA enrolled but no mfa_passed flag. Redirecting to challenge.'); // REMOVED
            setTargetAal('aal1'); // User needs to complete MFA challenge
          }
        } else {
          // If no MFA is enrolled, AAL1 is sufficient.
          // console.log('AdminGuard: No MFA enrolled. Granting access.'); // REMOVED
          setTargetAal('aal2');
        }
      } catch (err) {
        console.error('AdminGuard: Unexpected error during admin/MFA check:', err);
        setIsAdmin(false);
        setLoadingAdminStatus(false);
        setTargetAal('aal2'); // Fallback to allow access on unexpected errors
      }
    };

    setTargetAal(null); // Reset on session/loadingSession change
    checkAdminAndMfaStatus();
  }, [session, loadingSession, supabase]);

  // Removed useEffect to clear localStorage flag after delay

  // Show loading indicator while checking authentication and admin/MFA status
  if (loadingSession || loadingAdminStatus || targetAal === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  // If not loading, check if a user session exists.
  if (!session || !session.user) {
    // console.log('AdminGuard: No active user session found. Redirecting to login page.'); // REMOVED
    // MODIFIED: Pass current path and search as redirect parameter
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  // Admin specific check
  if (!isAdmin) {
    // console.log('AdminGuard: User is not an admin. Redirecting to dashboard.'); // REMOVED
    return <Navigate to="/dashboard" replace />;
  }

  // MFA check for admin
  if (targetAal === 'aal1') {
    // console.log('AdminGuard: Admin user has MFA enrolled but session is aal1. Redirecting to MFA challenge.'); // REMOVED
    return <Navigate to={`/mfa-challenge?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  // If an authenticated admin user is found and MFA check passed, render the protected content.
  if (targetAal === 'aal2') {
    // console.log('AdminGuard: User is an admin and MFA check passed. Rendering protected content.'); // REMOVED
    return <Outlet />;
  }

  // This should ideally not be reached
  console.warn('AdminGuard: Unexpected state. Redirecting to login.');
  return <Navigate to="/login" replace />;
};

export default AdminGuard;