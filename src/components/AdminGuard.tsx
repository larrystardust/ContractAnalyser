import React, { useEffect, useState, useRef } from 'react'; // Import useRef
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
  const mfaPassedFlagRef = useRef(false); // Use a ref to track if MFA was passed in this session

  useEffect(() => {
    const checkAdminAndMfaStatus = async () => {
      if (loadingSession) return;

      console.log('AdminGuard: Current session AAL:', session?.aal); // Log current AAL
      console.log('AdminGuard: Current session user:', session?.user?.id); // Log current user ID

      if (!session?.user) {
        setIsAdmin(false);
        setLoadingAdminStatus(false);
        setTargetAal(null); // No user, will redirect to login
        mfaPassedFlagRef.current = false; // Reset ref on logout
        return;
      }

      // Check localStorage for the mfa_passed flag only once per session
      if (!mfaPassedFlagRef.current && localStorage.getItem('mfa_passed') === 'true') {
        mfaPassedFlagRef.current = true;
        // localStorage.removeItem('mfa_passed'); // REMOVED: Clear it immediately after reading, now delayed
        console.log('AdminGuard: MFA passed flag detected.');
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
        console.log('AdminGuard: User has MFA enrolled:', hasMfaEnrolled);

        if (hasMfaEnrolled) {
          // If MFA is enrolled, and we have the mfaPassedFlagRef set, or session.aal is aal2
          if (mfaPassedFlagRef.current || session.aal === 'aal2') {
            console.log('AdminGuard: MFA enrolled and either flag or AAL2 detected. Granting access.');
            setTargetAal('aal2');
          } else {
            // MFA enrolled but no flag/AAL2, redirect to challenge
            console.log('AdminGuard: MFA enrolled but no flag/AAL2. Redirecting to challenge.');
            setTargetAal('aal1'); // User needs to complete MFA challenge
          }
        } else {
          // If no MFA is enrolled, AAL1 is sufficient (or aal2 if they somehow got it).
          // In this case, they are considered fully authenticated for access.
          console.log('AdminGuard: No MFA enrolled. Assuming aal2.');
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

  // New useEffect to clear the localStorage flag after a delay
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (targetAal === 'aal2' && mfaPassedFlagRef.current) {
      // Clear the flag after a short delay to ensure navigation and rendering stabilize
      timer = setTimeout(() => {
        localStorage.removeItem('mfa_passed');
        mfaPassedFlagRef.current = false; // Reset ref after clearing
        console.log('AdminGuard: Cleared mfa_passed from localStorage after delay.');
      }, 500); // 500ms delay
    }
    return () => clearTimeout(timer); // Cleanup the timer
  }, [targetAal]); // Run this effect when targetAal changes

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
    console.log('AdminGuard: No active user session found. Redirecting to login page.');
    return <Navigate to="/login" replace />;
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