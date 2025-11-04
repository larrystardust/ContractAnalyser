import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import Card, { CardBody } from '../components/ui/Card';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '../components/ui/Button';
import { useSupabaseClient } from '@supabase/auth-helpers-react'; // ADDED: Import useSupabaseClient

const MobileCameraRedirect: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const supabase = useSupabaseClient(); // ADDED: Initialize supabase client
  const { t } = useTranslation();

  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const processRedirect = async () => {
      // Extract Supabase session tokens from hash
      const hashParams = new URLSearchParams(location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      // Extract custom parameters from query string
      const scanSessionId = searchParams.get('scanSessionId');
      const authToken = searchParams.get('auth_token');

      if (!accessToken || !refreshToken || !scanSessionId || !authToken) {
        setErrorMessage(t('mobile_redirect_missing_tokens'));
        setStatus('error');
        return;
      }

      try {
        // Set the Supabase session
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          throw sessionError;
        }

        // Construct the final URL for MobileCameraApp with all parameters in hash
        const finalMobileCameraUrl = `/mobile-camera#scanSessionId=${scanSessionId}&auth_token=${authToken}&access_token=${accessToken}&refresh_token=${refreshToken}`;
        
        console.log('MobileCameraRedirect: Redirecting to final MobileCameraApp URL:', finalMobileCameraUrl);
        navigate(finalMobileCameraUrl, { replace: true });

      } catch (err: any) {
        console.error('MobileCameraRedirect: Error processing redirect:', err);
        setErrorMessage(err.message || t('mobile_redirect_processing_error'));
        setStatus('error');
      }
    };

    processRedirect();
  }, [navigate, searchParams, location.hash, supabase.auth, t]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardBody className="text-center">
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('mobile_redirect_processing_auth')}</h2>
            <p className="text-gray-600">{t('mobile_redirect_please_wait')}</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardBody className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('mobile_redirect_error_title')}</h2>
          <p className="text-gray-600 mb-4">{errorMessage}</p>
          <Button onClick={() => navigate('/upload')} variant="primary">{t('back_to_upload')}</Button>
        </CardBody>
      </Card>
    </div>
  );
};

export default MobileCameraRedirect;