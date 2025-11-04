import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Card, { CardBody } from '../components/ui/Card';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '../components/ui/Button'; // ADDED: Import Button

const AuthRedirectHandler: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();

  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleRedirect = () => {
      const targetUrlParam = searchParams.get('target_url');
      const supabaseHash = location.hash.substring(1); // Get Supabase tokens from hash

      if (!targetUrlParam) {
        setErrorMessage(t('auth_redirect_handler_missing_target_url'));
        setStatus('error');
        return;
      }

      try {
        const decodedTargetUrl = decodeURIComponent(targetUrlParam);
        const targetUrl = new URL(decodedTargetUrl);

        // Append Supabase hash parameters to the target URL's hash
        if (supabaseHash) {
          if (targetUrl.hash) {
            targetUrl.hash += `&${supabaseHash}`;
          } else {
            targetUrl.hash = supabaseHash;
          }
        }

        console.log('AuthRedirectHandler: Final redirecting to:', targetUrl.toString());
        window.location.replace(targetUrl.toString());
      } catch (err: any) {
        console.error('AuthRedirectHandler: Error processing redirect:', err);
        setErrorMessage(err.message || t('auth_redirect_handler_processing_error'));
        setStatus('error');
      }
    };

    handleRedirect();
  }, [location.hash, searchParams, navigate, t]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardBody className="text-center">
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('auth_redirect_handler_processing_auth')}</h2>
            <p className="text-gray-600">{t('auth_redirect_handler_please_wait')}</p>
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
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('auth_redirect_handler_error_title')}</h2>
          <p className="text-gray-600 mb-4">{errorMessage}</p>
          <Button onClick={() => navigate('/upload')} variant="primary">{t('back_to_upload')}</Button>
        </CardBody>
      </Card>
    </div>
  );
};

export default AuthRedirectHandler;