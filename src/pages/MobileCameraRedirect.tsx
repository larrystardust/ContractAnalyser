import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import Card, { CardBody } from '../components/ui/Card';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const MobileCameraRedirect: React.FC = () => {
  const supabase = useSupabaseClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();

  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [message, setMessage] = useState<string>(t('mobile_redirect_processing_authentication'));

  useEffect(() => {
    const handleRedirect = async () => {
      const hashParams = new URLSearchParams(location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const error = hashParams.get('error');
      const errorDescription = hashParams.get('error_description');

      const scanSessionId = searchParams.get('scanSessionId');
      const authToken = searchParams.get('auth_token');

      if (error) {
        console.error('MobileCameraRedirect: Error from Supabase redirect:', error, errorDescription);
        setStatus('error');
        setMessage(errorDescription || t('mobile_redirect_authentication_failed'));
        return;
      }

      if (accessToken && refreshToken) {
        try {
          // Set the session on the mobile device
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (setSessionError) throw setSessionError;

          setMessage(t('mobile_redirect_authentication_successful'));
          setStatus('loading'); // Keep loading until final redirect

          // Redirect to the MobileCameraApp with original scan session details
          if (scanSessionId && authToken) {
            navigate(`/mobile-camera?scanSessionId=${scanSessionId}&auth_token=${authToken}`, { replace: true });
          } else {
            // Fallback if scanSessionId or authToken are missing (shouldn't happen if flow is correct)
            navigate('/upload', { replace: true });
          }

        } catch (err: any) {
          console.error('MobileCameraRedirect: Error setting session:', err);
          setStatus('error');
          setMessage(err.message || t('mobile_redirect_failed_to_set_session'));
        }
      } else {
        setStatus('error');
        setMessage(t('mobile_redirect_no_tokens_found'));
      }
    };

    handleRedirect();
  }, [location.hash, navigate, supabase.auth, searchParams, t]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardBody className="text-center">
          {status === 'loading' ? (
            <>
              <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">{t('mobile_redirect_connecting')}...</h2>
              <p className="text-gray-600">{message}</p>
            </>
          ) : (
            <>
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">{t('mobile_redirect_error_title')}</h2>
              <p className="text-gray-600 mb-4">{message}</p>
              <Button onClick={() => navigate('/upload')} variant="primary">{t('back_to_upload')}</Button>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default MobileCameraRedirect;