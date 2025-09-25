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

    // Removed finalRedirectPath, invitationToken logic as it's not used in this simplified test

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
          // --- SIMPLIFIED LOGIC FOR TESTING NAVIGATION ---
          console.log('AuthCallbackPage: Session confirmed. Setting status to success and attempting direct navigation.');
          setStatus('success');
          setMessage(t('authentication_successful'));

          // Use a small timeout to ensure React state updates are processed before navigation
          setTimeout(() => {
            console.log('AuthCallbackPage: Inside setTimeout callback. Attempting navigate to /dashboard.');
            navigate('/dashboard', { replace: true });
            console.log('AuthCallbackPage: navigate() call executed.');
          }, 100);
          // --- END SIMPLIFIED LOGIC ---

        } catch (overallError: any) {
          console.error('AuthCallbackPage: Unexpected error during simplified auth callback processing:', overallError);
          setStatus('error');
          setMessage(t('unexpected_error_occurred_auth', { message: overallError.message }));
          setTimeout(() => navigate('/login', { replace: true }), 100);
          console.log('AuthCallbackPage: Redirecting to /login due to overallError in simplified flow.');
          processingRef.current = false; // Allow retry if user refreshes or tries again
        }
      } else if (event === 'SIGNED_OUT') {
        console.warn('AuthCallbackPage: User SIGNED_OUT during callback flow.');
        setStatus('error');
        setMessage(t('session_ended'));
        setTimeout(() => navigate('/login', { replace: true }), 100);
        console.log('AuthCallbackPage: Redirecting to /login due to SIGNED_OUT event.');
        processingRef.current = false;
      } else if (event === 'SIGNED_IN' && !currentSession?.user?.email_confirmed_at) {
        console.warn('AuthCallbackPage: User SIGNED_IN but email not confirmed.');
        setStatus('error');
        setMessage(t('email_not_confirmed'));
        setTimeout(() => navigate('/login', { replace: true }), 100);
        console.log('AuthCallbackPage: Redirecting to /login because email not confirmed.');
        processingRef.current = false;
      }
    });

    // Cleanup the listener when the component unmounts
    return () => {
      console.log('AuthCallbackPage: Cleaning up auth listener.');
      authListener.subscription?.unsubscribe();
      processingRef.current = false; // Reset flag on unmount
    };
  }, [navigate, supabase.auth, t]); // Removed searchParams, location.hash, i18n as they are not used in this simplified test

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