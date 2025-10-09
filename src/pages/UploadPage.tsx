import React, { useState, useEffect } from 'react';
import ContractUpload from '../components/contracts/ContractUpload';
import CameraCapture from '../components/CameraCapture'; // ADDED
import { Loader2, AlertTriangle, Camera, FileText } from 'lucide-react'; // MODIFIED: Added Camera, FileText
import { useUserProfile } from '../hooks/useUserProfile';
import { useAppSettings } from '../hooks/useAppSettings';
import { useTranslation } from 'react-i18next';
import { useUserOrders } from '../hooks/useUserOrders'; // ADDED
import { useSubscription } from '../hooks/useSubscription'; // ADDED
import { Link } from 'react-router-dom'; // ADDED
import Button from '../components/ui/Button'; // ADDED

const UploadPage: React.FC = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [isCameraMode, setIsCameraMode] = useState(false); // ADDED: State to toggle camera mode
  const [capturedImageData, setCapturedImageData] = useState<string | null>(null); // ADDED: State for captured image
  const { defaultJurisdictions, loading: loadingUserProfile } = useUserProfile();
  const { settings: appSettings, loading: loadingAppSettings, error: appSettingsError } = useAppSettings();
  const { t } = useTranslation();
  const { getTotalSingleUseCredits, loading: loadingOrders } = useUserOrders(); // ADDED
  const { subscription, loading: loadingSubscription, totalSubscriptionFiles } = useSubscription(); // ADDED

  const OCR_COST = 3;
  const ANALYSIS_COST = 1;
  const OCR_AND_ANALYSIS_COST = OCR_COST + ANALYSIS_COST;

  const availableCredits = getTotalSingleUseCredits();
  const hasSubscription = subscription && (subscription.status === 'active' || subscription.status === 'trialing');
  const maxAllowedFiles = subscription?.max_files || Infinity;
  const hasSubscriptionFileCapacity = hasSubscription && totalSubscriptionFiles !== null && totalSubscriptionFiles < maxAllowedFiles;

  // Determine if OCR is possible (either via subscription or enough single-use credits)
  const canPerformOcr = hasSubscription || availableCredits >= OCR_COST;
  // Determine if analysis is possible (either via subscription or enough single-use credits)
  const canPerformAnalysis = hasSubscription || availableCredits >= ANALYSIS_COST;
  // Determine if OCR + Analysis is possible
  const canPerformOcrAndAnalysis = hasSubscription || availableCredits >= OCR_AND_ANALYSIS_COST;

  const handleUploadStatusChange = (status: boolean) => {
    setIsUploading(status);
  };

  const handleCapturedImage = (imageData: string | null) => {
    setCapturedImageData(imageData);
    if (imageData) {
      // If image is captured, switch back to file upload view to proceed with upload form
      setIsCameraMode(false);
    }
  };

  const handleCancelCamera = () => {
    setIsCameraMode(false);
    setCapturedImageData(null);
  };

  if (loadingUserProfile || loadingAppSettings || loadingOrders || loadingSubscription) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
        <p className="text-gray-500 mt-4">{t('loading_user_profile_settings')}</p>
      </div>
    );
  }

  if (appSettingsError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('error_loading_settings')}</h2>
          <p className="text-gray-600 mb-4">
            {t('problem_fetching_settings')}
          </p>
          <p className="text-sm text-red-500">Error: {appSettingsError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('upload_new_contract')}</h1>
      
      <div className="bg-yellow-50 border-l-4 border-yellow-300 text-yellow-800 p-4 mb-6" role="alert">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0" />
          <div>
            <p className="font-bold">{t('important_document_format')}</p>
            <p className="text-sm">
              {t('ocr_limitation_message')}
            </p>
          </div>
        </div>
      </div>

      {/* Credit/Subscription Status Display */}
      <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-700 p-4 mb-6" role="alert">
        <div className="flex items-center">
          <FileText className="h-5 w-5 mr-3 flex-shrink-0" />
          <div>
            {hasSubscription ? (
              <>
                <p className="font-bold">{t('active_subscription')}</p>
                <p className="text-sm">
                  {subscription?.max_files === 999999 ? t('unlimited_files_message') : t('subscription_files_remaining', { count: (maxAllowedFiles - (totalSubscriptionFiles || 0)), maxFiles: maxAllowedFiles, totalUploaded: (totalSubscriptionFiles || 0) })}
                </p>
              </>
            ) : (
              <>
                <p className="font-bold">{t('single_use_credits_available')}</p>
                <p className="text-sm">{t('credits_remaining_message', { count: availableCredits })}</p>
              </>
            )}
            {!hasSubscription && availableCredits < OCR_AND_ANALYSIS_COST && (
              <p className="text-sm mt-2">
                {t('not_enough_credits_for_ocr_analysis', { cost: OCR_AND_ANALYSIS_COST })} <Link to="/pricing" className="font-medium underline">{t('pricing_page')}</Link>.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Mode Toggle Buttons */}
      <div className="flex space-x-4 mb-6">
        <Button
          variant={!isCameraMode ? 'primary' : 'secondary'}
          onClick={() => { setIsCameraMode(false); setCapturedImageData(null); }}
          icon={<FileText className="w-4 h-4" />}
          disabled={isUploading}
        >
          {t('upload_file')}
        </Button>
        <Button
          variant={isCameraMode ? 'primary' : 'secondary'}
          onClick={() => setIsCameraMode(true)}
          icon={<Camera className="w-4 h-4" />}
          disabled={isUploading || !canPerformOcr} // Disable camera if not enough credits for OCR
        >
          {t('scan_document')}
        </Button>
      </div>

      {isCameraMode ? (
        <CameraCapture
          onCapture={handleCapturedImage}
          onCancel={handleCancelCamera}
          isLoading={isUploading}
        />
      ) : (
        <ContractUpload
          onUploadStatusChange={handleUploadStatusChange}
          defaultJurisdictions={defaultJurisdictions}
          capturedImageData={capturedImageData} // Pass captured image data
          setCapturedImageData={setCapturedImageData} // Allow ContractUpload to clear it
          canPerformOcrAndAnalysis={canPerformOcrAndAnalysis} // Pass credit status
          canPerformOcr={canPerformOcr} // Pass credit status
          canPerformAnalysis={canPerformAnalysis} // Pass credit status
          ocrCost={OCR_COST} // Pass costs
          analysisCost={ANALYSIS_COST} // Pass costs
        />
      )}

      {isUploading && (
        <div className="fixed inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50">
          <div className="text-center">
            <Loader2 className="h-16 w-16 text-blue-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-700 text-lg">{t('uploading_processing_contract')}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadPage;