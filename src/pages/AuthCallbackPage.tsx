import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import Card, { CardBody } from '../components/ui/Card';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Button from '../components/ui/Button';
import { Database } from '../types/supabase';

const AuthCallbackPage: React.FC = () => {
  console.log('AuthCallbackPage: Component is rendering.');

  const supabase = useSupabaseClient<Database>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('Processing authentication...');

  // Capture the initial hash from location.hash once
  const initialHashRef = useRef(location.hash);

  useEffect(() => {
    console.log('AuthCallbackPage: useEffect triggered.');
    console.log('AuthCallbackPage: Initial URL hash (captured):', initialHashRef.current);
    console.log('AuthCallbackPage: Current URL hash (live):', window.location.hash);
    console.log('AuthCallbackPage: Current URL search:', window.location.search);

    let finalRedirectPath: string | null = null;

    // 1. Get 'redirect' from query parameters (e.g., from signup flow)
    const queryRedirectParam = searchParams.get('redirect');
    if (queryRedirectParam) {
      finalRedirectPath = decodeURIComponent(queryRedirectParam);
      console.log('AuthCallbackPage: Found redirect in query params:', finalRedirectPath);
    }

    // 2. Parse tokens and redirect_to from the captured initial hash
    const hashParams = new URLSearchParams(initialHashRef.current.substring(1));
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const tokenType = hashParams.get('token_type');
    const type = hashParams.get('type'); // e.g., 'recovery' for password reset

    if (hashParams.get('redirect_to')) { // Use hashParams for redirect_to
      finalRedirectPath = decodeURIComponent(hashParams.get('redirect_to')!);
      console.log('AuthCallbackPage: Found redirect_to in initial hash:', finalRedirectPath);
    }

    let invitationToken: string | null = null;
    if (finalRedirectPath) {
      try {
        const url = new URL(finalRedirectPath, window.location.origin);
        const tokenParam = url.searchParams.get('token');
        if (url.pathname === '/accept-invitation' && tokenParam) {
          invitationToken = tokenParam;
          console.log('AuthCallbackPage: Found invitation token in final redirect path:', invitationToken);
        }
      } catch (e) {
        console.error('AuthCallbackPage: Error parsing final redirect path URL for token:', e);
      }
    }

    // Proactively set session if tokens are present in the hash.
    // This will trigger the onAuthStateChange listener.
    if (accessToken && refreshToken && tokenType) {
      console.log('AuthCallbackPage: Tokens found in hash. Attempting to set session proactively.');
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      }).then(({ data: { session: newSession }, error: setSessionError }) => {
        if (setSessionError) {
          console.error('AuthCallbackPage: Error setting session proactively:', setSessionError);
          setStatus('error');
          setMessage('Failed to process authentication. Please try again.');
        } else if (newSession) {
          console.log('AuthCallbackPage: Session successfully set proactively.');
          // The onAuthStateChange listener will now handle the rest.
        }
      });
    } else {
      console.log('AuthCallbackPage: No tokens found in hash. Waiting for onAuthStateChange events.');
    }

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('AuthCallbackPage: Auth state change event:', event, 'Current Session:', currentSession);

      // Handle PASSWORD_RECOVERY event (specific for password reset flow)
      if (event === 'PASSWORD_RECOVERY' && currentSession) {
        console.log('AuthCallbackPage: Password recovery event detected. Redirecting to update password.');
        setStatus('success');
        setMessage('Password reset verified! Redirecting to update your password...');
        navigate('/update-password', { replace: true });
        return; // Exit early after handling
      }

      // Handle SIGNED_IN event (general sign-in, including email confirmation)
      if (event === 'SIGNED_IN' && currentSession) {
        console.log('AuthCallbackPage: User SIGNED_IN. Proceeding with profile creation/update and invitation.');

        try {
          // 1. Create/Update User Profile (using Edge Function for server-side logic)
          const storedFullName = currentSession.user.user_metadata.full_name || null;
          const storedMobilePhoneNumber = currentSession.user.user_metadata.mobile_phone_number || null;
          const storedCountryCode = currentSession.user.user_metadata.country_code || null;
          const storedBusinessName = currentSession.user.user_metadata.business_name || null;

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
              navigate('/login', { replace: true });
              return;
            } else {
              console.log('AuthCallbackPage: Invitation accepted successfully:', inviteData);
              setMessage('Authentication and invitation successful! Redirecting...');
              navigate('/dashboard', { replace: true });
              return;
            }
          } else {
            setMessage('Authentication successful! Redirecting...');
          }

          setStatus('success');
          
          // Determine final redirect path
          if (finalRedirectPath) {
            navigate(finalRedirectPath, { replace: true });
          } else {
            // Default redirect based on admin status
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
          }

        } catch (overallError: any) {
          console.error('AuthCallbackPage: Unexpected error during auth callback processing:', overallError);
          setStatus('error');
          setMessage(`An unexpected error occurred: ${overallError.message}`);
          navigate('/login', { replace: true });
        }
      } else if (event === 'SIGNED_OUT') {
        setStatus('error');
        setMessage('Your session has ended. Please log in again.');
        console.warn('AuthCallbackPage: User SIGNED_OUT during callback flow.');
        navigate('/login', { replace: true });
      } else if (event === 'INITIAL_SESSION' && !currentSession) {
        // This happens when the page loads and no session is found (e.g., invalid link, expired session)
        setStatus('error');
        setMessage('Authentication failed or no active session. Please sign up or try again.');
        console.warn('AuthCallbackPage: INITIAL_SESSION with no currentSession. Invalid state.');
        navigate('/login', { replace: true });
      }
    });

    // Cleanup the listener when the component unmounts
    return () => {
      console.log('AuthCallbackPage: Cleaning up auth listener.');
      authListener.subscription?.unsubscribe();
    };
  }, [navigate, supabase, searchParams, location.hash]); // location.hash is important here for initial hash processing

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