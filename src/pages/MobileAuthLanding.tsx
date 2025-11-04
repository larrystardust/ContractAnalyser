import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import Card, { CardBody } from '../components/ui/Card';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '../components/ui/Button';

const MOBILE_AUTH_CONTEXT_KEY = 'mobile_auth_context';

const MobileAuthLanding: React.FC = () => {
  const supabase = useSupabaseClient();
  const session = useSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { t } = useTranslation();

  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
  const [message, setMessage] = useState<string>(t('mobile_auth_landing_processing_auth'));
  const [error, setError] = useState<string | null>(null);

  // Function to initiate mobile authentication via Edge Function
  const initiateMobileAuth = useCallback(async (scanSessionId: string, authToken: string) => {
    console.log('MobileAuthLanding: initiateMobileAuth called.');
    setMessage(t('mobile_auth_landing_initiating_auth'));
    try {
      const appBaseUrl = window.location.origin;
      const supabaseRedirectTarget = `${appBaseUrl}/`; // Supabase will redirect here with its tokens in hash

      console.log('MobileAuthLanding: Calling mobile-auth Edge Function with redirect_to_url:', supabaseRedirectTarget);
      const { data, error: invokeError } = await supabase.functions.invoke('mobile-auth', {
        body: {
          auth_token: authToken,
          redirect_to_url: supabaseRedirectTarget,
        },
      });

      if (invokeError) throw invokeError;
      if (!data?.redirectToUrl) throw new Error(t('mobile_auth_landing_failed_to_get_redirect_url'));

      console.log('MobileAuthLanding: Received magic link. Redirecting to:', data.redirectToUrl);
      window.location.replace(data.redirectToUrl);

    } catch (err: any) {
      console.error('MobileAuthLanding: Error during mobile authentication initiation:', err);
      setError(err.message || t('mobile_auth_landing_authentication_failed'));
      setStatus('error');
    }
  }, [supabase, t]);

  useEffect(() => {
    const handleAuthFlow = async () => {
      console.log('MobileAuthLanding: useEffect triggered.');
      console.log('MobileAuthLanding: Current URL:', window.location.href);
      console.log('MobileAuthLanding: searchParams:', searchParams.toString());
      console.log('MobileAuthLanding: location.hash:', location.hash);

      const queryScanSessionId = searchParams.get('scanSessionId');
      const queryAuthToken = searchParams.get('auth_token');
      const hashParams = new URLSearchParams(location.hash.substring(1));
      const supabaseAccessToken = hashParams.get('access_token');
      const supabaseRefreshToken = hashParams.get('refresh_token');

      // Scenario 1: Initial landing from QR code scan (has query params)
      if (queryScanSessionId && queryAuthToken) {
        console.log('MobileAuthLanding: Scenario 1 - Initial landing with query params.');
        setMessage(t('mobile_auth_landing_storing_context'));
        localStorage.setItem(MOBILE_AUTH_CONTEXT_KEY, JSON.stringify({
          scanSessionId: queryScanSessionId,
          authToken: queryAuthToken,
        }));
        console.log('MobileAuthLanding: Context stored in localStorage.');
        // REMOVED: navigate(location.pathname, { replace: true }); // This was the problematic line

        await initiateMobileAuth(queryScanSessionId, queryAuthToken);
        return; // Exit, as a redirect is pending
      }

      // Scenario 2: Redirect back from Supabase auth (has hash params, context in localStorage)
      const storedContext = localStorage.getItem(MOBILE_AUTH_CONTEXT_KEY);
      console.log('MobileAuthLanding: Stored context from localStorage:', storedContext);

      if (supabaseAccessToken && supabaseRefreshToken && storedContext) {
        console.log('MobileAuthLanding: Scenario 2 - Redirect back from Supabase auth.');
        setMessage(t('mobile_auth_landing_reconstructing_url'));
        try {
          const { scanSessionId: storedScanSessionId, authToken: storedAuthToken } = JSON.parse(storedContext);

          console.log('MobileAuthLanding: Setting Supabase session.');
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: supabaseAccessToken,
            refresh_token: supabaseRefreshToken,
          });

          if (sessionError) {
            throw sessionError;
          }

          console.log('MobileAuthLanding: Supabase session set. Clearing stored context.');
          localStorage.removeItem(MOBILE_AUTH_CONTEXT_KEY);

          const finalMobileCameraUrl = `/mobile-camera#scanSessionId=${storedScanSessionId}&auth_token=${storedAuthToken}&access_token=${supabaseAccessToken}&refresh_token=${supabaseRefreshToken}`;
          
          console.log('MobileAuthLanding: Final redirecting to MobileCameraApp:', finalMobileCameraUrl);
          navigate(finalMobileCameraUrl, { replace: true });
          setStatus('success');
          return;

        } catch (err: any) {
          console.error('MobileAuthLanding: Error processing Supabase redirect:', err);
          setError(err.message || t('mobile_auth_landing_processing_error'));
          setStatus('error');
          localStorage.removeItem(MOBILE_AUTH_CONTEXT_KEY); // Clean up on error
          return;
        }
      }

      // Scenario 3: User is already authenticated and lands here (e.g., direct navigation)
      if (session?.user?.id) {
        console.log('MobileAuthLanding: Scenario 3 - User already authenticated.');
        setMessage(t('mobile_auth_landing_already_authenticated'));
        navigate('/upload', { replace: true });
        setStatus('success');
        return;
      }

      // Fallback: If none of the above, something is wrong or user landed directly without context
      console.log('MobileAuthLanding: Fallback scenario hit. Invalid access.');
      setError(t('mobile_auth_landing_invalid_access'));
      setStatus('error');

    };

    handleAuthFlow();
  }, [location.hash, searchParams, session, supabase, navigate, initiateMobileAuth, t]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardBody className="text-center">
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">{message}</h2>
            <p className="text-gray-600">{t('mobile_auth_landing_please_wait')}</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardBody className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('mobile_auth_landing_error_title')}</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => navigate('/upload')} variant="primary">{t('back_to_upload')}</Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return null; // Should redirect before this renders in success case
};

export default MobileAuthLanding;