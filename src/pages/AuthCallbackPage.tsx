import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import Card, { CardBody } from '../components/ui/Card';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Database } from '../types/supabase';
import Button from '../components/ui/Button'; // Ensure Button is imported

// Define constants for localStorage keys and expiry duration
const RECOVERY_FLAG = 'password_recovery_active';
const RECOVERY_EXPIRY = 'password_recovery_expiry';
const RECOVERY_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const AuthCallbackPage: React.FC = () => {
  console.log('AuthCallbackPage: Component is rendering.');

  const supabase = useSupabaseClient<Database>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('Processing authentication...');

  const processingRef = useRef(false);

  useEffect(() => {
    console.log('AuthCallbackPage: useEffect triggered.');
    console.log('AuthCallbackPage: Current URL hash:', window.location.hash);
    console.log('AuthCallbackPage: Current URL search:', window.location.search);

    let finalRedirectPath: string | null = null;
    let isPasswordResetFlow = false;

    // 1. Check for 'type=recovery' in the URL hash (for password reset)
    const hashParams = new URLSearchParams(location.hash.substring(1)); // Remove '#'
    const hashType = hashParams.get('type');
    if (hashType === 'recovery') {
      isPasswordResetFlow = true;
      finalRedirectPath = `/reset-password${location.hash}`; // Redirect to reset-password, preserving hash
      
      // CRITICAL: Set recovery flag in localStorage
      const expiryTime = Date.now() + RECOVERY_DURATION_MS;
      localStorage.setItem(RECOVERY_FLAG, 'true');
      localStorage.setItem(RECOVERY_EXPIRY, expiryTime.toString());
      console.log('AuthCallbackPage: Detected password reset flow. Recovery flag set in localStorage with expiry:', new Date(expiryTime).toISOString());

      console.log('AuthCallbackPage: Redirecting to:', finalRedirectPath);
      navigate(finalRedirectPath, { replace: true });
      return; // Exit early as we're redirecting
    }

    // 2. Try to get 'redirect' from query parameters (for general redirects from AuthGuard/AdminGuard)
    const queryRedirectParam = searchParams.get('redirect');
    if (queryRedirectParam) {
      finalRedirectPath = decodeURIComponent(queryRedirectParam);
      console.log('AuthCallbackPage: Found redirect in query params:', finalRedirectParam);
    }

    // 3. Also check for 'redirect_to' in the URL hash (common for Supabase email confirmations)
    // This takes precedence if found, as it's the direct instruction from Supabase.
    const hashRedirectTo = hashParams.get('redirect_to');
    if (hashRedirectTo) {
      finalRedirectPath = decodeURIComponent(hashRedirectTo);
      console.log('AuthCallbackPage: Found redirect_to in hash:', hashRedirectTo);
    }

    // Check if the finalRedirectPath contains an invitation token
    let invitationToken: string | null = null;
    if (finalRedirectPath) {
      try {
        const url = new URL(finalRedirectPath, window.location.origin); // Use origin as base for relative paths
        const tokenParam = url.searchParams.get('token');
        if (url.pathname === '/accept-invitation' && tokenParam) {
          invitationToken = tokenParam;
          console.log('AuthCallbackPage: Found invitation token in final redirect path:', invitationToken);
        }
      } catch (e) {
        console.error('AuthCallbackPage: Error parsing final redirect path URL for token:', e);
      }
    }

    // Listen for auth state changes to detect when the session is set by the redirect
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('AuthCallbackPage: Auth state change event:', event, 'Current Session:', currentSession);

      if (processingRef.current) {
        console.log('AuthCallbackPage: Already processing, skipping duplicate execution.');
        return;
      }

      // Only proceed if it's a SIGNED_IN event and not a password reset flow (which is handled above)
      if (event === 'SIGNED_IN' && currentSession?.user?.email_confirmed_at && !isPasswordResetFlow) {
        processingRef.current = true;

        console.log('AuthCallbackPage: User SIGNED_IN and email_confirmed_at is present. Attempting profile creation and invitation acceptance.');

        try {
          // 1. Create/Update User Profile
          const storedFullName = currentSession.user.user_metadata.full_name || null;
          const storedMobilePhoneNumber = currentSession.user.user_metadata.mobile_phone_number || null;
          const storedCountryCode = currentSession.user.user_metadata.country_code || null;
          const storedBusinessName = currentSession.user.user_metadata.business_name || null;

          console.log('AuthCallbackPage: Retrieved from user_metadata for profile:', {
            storedFullName,
            storedBusinessName,
            storedMobilePhoneNumber,
            storedCountryCode,
          });

          const { error: profileEdgeFunctionError } = await supabase.functions.invoke('create-user-profile', {
            body: {
              userId: currentSession.user.id,
              fullName: storedFullName,
              businessName: storedBusinessName,
              mobilePhoneNumber: storedMobilePhoneNumber,
              countryCode: storedCountryCode,
            },
          });

          if (profileEdgeFunctionError) {
            console.error('AuthCallbackPage: Error calling create-user-profile Edge Function:', profileEdgeFunctionError);
          } else {
            console.log('AuthCallbackPage: Profile created/updated successfully via Edge Function.');
            try {
              await supabase
                .from('profiles')
                .update({ login_at: new Date().toISOString() })
                .eq('id', currentSession.user.id);
              console.log('AuthCallbackPage: login_at updated for user:', currentSession.user.id);
            } catch (updateLoginError) {
              console.error('AuthCallbackPage: Error updating login_at:', updateLoginError);
            }
          }

          // 2. Handle Invitation Acceptance (if token exists)
          if (invitationToken) {
            console.log('AuthCallbackPage: Attempting to accept invitation with token:', invitationToken);
            const { data: inviteData, error: inviteError } = await supabase.functions.invoke('accept-invitation', {
              body: { invitation_token: invitationToken },
              headers: {
                'Authorization': `Bearer ${currentSession.access_token}`,
              },
            });

            if (inviteError) {
              console.error('AuthCallbackPage: Error accepting invitation:', inviteError);
              setStatus('error');
              setMessage(`Failed to accept invitation: ${inviteError.message}`);
              processingRef.current = false;
              navigate('/login', { replace: true });
              return;
            } else {
              console.log('AuthCallbackPage: Invitation accepted successfully:', inviteData);
              setMessage('Authentication and invitation successful! Redirecting...');
              // After successful invitation acceptance, always redirect to the dashboard
              navigate('/dashboard', { replace: true });
              return; // Exit early after successful invitation and redirect
            }
          } else {
            setMessage('Authentication successful! Redirecting...');
          }

          // CRITICAL: Clear recovery flag if this was a successful non-recovery login
          localStorage.removeItem(RECOVERY_FLAG);
          localStorage.removeItem(RECOVERY_EXPIRY);
          console.log('AuthCallbackPage: Non-recovery login successful. Recovery state cleared from localStorage.');

          setStatus('success');
          // If no invitation token was processed, determine where to redirect based on admin status
          const { data: profileData, error: profileCheckError } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', currentSession.user.id)
            .maybeSingle();

          if (profileCheckError) {
            console.error('Error checking admin status for redirection:', profileCheckError);
            navigate('/dashboard', { replace: true });
          } else if (profileData?.is_admin) {
            navigate('/admin', { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }


        } catch (overallError: any) {
          console.error('AuthCallbackPage: Unexpected error during auth callback processing:', overallError);
          setStatus('error');
          setMessage(`An unexpected error occurred: ${overallError.message}`);
          navigate('/login', { replace: true });
        } finally {
          processingRef.current = false;
        }
      } else if (event === 'SIGNED_OUT') {
        setStatus('error');
        setMessage('Your session has ended. Please log in again.');
        console.warn('AuthCallbackPage: User SIGNED_OUT during callback flow.');
        navigate('/login', { replace: true });
      } else if (event === 'INITIAL_SESSION' && !currentSession) {
        setStatus('error');
        setMessage('Authentication failed or no active session. Please sign up or try again.');
        console.warn('AuthCallbackPage: INITIAL_SESSION with no currentSession. Invalid state.');
        navigate('/login', { replace: true });
      } else if (event === 'SIGNED_IN' && !currentSession?.user?.email_confirmed_at) {
        setStatus('error');
        setMessage('Email not confirmed. Please check your email for a confirmation link.');
        console.warn('AuthCallbackPage: User SIGNED_IN but email not confirmed.');
        navigate('/login', { replace: true });
      }
    });

    // Cleanup the listener when the component unmounts
    return () => {
      console.log('AuthCallbackPage: Cleaning up auth listener.');
      authListener.subscription?.unsubscribe();
    };
  }, [navigate, supabase.auth, searchParams, location.hash]);

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <>
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Processing...</h2>
            <p className="text-gray-600">{message}</p>
          </>
        );
      case 'success':
        return (
          <>
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Success!</h2>
            <p className="text-gray-600">{message}</p>
            <Link to="/login">
              <Button variant="primary" size="lg" className="w-full mb-4">
                Log In
              </Button>
            </Link>
            <Link to="/">
              <Button variant="outline" size="lg" className="w-full">
                Return to Home
              </Button>
            </Link>
          </>
        );
      case 'error':
        return (
          <>
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Error!</h2>
            <p className="text-gray-600">{message}</p>
            <Link to="/login">
              <Button variant="primary" size="lg" className="w-full mb-4">
                Log In
              </Button>
            </Link>
            <Link to="/">
              <Button variant="outline" size="lg" className="w-full">
                Return to Home
              </Button>
            </Link>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <Card className="max-w-md w-full">
        <CardBody className="text-center">
          {renderContent()}
        </CardBody>
      </Card>
    </div>
  );
};

export default AuthCallbackPage;