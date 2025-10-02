import React, { useState } from 'react';
import ContractUpload from '../components/contracts/ContractUpload';
import { Loader2 } from 'lucide-react';
import { useUserProfile } from '../hooks/useUserProfile';
import { AlertTriangle } from 'lucide-react';
import { useAppSettings } from '../hooks/useAppSettings';
import { useTranslation } from 'react-i18next'; // ADDED: Import useTranslation

const UploadPage: React.FC = () => {
  // console.log('UploadPage component rendered'); // REMOVED
  const [isUploading, setIsUploading] = useState(false);
  const { defaultJurisdictions, loading: loadingUserProfile } = useUserProfile();
  const { settings: appSettings, loading: loadingAppSettings, error: appSettingsError } = useAppSettings();
  const { t } = useTranslation(); // ADDED: useTranslation hook

  const handleUploadStatusChange = (status: boolean) => {
    setIsUploading(status);
  };

  if (loadingUserProfile || loadingAppSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
        <p className="text-gray-500 mt-4">{t('loading_user_profile_settings')}</p> {/* MODIFIED */}
      </div>
    );
  }

  if (appSettingsError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('error_loading_settings')}</h2> {/* MODIFIED */}
          <p className="text-gray-600 mb-4">
            {t('problem_fetching_settings')} {/* MODIFIED */}
          </p>
          <p className="text-sm text-red-500">Error: {appSettingsError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('upload_new_contract')}</h1> {/* MODIFIED */}
      
      <div className="bg-yellow-50 border-l-4 border-yellow-300 text-yellow-800 p-4 mb-6" role="alert">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0" />
          <div>
            <p className="font-bold">{t('important_document_format')}</p> {/* MODIFIED */}
            <p className="text-sm">
              {t('ocr_limitation_message')} {/* MODIFIED */}
            </p>
          </div>
        </div>
      </div>

      <ContractUpload
        onUploadStatusChange={handleUploadStatusChange}
        defaultJurisdictions={defaultJurisdictions}
      />

      {isUploading && (
        <div className="fixed inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50">
          <div className="text-center">
            <Loader2 className="h-16 w-16 text-blue-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-700 text-lg">{t('uploading_processing_contract')}</p> {/* MODIFIED */}
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadPage;