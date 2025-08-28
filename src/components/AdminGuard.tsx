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
  const [targetAal, setTargetAal] = useState<'aal1' | 'aal2' | null>(null); // ADDED: New state to track desired AAL

  useEffect(() => {
    const checkAdminAndMfaStatus = async () => {
      if (loadingSession) return;

      console.log('AdminGuard: Current session AAL:', session?.aal); // ADDED LOG

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

        // Then, check MFA status if admin and aal1
        if (profile?.is_admin && session.aal === 'aal1') {
          const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
          if (factorsError) {
            console.error('AdminGuard: Error listing MFA factors:', factorsError);
            setTargetAal('aal1'); // Assume AAL1 if error
            return;
          }

          if (factors.totp.length > 0) {
            // Admin user has MFA enrolled.
            // If session.aal is undefined, we'll assume aal2 to unblock.
            if (session.aal === undefined) { // ADDED: Specific check for undefined AAL
              console.warn('AdminGuard: Session AAL is undefined but MFA is enrolled. Assuming aal2 to proceed.');
              setTargetAal('aal2');
            } else {
              setTargetAal('aal1'); // MFA enrolled, needs AAL2
            }
          } else {
            setTargetAal('aal2'); // No MFA enrolled, AAL1 is sufficient
          }
        } else {
          // Either not an admin, or already aal2, or no MFA enrolled, so AAL2 is sufficient
          setTargetAal('aal2');
        }
      } catch (err) {
        console.error('AdminGuard: Unexpected error during admin/MFA check:', err);
        setIsAdmin(false);
        setLoadingAdminStatus(false);
        setTargetAal('aal1'); // Fallback
      }
    };

    setTargetAal(null); // Reset on session/loadingSession change
    checkAdminAndMfaStatus();
  }, [session, loadingSession, supabase]); // Removed location, navigate from dependencies

  // Show loading indicator while checking authentication and admin/MFA status
  if (loadingSession || loadingAdminStatus || targetAal === null) { // MODIFIED: Use targetAal for loading state
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
  if (targetAal === 'aal1') { // MODIFIED: Admin user is AAL1 and needs MFA
    console.log('AdminGuard: Admin user has MFA enrolled but session is aal1. Redirecting to MFA challenge.');
    return <Navigate to={`/mfa-challenge?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  // If an authenticated admin user is found and MFA check passed, render the protected content.
  if (targetAal === 'aal2') { // MODIFIED: Admin user is AAL2 or AAL1 and no MFA enrolled
    console.log('AdminGuard: User is an admin and MFA check passed. Rendering protected content.');
    return <Outlet />;
  }

  // This should ideally not be reached
  console.warn('AdminGuard: Unexpected state. Redirecting to login.');
  return <Navigate to="/login" replace />;
};

export default AdminGuard;