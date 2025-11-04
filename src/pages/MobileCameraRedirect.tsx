import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card, { CardBody } from '../components/ui/Card';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '../components/ui/Button';

const MobileCameraRedirect: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    // This page is no longer actively used in the mobile camera authentication flow.
    // It now serves as a fallback redirect to the upload page.
    console.log('MobileCameraRedirect: Deprecated page accessed. Redirecting to /upload.');
    navigate('/upload', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardBody className="text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('mobile_redirect_deprecated_title')}</h2>
          <p className="text-gray-600 mb-4">{t('mobile_redirect_deprecated_message')}</p>
          <Button onClick={() => navigate('/upload')} variant="primary">{t('back_to_upload')}</Button>
        </CardBody>
      </Card>
    </div>
  );
};

export default MobileCameraRedirect;