import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import Card, { CardBody } from '../components/ui/Card';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Database } from '../types/supabase';
import Button from '../components/ui/Button';
import { useTranslation } from 'react-i18next';

const AuthCallbackPage: React.FC = () => {
  const supabase = useSupabaseClient<Database>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { t, i18n } = useTranslation();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>(t('processing_authentication'));

  const processingRef = useRef(false);
  const authListenerRef = useRef<any>(null);

  useEffect(() => {
    let finalRedirectPath: string | null = null;

    const queryRedirectParam = searchParams.get('redirect');
    if (queryRedirectParam) {
      finalRedirectPath = decodeURIComponent(queryRedirectParam);
    }

    const hashParams = new URLSearchParams(location.hash.substring(1));
    const hashRedirectTo = hashParams.get('redirect_to');
    if (hashRedirectTo) {
      finalRedirectPath = decodeURIComponent(hashRedirectTo);
    }

    let invitationToken: string | null = null;
    if (finalRedirectPath) {
      try {
        const url = new URL(finalRedirectPath, window.location.origin);
        const tokenParam = url.searchParams.get('token');
        if (url.pathname === '/accept-invitation' && tokenParam) {
          invitationToken = tokenParam;
        }
      } catch (e) {
        console.error('AuthCallbackPage: Error parsing final redirect path URL for token:', e);
      }
    }

    if (!authListenerRef.current) {
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
        if (processingRef.current) {
          return;
        }

        if (event === 'INITIAL_SESSION' && !currentSession) {
          return;
        }

        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && currentSession?.user?.email_confirmed_at) {
          processingRef.current = true;

          try {
            supabase
              .from('profiles')
              .update({ login_at: new Date().toISOString() })
              .eq('id', currentSession.user.id)
              .then(({ error: updateLoginError }) => {
                if (updateLoginError) {
                  console.error('AuthCallbackPage: Error updating login_at in background:', updateLoginError);
                }
              });

            supabase
              .from('profiles')
              .select('language_preference')
              .eq('id', currentSession.user.id)
              .maybeSingle()
              .then(({ data: profileDataForLanguage, error: profileLanguageError }) => {
                if (profileLanguageError) {
                  console.error('AuthCallbackPage: Error fetching user language preference in background:', profileLanguageError);
                } else if (profileDataForLanguage?.language_preference && i18n.language !== profileDataForLanguage.language_preference) {
                  i18n.changeLanguage(profileDataForLanguage.language_preference)
                    .then(() => {
                      localStorage.setItem('i18nextLng', profileDataForLanguage.language_preference);
                      if (profileDataForLanguage.language_preference === 'ar') {
                        document.documentElement.setAttribute('dir', 'rtl');
                      } else {
                        document.documentElement.setAttribute('dir', 'ltr');
                      }
                    })
                    .catch(langChangeError => {
                      console.error('AuthCallbackPage: Error changing i18n language in background:', langChangeError);
                    });
                }
              })
              .catch(fetchError => {
                console.error('AuthCallbackPage: Sync error initiating language preference fetch:', fetchError);
              });

            if (invitationToken) {
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
                navigate('/login', { replace: true });
                return;
              } else {
                setMessage(t('authentication_invitation_successful'));
                navigate('/dashboard', { replace: true });
                return;
              }
            } else {
              setMessage(t('authentication_successful'));
            }

            setStatus('success');

            const { data: profileData, error: profileCheckError } = await supabase
              .from('profiles')
              .select('is_admin')
              .eq('id', currentSession.user.id)
              .maybeSingle();

            if (profileCheckError) {
              console.error('AuthCallbackPage: Error checking admin status for redirection:', profileCheckError);
              navigate('/dashboard', { replace: true });
            } else if (profileData?.is_admin) {
              navigate('/admin', { replace: true });
            } else {
              navigate('/dashboard', { replace: true });
            }

          } catch (overallError: any) {
            console.error('AuthCallbackPage: Unexpected error during auth callback processing:', overallError);
            setStatus('error');
            setMessage(t('unexpected_error_occurred_auth', { message: overallError.message }));
            navigate('/login', { replace: true });
            processingRef.current = false;
          }
        } else if (event === 'SIGNED_OUT') {
          console.warn('AuthCallbackPage: User SIGNED_OUT during callback flow.');
          setStatus('error');
          setMessage(t('session_ended'));
          navigate('/login', { replace: true });
          processingRef.current = false;
        } else if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && !currentSession?.user?.email_confirmed_at) {
          console.warn('AuthCallbackPage: User SIGNED_IN/INITIAL_SESSION but email not confirmed.');
          setStatus('error');
          setMessage(t('email_not_confirmed'));
          navigate('/login', { replace: true });
          processingRef.current = false;
        }
      });
      authListenerRef.current = authListener.subscription;
    }

    return () => {
      if (authListenerRef.current) {
        authListenerRef.current.unsubscribe();
        authListenerRef.current = null;
      }
      processingRef.current = false;
    };
  }, [navigate, supabase.auth, t, i18n]);

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