import React, { useState, useEffect, useRef } from 'react';
import ContractUpload from '../components/contracts/ContractUpload';
import CameraCapture from '../components/CameraCapture';
import { Loader2, AlertTriangle, Camera, FileText, Smartphone } from 'lucide-react'; // MODIFIED: Added Smartphone icon
import { useUserProfile } from '../hooks/useUserProfile';
import { useAppSettings } from '../hooks/useAppSettings';
import { useTranslation } from 'react-i18next';
import { useUserOrders } from '../hooks/useUserOrders';
import { useSubscription } from '../hooks/useSubscription';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal'; // ADDED: Import Modal
import { useIsMobile } from '../hooks/useIsMobile'; // ADDED: Import useIsMobile
import QRCode from 'qrcode.react'; // ADDED: Import QRCode

// Define the structure for a captured image
interface CapturedImage {
  id: string;
  data: string; // Base64 string
}

const UploadPage: React.FC = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [capturedImages, setCapturedImages] = useState<File[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { defaultJurisdictions, loading: loadingUserProfile } = useUserProfile();
  const { settings: appSettings, loading: loadingAppSettings, error: appSettingsError } = useAppSettings();
  const { t } = useTranslation();
  const { getTotalSingleUseCredits, loading: loadingOrders } = useUserOrders();
  const { subscription, loading: loadingSubscription, totalSubscriptionFiles } = useSubscription();
  const isMobileDevice = useIsMobile(); // ADDED: Use the useIsMobile hook
  const [showScanOptionModal, setShowScanOptionModal] = useState(false); // ADDED: State for the new modal
  const [showQrCode, setShowQrCode] = useState(false); // ADDED: State to show QR code

  useEffect(() => {
    console.log('UploadPage: isUploading state changed to:', isUploading);
  }, [isUploading]);

  const OCR_COST = 3;
  const BASIC_ANALYSIS_COST = 1;
  const ADVANCED_ANALYSIS_ADDON_COST = 1;


  const availableCredits = getTotalSingleUseCredits();
  const hasSubscription = subscription && (subscription.status === 'active' || subscription.status === 'trialing');
  const maxAllowedFiles = subscription?.max_files || Infinity;
  const hasSubscriptionFileCapacity = hasSubscription && totalSubscriptionFiles !== null && totalSubscriptionFiles < maxAllowedFiles;

  const isAdvancedSubscription = subscription && (subscription.tier === 4 || subscription.tier === 5);
  const isBasicSubscription = subscription && (subscription.tier === 2 || subscription.tier === 3);

  const canPerformOcr = isAdvancedSubscription || isBasicSubscription || availableCredits >= OCR_COST;
  const canPerformBasicAnalysis = isAdvancedSubscription || isBasicSubscription || availableCredits >= BASIC_ANALYSIS_COST;
  const canPerformAdvancedAddon = isAdvancedSubscription || availableCredits >= ADVANCED_ANALYSIS_ADDON_COST;

  // MODIFIED: showProcessingOptions should be true for single-use users only.
  // For basic/admin-assigned, a separate section will be shown. For advanced, nothing.
  const showProcessingOptions = !isBasicSubscription && !isAdvancedSubscription;


  const handleUploadStatusChange = (status: boolean) => {
    setIsUploading(status);
  };

  const handleAddCapturedImage = (imageFile: File) => {
    setSelectedFiles(prev => [...prev, imageFile]);
    setCapturedImages(prev => [...prev, imageFile]);
  };

  const handleDoneCapturing = () => {
    setIsCameraMode(false);
  };

  const handleCancelCamera = () => {
    setIsCameraMode(false);
    setCapturedImages([]);
    setSelectedFiles(prev => prev.filter(file => !file.name.startsWith('scanned_image_')));
  };

  const removeCapturedImage = (fileNameToRemove: string) => {
    setCapturedImages(prev => prev.filter(file => file.name !== fileNameToRemove));
    setSelectedFiles(prev => prev.filter(file => file.name !== fileNameToRemove));
  };

  const removeSelectedFile = (indexToRemove: number) => {
    setSelectedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  // ADDED: New handler for "Scan Document" button
  const handleScanDocumentClick = () => {
    if (isMobileDevice) {
      setIsCameraMode(true);
      setSelectedFiles([]);
    } else {
      setShowScanOptionModal(true);
      setShowQrCode(false); // Hide QR code initially
    }
  };

  // ADDED: Handler for "Scan with the camera of this device"
  const handleScanWithDeviceCamera = () => {
    setShowScanOptionModal(false);
    setIsCameraMode(true);
    setSelectedFiles([]);
  };

  // ADDED: Handler for "Scan with a smartphone"
  const handleScanWithSmartphone = () => {
    setShowQrCode(true);
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
      
      {/* MODIFIED: Conditional rendering for Important Document Format message */}
      {(isAdvancedSubscription || isBasicSubscription) ? (
        <div className="bg-yellow-50 border-l-4 border-yellow-300 text-yellow-800 p-4 mb-6" role="alert">
          <div className="flex items-center">
            <FileText className="h-5 w-5 mr-3 flex-shrink-0" />
            <div>
              <p className="font-bold">{t('important_document_format')}</p>
              <p className="text-sm">
                {t('important_document_format_subscription')}
              </p>
            </div>
          </div>
        </div>
      ) : (
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
      )}

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
                {/* NEW: Display single-use credits for basic subscription users */}
                {isBasicSubscription && (
                  <p className="text-sm mt-2">
                    {t('advanced_analysis_cost_and_available_credits', { cost: ADVANCED_ANALYSIS_ADDON_COST, count: availableCredits })} <Link to="/pricing" className="font-medium underline">{t('pricing_page')}</Link>.
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="font-bold">{t('single_use_credits_available')}</p>
                <p className="text-sm">{t('credits_remaining_message', { count: availableCredits })}</p>
              </>
            )}
            {!hasSubscription && availableCredits < (OCR_COST + BASIC_ANALYSIS_COST) && (
              <p className="text-sm mt-2">
                {t('not_enough_credits_for_ocr_analysis', { cost: (OCR_COST + BASIC_ANALYSIS_COST) })} <Link to="/pricing" className="font-medium underline">{t('pricing_page')}</Link>.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Mode Toggle Buttons */}
      <div className="flex space-x-4 mb-6">
        <Button
          variant={isCameraMode ? 'secondary' : 'primary'}
          onClick={handleScanDocumentClick} // MODIFIED: Use new handler
          icon={<Camera className="w-4 h-4" />}
          disabled={isUploading || !canPerformOcr}
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
          canPerformOcr={canPerformOcr}
          canPerformBasicAnalysis={canPerformBasicAnalysis}
          canPerformAdvancedAddon={canPerformAdvancedAddon}
          ocrCost={OCR_COST}
          basicAnalysisCost={BASIC_ANALYSIS_COST}
          advancedAnalysisAddonCost={ADVANCED_ANALYSIS_ADDON_COST} 
          showProcessingOptions={showProcessingOptions}
          isAdvancedSubscription={isAdvancedSubscription}
          isBasicSubscription={isBasicSubscription}
          loadingOrders={loadingOrders}
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

      {/* ADDED: Scan Option Modal */}
      <Modal
        isOpen={showScanOptionModal}
        onClose={() => { setShowScanOptionModal(false); setShowQrCode(false); }}
        title={t('scan_document_options')}
      >
        <div className="text-center space-y-6">
          <p className="text-gray-700 text-lg">
            {t('quicker_more_accurate_scanning_message')}
          </p>
          {!showQrCode ? (
            <div className="space-y-4">
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleScanWithSmartphone}
                icon={<Smartphone className="w-5 h-5 mr-2" />}
              >
                {t('scan_with_smartphone')}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                className="w-full"
                onClick={handleScanWithDeviceCamera}
                icon={<Camera className="w-5 h-5 mr-2" />}
              >
                {t('scan_with_device_camera')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <p className="text-gray-600">{t('scan_qr_code_to_upload')}</p>
              <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-md">
                <QRCode value={window.location.href} size={256} level="H" />
              </div>
              <p className="text-sm text-gray-500">{t('qr_code_link_description')}</p>
              <Button
                variant="outline"
                onClick={() => setShowQrCode(false)}
              >
                {t('back_to_options')}
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default UploadPage;