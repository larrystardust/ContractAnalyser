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
  const [isEmailVerifiedByAdmin, setIsEmailVerifiedByAdmin] = useState<boolean | null>(null); // ADDED: New state for custom email verification

  useEffect(() => {
    const checkAdminAndMfaStatus = async () => {
      if (loadingSession) return;

      console.log('AdminGuard: Current session AAL:', session?.aal); // Log current AAL
      console.log('AdminGuard: Current session user:', session?.user?.id); // Log current user ID

      if (!session?.user) {
        setIsAdmin(false);
        setLoadingAdminStatus(false);
        setTargetAal(null); // No user, will redirect to login
        setIsEmailVerifiedByAdmin(null); // Reset custom flag
        return;
      }

      // ADDED: Fetch custom email verification status from profiles table
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('is_admin, is_email_verified_by_admin') // MODIFIED: Select is_admin and is_email_verified_by_admin
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileError) {
          console.error('AdminGuard: Error fetching profile for admin/email verification:', profileError);
          setIsAdmin(false); // Default to not admin on error
          setIsEmailVerifiedByAdmin(false); // Default to false on error for security
        } else {
          setIsAdmin(profileData?.is_admin || false);
          setIsEmailVerifiedByAdmin(profileData?.is_email_verified_by_admin ?? false); // Default to false if null
        }
        setLoadingAdminStatus(false); // Set loading to false after fetching profile
      } catch (err) {
        console.error('AdminGuard: Unexpected error fetching profile for admin/email verification:', err);
        setIsAdmin(false);
        setIsEmailVerifiedByAdmin(false);
        setLoadingAdminStatus(false);
      }

      // MODIFIED: Check for email confirmation (both Supabase's and custom admin flag) for admin users
      const isEmailUnconfirmed = !session.user.email_confirmed_at || isEmailVerifiedByAdmin === false;

      if (isEmailUnconfirmed) {
        console.log('AdminGuard: Admin user email not confirmed. Redirecting to email confirmation page.');
        navigate('/email-not-confirmed', { replace: true });
        return; // Stop further checks and redirection
      }

      try {
        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) {
          console.error('AdminGuard: Error listing MFA factors:', factorsError);
          // If error fetching factors, assume no MFA is required for now to avoid blocking
          setTargetAal('aal2');
          return;
        }

        const hasMfaEnrolled = factors.totp.length > 0;
        console.log('AdminGuard: User has MFA enrolled:', hasMfaEnrolled);

        if (hasMfaEnrolled) {
          // If MFA is enrolled, check localStorage for the mfa_passed flag
          const mfaPassedFlag = localStorage.getItem('mfa_passed');
          if (mfaPassedFlag === 'true') {
            console.log('AdminGuard: MFA enrolled and mfa_passed flag found. Granting access.');
            setTargetAal('aal2');
          } else {
            // MFA enrolled but no flag, redirect to challenge
            console.log('AdminGuard: MFA enrolled but no mfa_passed flag. Redirecting to challenge.');
            setTargetAal('aal1'); // User needs to complete MFA challenge
          }
        } else {
          // If no MFA is enrolled, AAL1 is sufficient.
          console.log('AdminGuard: No MFA enrolled. Granting access.');
          setTargetAal('aal2');
        }
      } catch (err) {
        console.error('AdminGuard: Unexpected error during admin/MFA check:', err);
        setTargetAal('aal2'); // Fallback to allow access on unexpected errors
      }
    };

    setTargetAal(null); // Reset on session/loadingSession change
    setIsEmailVerifiedByAdmin(null); // Reset custom flag on session/loadingSession change
    checkAdminAndMfaStatus();
  }, [session, loadingSession, supabase, navigate, isEmailVerifiedByAdmin]); // ADDED isEmailVerifiedByAdmin to dependencies

  // Show loading indicator while checking authentication and admin/MFA status
  // MODIFIED: Add isEmailVerifiedByAdmin === null to loading condition
  if (loadingSession || loadingAdminStatus || targetAal === null || isEmailVerifiedByAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  // If not loading, check if a user session exists.
  if (!session || !session.user) {
    console.log('AdminGuard: No active user session found. Redirecting to login page.');
    // MODIFIED: Pass current path and search as redirect parameter
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  // MODIFIED: Check for email confirmation (both Supabase's and custom admin flag) again before proceeding
  const isEmailUnconfirmed = !session.user.email_confirmed_at || isEmailVerifiedByAdmin === false;
  if (isEmailUnconfirmed) {
    console.log('AdminGuard: Admin user email not confirmed. Redirecting to email confirmation page.');
    return <Navigate to="/email-not-confirmed" replace />;
  }

  // Admin specific check
  if (!isAdmin) {
    console.log('AdminGuard: User is not an admin. Redirecting to dashboard.');
    return <Navigate to="/dashboard" replace />;
  }

  // MFA check for admin
  if (targetAal === 'aal1') {
    console.log('AdminGuard: Admin user has MFA enrolled but session is aal1. Redirecting to MFA challenge.');
    return <Navigate to={`/mfa-challenge?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  // If an authenticated admin user is found and MFA check passed, render the protected content.
  if (targetAal === 'aal2') {
    console.log('AdminGuard: User is an admin and MFA check passed. Rendering protected content.');
    return <Outlet />;
  }

  // This should ideally not be reached
  console.warn('AdminGuard: Unexpected state. Redirecting to login.');
  return <Navigate to="/login" replace />;
};

export default AdminGuard;