import React, { useState, useEffect, useRef } from 'react';
import ContractUpload from '../components/contracts/ContractUpload';
import CameraCapture from '../components/CameraCapture';
import { Loader2, AlertTriangle, Camera, FileText } from 'lucide-react'; // Removed UploadIcon, X as they are not used directly here
import { useUserProfile } from '../hooks/useUserProfile';
import { useAppSettings } from '../hooks/useAppSettings';
import { useTranslation } from 'react-i18next';
import { useUserOrders } from '../hooks/useUserOrders';
import { useSubscription } from '../hooks/useSubscription';
import { Link } from 'react-router-dom';

// Define the structure for a captured image
interface CapturedImage {
  id: string;
  data: string; // Base64 string
}

const UploadPage: React.FC = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [capturedImages, setCapturedImages] = useState<File[]>([]); // MODIFIED: Array of File objects
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { defaultJurisdictions, loading: loadingUserProfile } = useUserProfile();
  const { settings: appSettings, loading: loadingAppSettings, error: appSettingsError } = useAppSettings();
  const { t } = useTranslation();
  const { getTotalSingleUseCredits, loading: loadingOrders } = useUserOrders();
  const { subscription, loading: loadingSubscription, totalSubscriptionFiles } = useSubscription();

  useEffect(() => {
    console.log('UploadPage: isUploading state changed to:', isUploading);
  }, [isUploading]);

  const OCR_COST = 3;
  const BASIC_ANALYSIS_COST = 1; // MODIFIED: Renamed for clarity
  const ADVANCED_ANALYSIS_ADDON_COST = 1; // ADDED: New constant for advanced feature cost

  // MODIFIED: Update cost calculations to include advanced addon
  const OCR_AND_BASIC_ANALYSIS_COST = OCR_COST + BASIC_ANALYSIS_COST;
  const OCR_BASIC_AND_ADVANCED_ANALYSIS_COST = OCR_COST + BASIC_ANALYSIS_COST + ADVANCED_ANALYSIS_ADDON_COST;
  const BASIC_AND_ADVANCED_ANALYSIS_COST = BASIC_ANALYSIS_COST + ADVANCED_ANALYSIS_ADDON_COST;


  const availableCredits = getTotalSingleUseCredits();
  const hasSubscription = subscription && (subscription.status === 'active' || subscription.status === 'trialing');
  const maxAllowedFiles = subscription?.max_files || Infinity;
  const hasSubscriptionFileCapacity = hasSubscription && totalSubscriptionFiles !== null && totalSubscriptionFiles < maxAllowedFiles;

  // MODIFIED: Update credit checks for new costs
  const canPerformOcr = hasSubscription || availableCredits >= OCR_COST;
  const canPerformBasicAnalysis = hasSubscription || availableCredits >= BASIC_ANALYSIS_COST;
  const canPerformAdvancedAddon = hasSubscription || availableCredits >= ADVANCED_ANALYSIS_ADDON_COST; // Check for the addon cost itself

  // ADDED: Determine if processing options should be shown
  const showProcessingOptions = !hasSubscription;

  const handleUploadStatusChange = (status: boolean) => {
    setIsUploading(status);
  };

  // MODIFIED: handleAddCapturedImage now accepts a File object
  const handleAddCapturedImage = (imageFile: File) => {
    setSelectedFiles(prev => [...prev, imageFile]); // ADDED: Add captured image to selectedFiles
    setCapturedImages(prev => [...prev, imageFile]); // Keep capturedImages state for reordering/display
  };

  const handleDoneCapturing = () => {
    setIsCameraMode(false);
  };

  const handleCancelCamera = () => {
    setIsCameraMode(false);
    setCapturedImages([]); // Clear captured images on cancel
    setSelectedFiles(prev => prev.filter(file => !file.name.startsWith('scanned_image_'))); // Remove scanned images from selectedFiles
  };

  // MODIFIED: removeCapturedImage now filters by file name
  const removeCapturedImage = (fileNameToRemove: string) => {
    setCapturedImages(prev => prev.filter(file => file.name !== fileNameToRemove));
    setSelectedFiles(prev => prev.filter(file => file.name !== fileNameToRemove));
  };

  const removeSelectedFile = (indexToRemove: number) => {
    setSelectedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
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
            {/* MODIFIED: Update credit warning message */}
            {!hasSubscription && availableCredits < OCR_BASIC_AND_ADVANCED_ANALYSIS_COST && (
              <p className="text-sm mt-2">
                {t('not_enough_credits_for_ocr_analysis', { cost: OCR_BASIC_AND_ADVANCED_ANALYSIS_COST })} <Link to="/pricing" className="font-medium underline">{t('pricing_page')}</Link>.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Mode Toggle Buttons */}
      <div className="flex space-x-4 mb-6">
        <Button
          variant={isCameraMode ? 'secondary' : 'primary'} // MODIFIED: Make prominent when active
          onClick={() => { setIsCameraMode(true); setSelectedFiles([]); }} // Clear selected files when switching to camera
          icon={<Camera className="w-4 h-4" />}
          disabled={isUploading || !canPerformOcr} // Disable camera if not enough credits for OCR
        >
          {t('scan_document')}
        </Button>
      </div>

      {isCameraMode ? (
        <CameraCapture
          onAddImage={handleAddCapturedImage}
          onDoneCapturing={handleDoneCapturing}
          onCancel={handleCancelCamera}
          isLoading={isUploading}
          capturedImages={capturedImages}
          removeCapturedImage={removeCapturedImage}
        />
      ) : (
        <ContractUpload
          onUploadStatusChange={handleUploadStatusChange}
          defaultJurisdictions={defaultJurisdictions}
          capturedImages={capturedImages}
          setCapturedImages={setCapturedImages}
          selectedFiles={selectedFiles}
          setSelectedFiles={setSelectedFiles}
          // MODIFIED: Pass new credit costs and checks
          canPerformOcr={canPerformOcr}
          canPerformBasicAnalysis={canPerformBasicAnalysis}
          canPerformAdvancedAddon={canPerformAdvancedAddon}
          ocrCost={OCR_COST}
          basicAnalysisCost={BASIC_ANALYSIS_COST}
          advancedAnalysisAddonCost={ADVANCED_ANALYSIS_ADDON_COST}
          showProcessingOptions={showProcessingOptions} // ADDED: Pass the new prop
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