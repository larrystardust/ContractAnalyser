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

  const processingRef = useRef(false);
  const hashRef = useRef(location.hash);
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    console.log('AuthCallbackPage: useEffect triggered.');
    console.log('AuthCallbackPage: Initial URL hash:', hashRef.current);
    console.log('AuthCallbackPage: Current URL hash:', window.location.hash);
    console.log('AuthCallbackPage: Current URL search:', window.location.search);

    if (hasRedirectedRef.current) {
      console.log('AuthCallbackPage: Already redirected, skipping processing.');
      return;
    }

    let finalRedirectPath: string | null = null;

    const queryRedirectParam = searchParams.get('redirect');
    if (queryRedirectParam) {
      finalRedirectPath = decodeURIComponent(queryRedirectParam);
      console.log('AuthCallbackPage: Found redirect in query params:', finalRedirectPath);
    }

    const hashParams = new URLSearchParams(hashRef.current.substring(1));
    const hashRedirectTo = hashParams.get('redirect_to');
    if (hashRedirectTo) {
      finalRedirectPath = decodeURIComponent(hashRedirectTo);
      console.log('AuthCallbackPage: Found redirect_to in initial hash:', hashRedirectTo);
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

    const processHashTokens = async () => {
      if (hashRef.current && hashRef.current.includes('access_token')) {
        console.log('AuthCallbackPage: Processing tokens from hash');
        
        const hashParams = new URLSearchParams(hashRef.current.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');

        if (accessToken && refreshToken && type === 'recovery') {
          console.log('AuthCallbackPage: Password recovery tokens found');
          
          const { data: { session }, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error('AuthCallbackPage: Error setting session from hash tokens:', error);
            setStatus('error');
            setMessage('Failed to process reset link. Please request a new password reset.');
            return;
          }

          if (session) {
            console.log('AuthCallbackPage: Session set successfully from hash tokens');
            
            // Store session data in localStorage to persist across redirect
            localStorage.setItem('passwordResetSession', JSON.stringify({
              accessToken,
              refreshToken,
              timestamp: Date.now()
            }));
            
            hasRedirectedRef.current = true;
            navigate('/update-password', { 
              replace: true,
              state: { fromPasswordReset: true }
            });
            return;
          }
        }
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('AuthCallbackPage: Auth state change event:', event, 'Current Session:', currentSession);

      if (processingRef.current || hasRedirectedRef.current) {
        console.log('AuthCallbackPage: Already processing or redirected, skipping.');
        return;
      }

      if (event === 'PASSWORD_RECOVERY') {
        console.log('AuthCallbackPage: Password recovery event detected');
        processingRef.current = true;
        
        // Store session info for the UpdatePasswordPage
        if (currentSession) {
          localStorage.setItem('passwordResetSession', JSON.stringify({
            accessToken: currentSession.access_token,
            refreshToken: currentSession.refresh_token,
            timestamp: Date.now()
          }));
        }
        
        setStatus('success');
        setMessage('Password reset verified! Redirecting to update your password...');
        
        hasRedirectedRef.current = true;
        navigate('/update-password', { 
          replace: true,
          state: { fromPasswordReset: true }
        });
        processingRef.current = false;
        return;
      }

      if (event === 'SIGNED_IN' && currentSession) {
        processingRef.current = true;

        console.log('AuthCallbackPage: User SIGNED_IN. Attempting profile creation and invitation acceptance.');

        try {
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
              hasRedirectedRef.current = true;
              navigate('/dashboard', { replace: true });
              return;
            }
          } else {
            setMessage('Authentication successful! Redirecting...');
          }

          setStatus('success');
          
          if (currentSession.user.app_metadata.provider === 'email' && 
              currentSession.user.aud === 'authenticated' &&
              !currentSession.user.email_confirmed_at) {
            console.log('AuthCallbackPage: Password reset flow detected, redirecting to update-password');
            hasRedirectedRef.current = true;
            navigate('/update-password', { 
              replace: true,
              state: { fromPasswordReset: true }
            });
          } else if (finalRedirectPath) {
            hasRedirectedRef.current = true;
            navigate(finalRedirectPath, { replace: true });
          } else {
            const { data: profileData, error: profileCheckError } = await supabase
              .from('profiles')
              .select('is_admin')
              .eq('id', currentSession.user.id)
              .maybeSingle();

            if (profileCheckError) {
              console.error('Error checking admin status for redirection:', profileCheckError);
              hasRedirectedRef.current = true;
              navigate('/dashboard', { replace: true });
            } else if (profileData?.is_admin) {
              hasRedirectedRef.current = true;
              navigate('/admin', { replace: true });
            } else {
              hasRedirectedRef.current = true;
              navigate('/dashboard', { replace: true });
            }
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
      }
    });

    processHashTokens();

    const checkExistingSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && !hasRedirectedRef.current) {
          console.log('AuthCallbackPage: Existing session found:', session);
          hasRedirectedRef.current = true;
          navigate('/update-password', { 
            replace: true,
            state: { fromPasswordReset: true }
          });
        }
      } catch (error) {
        console.error('AuthCallbackPage: Error checking existing session:', error);
      }
    };

    checkExistingSession();

    return () => {
      console.log('AuthCallbackPage: Cleaning up auth listener.');
      authListener.subscription?.unsubscribe();
    };
  }, [navigate, supabase, searchParams, location.hash]);

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