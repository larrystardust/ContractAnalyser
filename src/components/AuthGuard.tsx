import React, { useEffect, useState } from 'react';
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'; // ADDED useNavigate
import { Database } from '../types/supabase';

interface AuthGuardProps {
  children: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { session, isLoading: loadingSession } = useSessionContext();
  const supabase = useSupabaseClient<Database>();
  const location = useLocation();
  const navigate = useNavigate(); // ADDED: Initialize useNavigate hook
  const [mfaCheckComplete, setMfaCheckComplete] = useState(false);

  useEffect(() => {
    const checkMfaStatus = async () => {
      if (loadingSession) return; // Wait for session to load

      if (!session?.user) {
        // No user session, redirect to login
        setMfaCheckComplete(true);
        return;
      }

      // If session is already aal2, or no MFA factors are enrolled, allow access
      if (session.aal === 'aal2') {
        setMfaCheckComplete(true);
        return;
      }

      // If aal1, check for MFA factors
      try {
        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) {
          console.error('AuthGuard: Error listing MFA factors:', factorsError);
          setMfaCheckComplete(true); // Allow access on error, but log it
          return;
        }

        if (factors.totp.length > 0) {
          // User has MFA enrolled but session is aal1, redirect to MFA challenge
          console.log('AuthGuard: User has MFA enrolled but session is aal1. Redirecting to MFA challenge.');
          navigate(`/mfa-challenge?redirect=${encodeURIComponent(location.pathname + location.search)}`);
        } else {
          // No MFA factors enrolled, allow access
          setMfaCheckComplete(true);
        }
      } catch (err) {
        console.error('AuthGuard: Unexpected error during MFA check:', err);
        setMfaCheckComplete(true); // Allow access on unexpected error
      }
    };

    checkMfaStatus();
  }, [session, loadingSession, supabase, location, navigate]); // `navigate` is now correctly a dependency

  // Show loading indicator while checking authentication and MFA status
  if (loadingSession || !mfaCheckComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  // If not loading and MFA check is complete, check if a user session exists.
  if (!session || !session.user) {
    console.log('AuthGuard: No active user session found. Redirecting to login page.');
    return <Navigate to="/login" replace />;
  }

  // If an authenticated user session is found and MFA check passed, render the protected content.
  console.log('AuthGuard: User is authenticated and MFA check passed. Rendering protected content.');
  return <Outlet />;
};

export default AuthGuard;