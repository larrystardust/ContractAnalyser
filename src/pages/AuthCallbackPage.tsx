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

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('AuthCallbackPage: Auth state change event:', event);
      console.log('AuthCallbackPage: Current Session object:', currentSession);

      if (processingRef.current) { // Check at the very beginning to prevent re-entry
        console.log('AuthCallbackPage: Already processing a SIGNED_IN event, skipping this auth state change.');
        return;
      }

      // If INITIAL_SESSION or SIGNED_IN occurs but currentSession is null, it means something went wrong
      // and the session couldn't be established or re-hydrated.
      if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && !currentSession) {
        console.error('AuthCallbackPage: INITIAL_SESSION or SIGNED_IN event with no currentSession. Authentication failed.');
        setStatus('error');
        setMessage(t('auth_failed_no_session'));
        processingRef.current = false; // Allow re-processing if user tries again
        setTimeout(() => navigate('/login', { replace: true }), 100);
        console.log('AuthCallbackPage: Redirecting to /login due to no session.');
        return;
      }

      if (event === 'SIGNED_IN' && currentSession?.user?.email_confirmed_at) {
        console.log('AuthCallbackPage: Entering SIGNED_IN block for the first time.');
        processingRef.current = true; // Mark as processing
        console.log('AuthCallbackPage: processingRef.current set to true.');

        try {
          // --- START: Simplified Redirection Logic ---
          console.log('AuthCallbackPage: Session confirmed. Attempting direct navigation to /dashboard.');
          setStatus('success');
          setMessage(t('authentication_successful'));

          setTimeout(() => {
            console.log('AuthCallbackPage: Inside setTimeout callback. Executing navigate to /dashboard.');
            navigate('/dashboard', { replace: true });
            console.log('AuthCallbackPage: navigate() call completed.');
          }, 100);
          // --- END: Simplified Redirection Logic ---

        } catch (overallError: any) {
          console.error('AuthCallbackPage: Unexpected error during simplified auth callback processing:', overallError);
          setStatus('error');
          setMessage(t('unexpected_error_occurred_auth', { message: overallError.message }));
          setTimeout(() => navigate('/login', { replace: true }), 100);
          console.log('AuthCallbackPage: Redirecting to /login due to overallError in simplified flow.');
        } finally {
          // processingRef.current is kept true to prevent further processing in this instance
          // It will be reset on component unmount or if a new auth flow starts.
        }
      } else if (event === 'SIGNED_OUT') {
        console.warn('AuthCallbackPage: User SIGNED_OUT during callback flow.');
        setStatus('error');
        setMessage(t('session_ended'));
        setTimeout(() => navigate('/login', { replace: true }), 100);
        console.log('AuthCallbackPage: Redirecting to /login due to SIGNED_OUT event.');
      } else if (event === 'SIGNED_IN' && !currentSession?.user?.email_confirmed_at) {
        console.warn('AuthCallbackPage: User SIGNED_IN but email not confirmed.');
        setStatus('error');
        setMessage(t('email_not_confirmed'));
        setTimeout(() => navigate('/login', { replace: true }), 100);
        console.log('AuthCallbackPage: Redirecting to /login because email not confirmed.');
      }
    });

    // Cleanup the listener when the component unmounts
    return () => {
      console.log('AuthCallbackPage: Cleaning up auth listener.');
      authListener.subscription?.unsubscribe();
      processingRef.current = false; // Reset flag on unmount
    };
  }, [navigate, supabase.auth, t]); // Removed searchParams, location.hash, i18n for this simplified test

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