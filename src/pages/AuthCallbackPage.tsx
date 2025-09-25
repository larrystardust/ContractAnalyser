import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import Card, { CardBody } from '../components/ui/Card';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Database } from '../types/supabase';
import Button from '../components/ui/Button';
import { useTranslation } from 'react-i18next'; // ADDED

const AuthCallbackPage: React.FC = () => {
  console.log('AuthCallbackPage: Component is rendering.');

  const supabase = useSupabaseClient<Database>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { t, i18n } = useTranslation(); // MODIFIED: Destructure i18n

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>(t('processing_authentication')); // MODIFIED

  const processingRef = useRef(false);

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
      console.log('AuthCallbackPage: Current Session object:', currentSession); // ADDED LOG

      if (event === 'SIGNED_IN' && currentSession?.user?.email_confirmed_at) {
        processingRef.current = true; // Set flag to true
        console.log('AuthCallbackPage: User SIGNED_IN and email_confirmed_at is present.');
        console.log('AuthCallbackPage: currentSession.user.email_confirmed_at:', currentSession.user.email_confirmed_at); // ADDED LOG

        try {
          // Update login_at for the user
          try {
            await supabase
              .from('profiles')
              .update({ login_at: new Date().toISOString() })
              .eq('id', currentSession.user.id);
            console.log('AuthCallbackPage: login_at updated for user:', currentSession.user.id);
          } catch (updateLoginError) {
            console.error('AuthCallbackPage: Error updating login_at:', updateLoginError);
          }

          // --- START: Language Preference Handling ---
          console.log('AuthCallbackPage: Fetching user language preference...');
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
          // --- END: Language Preference Handling ---

          // Original Redirection Logic (UNCOMMENTED)
          // Handle Invitation Acceptance (if token exists)
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
              setMessage(t('failed_to_accept_invitation', { message: inviteError.message })); // MODIFIED
              processingRef.current = false;
              navigate('/login', { replace: true });
              console.log('AuthCallbackPage: Redirecting to /login due to invitation error.'); // ADDED LOG
              return;
            } else {
              console.log('AuthCallbackPage: Invitation accepted successfully:', inviteData);
              setMessage(t('authentication_invitation_successful')); // MODIFIED
              // After successful invitation acceptance, always redirect to the dashboard
              navigate('/dashboard', { replace: true });
              console.log('AuthCallbackPage: Redirecting to /dashboard after invitation acceptance.'); // ADDED LOG
              return; // Exit early after successful invitation and redirect
            }
          } else {
            setMessage(t('authentication_successful')); // MODIFIED
          }

          setStatus('success');
          // If no invitation token was processed, determine where to redirect based on admin status
          const { data: profileData, error: profileCheckError } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', currentSession.user.id)
            .maybeSingle();

          if (profileCheckError) {
            console.error('AuthCallbackPage: Error checking admin status for redirection:', profileCheckError);
            navigate('/dashboard', { replace: true });
            console.log('AuthCallbackPage: Redirecting to /dashboard due to profileCheckError.'); // ADDED LOG
          } else if (profileData?.is_admin) {
            navigate('/admin', { replace: true });
            console.log('AuthCallbackPage: Redirecting to /admin.'); // ADDED LOG
          } else {
            navigate('/dashboard', { replace: true });
            console.log('AuthCallbackPage: Redirecting to /dashboard.'); // ADDED LOG
          }
          // END Original Redirection Logic

        } catch (overallError: any) {
          console.error('AuthCallbackPage: Unexpected error during auth callback processing:', overallError);
          setStatus('error');
          setMessage(t('unexpected_error_occurred_auth', { message: overallError.message })); // MODIFIED
          navigate('/login', { replace: true });
          console.log('AuthCallbackPage: Redirecting to /login due to overallError.'); // ADDED LOG
        } finally {
          processingRef.current = false;
        }
      } else if (event === 'SIGNED_OUT') {
        setStatus('error');
        setMessage(t('session_ended')); // MODIFIED
        console.warn('AuthCallbackPage: User SIGNED_OUT during callback flow.');
        navigate('/login', { replace: true });
        console.log('AuthCallbackPage: Redirecting to /login due to SIGNED_OUT event.'); // ADDED LOG
      } else if (event === 'INITIAL_SESSION' && !currentSession) {
        setStatus('error');
        setMessage(t('auth_failed_no_session')); // MODIFIED
        console.warn('AuthCallbackPage: INITIAL_SESSION with no currentSession. Invalid state.');
        navigate('/login', { replace: true });
        console.log('AuthCallbackPage: Redirecting to /login due to INITIAL_SESSION with no session.'); // ADDED LOG
      } else if (event === 'SIGNED_IN' && !currentSession?.user?.email_confirmed_at) {
        setStatus('error');
        setMessage(t('email_not_confirmed')); // MODIFIED
        console.warn('AuthCallbackPage: User SIGNED_IN but email not confirmed.');
        navigate('/login', { replace: true });
        console.log('AuthCallbackPage: Redirecting to /login because email not confirmed.'); // ADDED LOG
      }
    });

    // Cleanup the listener when the component unmounts
    return () => {
      console.log('AuthCallbackPage: Cleaning up auth listener.');
      // FIX: Correctly call unsubscribe on the subscription object
      authListener.subscription?.unsubscribe();
    };
  }, [navigate, supabase.auth, searchParams, location.hash, t, i18n]); // MODIFIED: Added i18n to dependency array

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <>
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('processing')}...</h2> {/* MODIFIED */}
            <p className="text-gray-600">{message}</p>
          </>
        );
      case 'success':
        return (
          <>
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('success_message')}</h2> {/* MODIFIED */}
            <p className="text-gray-600">{message}</p>
            {/* The buttons below will still be visible for 3 seconds before redirection */}
            {/* Removed the automatic redirect, so these buttons are now relevant */}
            <Link to="/login">
              <Button variant="primary" size="lg" className="w-full mb-4">
                {t('login_button')} {/* MODIFIED */}
              </Button>
            </Link>
            <Link to="/">
              <Button variant="outline" size="lg" className="w-full">
                {t('return_to_home')} {/* MODIFIED */}
              </Button>
            </Link>
          </>
        );
      case 'error':
        return (
          <>
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('error_message')}</h2> {/* MODIFIED */}
            <p className="text-gray-600">{message}</p>
            {/* The buttons below will still be visible for 3 seconds before redirection */}
            {/* Removed the automatic redirect, so these buttons are now relevant */}
            <Link to="/login">
              <Button variant="primary" size="lg" className="w-full mb-4">
                {t('login_button')} {/* MODIFIED */}
              </Button>
            </Link>
            <Link to="/">
              <Button variant="outline" size="lg" className="w-full">
                {t('return_to_home')} {/* MODIFIED */}
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