import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import Card, { CardBody } from '../components/ui/Card';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Database } from '../types/supabase';
import Button from '../components/ui/Button';
import { useTranslation } from 'react-i18next';

const AuthCallbackPage: React.FC = () => {
  console.log('AuthCallbackPage: Component is rendering.');

  const supabase = useSupabaseClient<Database>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { t, i18n } = useTranslation();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>(t('processing_authentication'));

  const processingRef = useRef(false); // To prevent multiple navigations

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
      console.log('AuthCallbackPage: Auth state change event:', event);
      console.log('AuthCallbackPage: Current Session object:', currentSession);

      // Prevent re-entry if we've already started processing a successful sign-in
      if (processingRef.current) {
        console.log('AuthCallbackPage: Already processing a successful sign-in, skipping this auth state change.');
        return;
      }

      // Handle INITIAL_SESSION with no currentSession - just log and wait for SIGNED_IN
      if (event === 'INITIAL_SESSION' && !currentSession) {
        console.warn('AuthCallbackPage: INITIAL_SESSION with no currentSession. Waiting for SIGNED_IN or explicit failure.');
        return;
      }

      // This is the definitive event for a successful login
      if (event === 'SIGNED_IN' && currentSession?.user?.email_confirmed_at) {
        console.log('AuthCallbackPage: Entering SIGNED_IN block for the first time.');
        processingRef.current = true; // Mark as processing successful sign-in
        console.log('AuthCallbackPage: processingRef.current set to true.');

        try {
          console.log('AuthCallbackPage: Starting try block.');
          // Update login_at for the user (non-blocking)
          console.log('AuthCallbackPage: Attempting to update login_at (non-blocking).');
          try {
            console.log('AuthCallbackPage: Before supabase.from("profiles").update({ login_at: ... }).');
            supabase
              .from('profiles')
              .update({ login_at: new Date().toISOString() })
              .eq('id', currentSession.user.id)
              .then(({ error: updateLoginError }) => {
                if (updateLoginError) {
                  console.error('AuthCallbackPage: Error updating login_at in background:', updateLoginError);
                } else {
                  console.log('AuthCallbackPage: login_at updated for user in background:', currentSession.user.id);
                }
              });
            console.log('AuthCallbackPage: login_at update initiated (non-blocking).');
          } catch (updateLoginError) {
            console.error('AuthCallbackPage: Sync error initiating login_at update:', updateLoginError);
          }
          console.log('AuthCallbackPage: Finished login_at update section (initiated).');

          // --- START: Language Preference Handling ---
          console.log('AuthCallbackPage: Starting language preference fetch.');
          const { data: profileDataForLanguage, error: profileLanguageError } = await supabase
            .from('profiles')
            .select('language_preference')
            .eq('id', currentSession.user.id)
            .maybeSingle();

          if (profileLanguageError) {
            console.error('AuthCallbackPage: Error fetching user language preference:', profileLanguageError);
          } else if (profileDataForLanguage?.language_preference && i18n.language !== profileDataForLanguage.language_preference) {
            console.log(`AuthCallbackPage: Changing language from ${i18n.language} to ${profileDataForLanguage.language_preference}`);
            await i18n.changeLanguage(profileDataForLanguage.language_preference);
            localStorage.setItem('i18nextLng', profileDataForLanguage.language_preference);
            // Also update dir attribute for RTL languages
            if (profileDataForLanguage.language_preference === 'ar') {
              document.documentElement.setAttribute('dir', 'rtl');
            } else {
              document.documentElement.setAttribute('dir', 'ltr');
            }
          }
          console.log('AuthCallbackPage: Finished language preference fetch.');
          // --- END: Language Preference Handling ---

          // Handle Invitation Acceptance (if token exists)
          console.log('AuthCallbackPage: Starting invitation token check.');
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
              setMessage(t('failed_to_accept_invitation', { message: inviteError.message }));
              processingRef.current = false;
              console.log('AuthCallbackPage: Calling navigate to /login due to invitation error.');
              navigate('/login', { replace: true });
              return; // Exit early after failed invitation and redirect
            } else {
              console.log('AuthCallbackPage: Invitation accepted successfully:', inviteData);
              setMessage(t('authentication_invitation_successful'));
              // After successful invitation acceptance, always redirect to the dashboard
              console.log('AuthCallbackPage: Calling navigate to /dashboard after invitation acceptance.');
              navigate('/dashboard', { replace: true });
              return; // Exit early after successful invitation and redirect
            }
          } else {
            setMessage(t('authentication_successful'));
          }
          console.log('AuthCallbackPage: Finished invitation token check.');

          console.log('AuthCallbackPage: Before setStatus(success)');
          setStatus('success');
          console.log('AuthCallbackPage: After setStatus(success). Current status state should be "success".');
          console.log('AuthCallbackPage: Attempting navigation based on admin status...');

          // If no invitation token was processed, determine where to redirect based on admin status
          console.log('AuthCallbackPage: Checking admin status for redirection.');
          const { data: profileData, error: profileCheckError } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', currentSession.user.id)
            .maybeSingle();

          if (profileCheckError) {
            console.error('AuthCallbackPage: Error checking admin status for redirection:', profileCheckError);
            console.log('AuthCallbackPage: Calling navigate to /dashboard (profileCheckError).');
            navigate('/dashboard', { replace: true });
          } else if (profileData?.is_admin) {
            console.log('AuthCallbackPage: Calling navigate to /admin (is_admin).');
            navigate('/admin', { replace: true });
          } else {
            console.log('AuthCallbackPage: Calling navigate to /dashboard (default).');
            navigate('/dashboard', { replace: true });
          }

        } catch (overallError: any) {
          console.error('AuthCallbackPage: Unexpected error during auth callback processing:', overallError);
          setStatus('error');
          setMessage(t('unexpected_error_occurred_auth', { message: overallError.message }));
          console.log('AuthCallbackPage: Calling navigate to /login due to overallError.');
          navigate('/login', { replace: true });
          processingRef.current = false; // Allow retry if user refreshes or tries again
        }
      } else if (event === 'SIGNED_OUT') {
        console.warn('AuthCallbackPage: User SIGNED_OUT during callback flow.');
        setStatus('error');
        setMessage(t('session_ended'));
        console.log('AuthCallbackPage: Calling navigate to /login due to SIGNED_OUT event.');
        navigate('/login', { replace: true });
        processingRef.current = false;
      } else if (event === 'SIGNED_IN' && !currentSession?.user?.email_confirmed_at) {
        console.warn('AuthCallbackPage: User SIGNED_IN but email not confirmed.');
        setStatus('error');
        setMessage(t('email_not_confirmed'));
        console.log('AuthCallbackPage: Calling navigate to /login because email not confirmed.');
        navigate('/login', { replace: true });
        processingRef.current = false;
      }
    });

    // Cleanup the listener when the component unmounts
    return () => {
      console.log('AuthCallbackPage: Cleaning up auth listener.');
      authListener.subscription?.unsubscribe();
      processingRef.current = false; // Reset flag on unmount
    };
  }, [navigate, supabase.auth, searchParams, location.hash, t, i18n]);

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <>
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('processing')}...</h2>
            <p className="text-gray-600">{message}</p>
          </>
        );
      case 'success':
        return (
          <>
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('success_message')}</h2>
            <p className="text-gray-600">{message}</p>
            <Link to="/login">
              <Button variant="primary" size="lg" className="w-full mb-4">
                {t('login_button')}
              </Button>
            </Link>
            <Link to="/">
              <Button variant="outline" size="lg" className="w-full">
                {t('return_to_home')}
              </Button>
            </Link>
          </>
        );
      case 'error':
        return (
          <>
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('error_message')}</h2>
            <p className="text-gray-600">{message}</p>
            <Link to="/login">
              <Button variant="primary" size="lg" className="w-full mb-4">
                {t('login_button')}
              </Button>
            </Link>
            <Link to="/">
              <Button variant="outline" size="lg" className="w-full">
                {t('return_to_home')}
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