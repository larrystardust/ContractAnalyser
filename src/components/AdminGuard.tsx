import React, { useEffect, useState } from 'react';
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Database } from '../types/supabase';

const AdminGuard: React.FC = () => {
  const { session, isLoading: loadingSession } = useSessionContext();
  const supabase = useSupabaseClient<Database>();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingAdminStatus, setLoadingAdminStatus] = useState(true);
  const [mfaCheckComplete, setMfaCheckComplete] = useState(false);

  useEffect(() => {
    const checkAdminAndMfaStatus = async () => {
      if (loadingSession) return;

      if (!session?.user) {
        setIsAdmin(false);
        setLoadingAdminStatus(false);
        setMfaCheckComplete(true);
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
            setMfaCheckComplete(true); // Allow access on error, but log it
            return;
          }

          if (factors.totp.length > 0) {
            // Admin user has MFA enrolled but session is aal1, redirect to MFA challenge
            console.log('AdminGuard: Admin user has MFA enrolled but session is aal1. Redirecting to MFA challenge.');
            navigate(`/mfa-challenge?redirect=${encodeURIComponent(location.pathname + location.search)}`);
          } else {
            // No MFA factors enrolled, allow access
            setMfaCheckComplete(true);
          }
        } else {
          // Either not an admin, or already aal2, or no MFA enrolled, so MFA check is complete
          setMfaCheckComplete(true);
        }
      } catch (err) {
        console.error('AdminGuard: Unexpected error during admin/MFA check:', err);
        setIsAdmin(false);
        setLoadingAdminStatus(false);
        setMfaCheckComplete(true);
      }
    };

    checkAdminAndMfaStatus();
  }, [session, loadingSession, supabase, location, navigate]); // Added navigate to dependencies

  // Show loading indicator while checking authentication and admin/MFA status
  if (loadingSession || loadingAdminStatus || !mfaCheckComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  // If not loading, check if a user session exists and if the user is an admin and MFA check passed.
  if (!session || !session.user || !isAdmin || session.aal === 'aal1') { // Added session.aal check here as a final gate
    console.log('AdminGuard: User is not authenticated, not an admin, or MFA not completed. Redirecting to dashboard.');
    return <Navigate to="/dashboard" replace />; // Redirect to dashboard or login page
  }

  // If an authenticated admin user is found and MFA check passed, render the protected content.
  console.log('AdminGuard: User is an admin and MFA check passed. Rendering protected content.');
  return <Outlet />;
};

export default AdminGuard;