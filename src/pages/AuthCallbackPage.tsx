import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import Card, { CardBody } from '../components/ui/Card';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Database } from '../types/supabase';

const AuthCallbackPage: React.FC = () => {
  console.log('AuthCallbackPage: Component is rendering.');

  const supabase = useSupabaseClient<Database>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); // Keep for other potential query params
  const location = useLocation(); // ADDED: To access hash

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('Processing authentication...');

  const processingRef = useRef(false); // Ref to prevent multiple executions

  useEffect(() => {
    console.log('AuthCallbackPage: useEffect triggered.');
    console.log('AuthCallbackPage: Current URL hash:', window.location.hash);
    console.log('AuthCallbackPage: Current URL search:', window.location.search);

    let finalRedirectPath: string | null = null;

    // 1. Try to get 'redirect' from query parameters (for general redirects from AuthGuard/AdminGuard)
    const queryRedirectParam = searchParams.get('redirect');
    if (queryRedirectParam) {
      finalRedirectPath = decodeURIComponent(queryRedirectParam);
      console.log('AuthCallbackPage: Found redirect in query params:', finalRedirectPath);
    }

    // 2. Also check for 'redirect_to' in the URL hash (common for Supabase email confirmations)
    // This takes precedence if found, as it's the direct instruction from Supabase.
    const hashParams = new URLSearchParams(location.hash.substring(1)); // Remove '#'
    const hashRedirectTo = hashParams.get('redirect_to');
    if (hashRedirectTo) {
      finalRedirectPath = decodeURIComponent(hashRedirectTo);
      console.log('AuthCallbackPage: Found redirect_to in hash:', finalRedirectTo);
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

      if (event === 'SIGNED_IN' && currentSession?.user?.email_confirmed_at) {
        processingRef.current = true; // Set flag to true

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
              navigate('/login', { replace: true }); // MODIFIED: Direct navigate, removed setTimeout
              return;
            } else {
              console.log('AuthCallbackPage: Invitation accepted successfully:', inviteData);
              setMessage('Authentication and invitation successful! Redirecting...');
              // MODIFIED: Redirect directly to dashboard after successful invitation acceptance
              navigate('/dashboard', { replace: true });
              return; // Exit early after successful invitation and redirect
            }
          } else {
            setMessage('Authentication successful! Redirecting...');
          }

          setStatus('success');
          // Determine where to redirect based on finalRedirectPath or admin status
          if (finalRedirectPath) {
            console.log('AuthCallbackPage: Redirecting to final destination:', finalRedirectPath);
            navigate(finalRedirectPath);
          } else {
            const { data: profileData, error: profileCheckError } = await supabase
              .from('profiles')
              .select('is_admin')
              .eq('id', currentSession.user.id)
              .maybeSingle();

            if (profileCheckError) {
              console.error('Error checking admin status for redirection:', profileCheckError);
              navigate('/dashboard');
            } else if (profileData?.is_admin) {
              navigate('/admin');
            } else {
              navigate('/dashboard');
            }
          }

        } catch (overallError: any) {
          console.error('AuthCallbackPage: Unexpected error during auth callback processing:', overallError);
          setStatus('error');
          setMessage(`An unexpected error occurred: ${overallError.message}`);
          navigate('/login', { replace: true }); // MODIFIED: Direct navigate, removed setTimeout
        } finally {
          processingRef.current = false;
        }
      } else if (event === 'SIGNED_OUT') {
        setStatus('error');
        setMessage('Your session has ended. Please log in again.');
        console.warn('AuthCallbackPage: User SIGNED_OUT during callback flow.');
        navigate('/login', { replace: true }); // MODIFIED: Direct navigate, removed setTimeout
      } else if (event === 'INITIAL_SESSION' && !currentSession) {
        setStatus('error');
        setMessage('Authentication failed or no active session. Please sign up or try again.');
        console.warn('AuthCallbackPage: INITIAL_SESSION with no currentSession. Invalid state.');
        navigate('/login', { replace: true }); // MODIFIED: Direct navigate, removed setTimeout
      } else if (event === 'SIGNED_IN' && !currentSession?.user?.email_confirmed_at) {
        setStatus('error');
        setMessage('Email not confirmed. Please check your email for a confirmation link.');
        console.warn('AuthCallbackPage: User SIGNED_IN but email not confirmed.');
        navigate('/login', { replace: true }); // MODIFIED: Direct navigate, removed setTimeout
      }
    });

    // Cleanup the listener when the component unmounts
    return () => {
      console.log('AuthCallbackPage: Cleaning up auth listener.');
      authListener?.unsubscribe();
    };
  }, [navigate, supabase.auth, searchParams, location.hash]); // ADDED location.hash to dependencies

  const renderContent = () => {
    // ... (rest of the renderContent function remains the same)
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
            {/* The buttons below will still be visible for 3 seconds before redirection */}
            {/* Removed the automatic redirect, so these buttons are now relevant */}
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
            {/* The buttons below will still be visible for 3 seconds before redirection */}
            {/* Removed the automatic redirect, so these buttons are now relevant */}
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