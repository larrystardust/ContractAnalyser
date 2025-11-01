import React, { useState, useEffect, useRef } from 'react';
import ContractUpload from '../components/contracts/ContractUpload';
import CameraCapture from '../components/CameraCapture';
import { Loader2, AlertTriangle, Camera, FileText, Smartphone, XCircle } from 'lucide-react'; // MODIFIED: Added XCircle
import { useUserProfile } from '../hooks/useUserProfile';
import { useAppSettings } from '../hooks/useAppSettings';
import { useTranslation } from 'react-i18next';
import { useUserOrders } from '../hooks/useUserOrders';
import { useSubscription } from '../hooks/useSubscription';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useIsMobile } from '../hooks/useIsMobile';
import QRCode from 'qrcode.react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react'; // ADDED: Import useSession
import { RealtimeChannel } from '@supabase/supabase-js'; // ADDED: Import RealtimeChannel
import { ScanSessionMessage } from '../types'; // ADDED: Import ScanSessionMessage

// Define the structure for a captured image
interface CapturedImage {
  id: string;
  data: string; // Base64 string
}

const UploadPage: React.FC = () => {
  const supabase = useSupabaseClient(); // ADDED
  const session = useSession(); // ADDED
  const { t } = useTranslation();

  const [isUploading, setIsUploading] = useState(false);
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [capturedImages, setCapturedImages] = useState<File[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { defaultJurisdictions, loading: loadingUserProfile } = useUserProfile();
  const { settings: appSettings, loading: loadingAppSettings, error: appSettingsError } = useAppSettings();
  const { getTotalSingleUseCredits, loading: loadingOrders } = useUserOrders();
  const { subscription, loading: loadingSubscription, totalSubscriptionFiles } = useSubscription();
  const isMobileDevice = useIsMobile();
  const [showScanOptionModal, setShowScanOptionModal] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);

  // ADDED: States for mobile scan session
  const [scanSessionId, setScanSessionId] = useState<string | null>(null);
  const [mobileScanStatus, setMobileScanStatus] = useState<'idle' | 'connecting' | 'connected' | 'error' | 'ended'>('idle');
  const [mobileScanError, setMobileScanError] = useState<string | null>(null);
  const mobileScanChannelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    console.log('UploadPage: isUploading state changed to:', isUploading);
  }, [isUploading]);

  // ADDED: Effect for mobile scan session management
  useEffect(() => {
    if (!scanSessionId || !session?.user?.id) return;

    // Cleanup previous channel if it exists
    if (mobileScanChannelRef.current) {
      supabase.removeChannel(mobileScanChannelRef.current);
      mobileScanChannelRef.current = null;
    }

    setMobileScanStatus('connecting');
    setMobileScanError(null);

    const newChannel = supabase.channel(`scan-session-${scanSessionId}`, {
      config: {
        presence: {
          key: session.user.id,
        },
      },
    });

    newChannel
      .on('broadcast', { event: 'mobile_ready' }, async (payload) => {
        console.log('UploadPage: Mobile ready signal received:', payload);
        setMobileScanStatus('connected');
        // Send desktop ready signal back to mobile
        await newChannel.send({
          type: 'broadcast',
          event: 'desktop_ready',
          payload: { userId: session.user.id },
        });
      })
      .on('broadcast', { event: 'image_data' }, async (payload: { payload: ScanSessionMessage }) => {
        const message = payload.payload;
        console.log('UploadPage: Image data message received:', message);

        if (message.type === 'image_captured' && message.payload?.imageUrl) {
          try {
            const { data: imageBlob, error: downloadError } = await supabase.storage
              .from('temp_scans')
              .download(message.payload.imageUrl.split('temp_scans/')[1]); // Extract path from URL

            if (downloadError) {
              throw downloadError;
            }

            const imageFile = new File([imageBlob], message.payload.imageName || `scanned_image_${Date.now()}.jpeg`, { type: 'image/jpeg' });
            setCapturedImages(prev => [...prev, imageFile]);
            setSelectedFiles(prev => [...prev, imageFile]);

            // Delete temporary image from storage after successful download
            const { error: deleteError } = await supabase.storage
              .from('temp_scans')
              .remove([message.payload.imageUrl.split('temp_scans/')[1]]);
            if (deleteError) {
              console.warn('UploadPage: Failed to delete temporary image from storage:', deleteError);
            }

          } catch (err: any) {
            console.error('UploadPage: Error processing received image:', err);
            setMobileScanError(err.message || t('upload_page_failed_to_receive_image'));
          }
        } else if (message.type === 'session_ended') {
          setMobileScanStatus('ended');
          setMobileScanError(t('upload_page_mobile_session_ended'));
          // Optionally close the QR code modal here
          setShowScanOptionModal(false);
          setShowQrCode(false);
        } else if (message.type === 'error' && message.payload?.errorMessage) {
          setMobileScanError(message.payload.errorMessage);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('UploadPage: Subscribed to desktop scan session channel.');
          // Desktop is ready, but wait for mobile to signal ready
        } else if (status === 'CHANNEL_ERROR') {
          setMobileScanStatus('error');
          setMobileScanError(t('upload_page_realtime_channel_error'));
        }
      });

    mobileScanChannelRef.current = newChannel;

    return () => {
      if (mobileScanChannelRef.current) {
        // Notify mobile that desktop is disconnecting
        if (mobileScanStatus === 'connected') {
          newChannel.send({
            type: 'broadcast',
            event: 'desktop_disconnected',
            payload: { userId: session.user.id },
          });
        }
        supabase.removeChannel(mobileScanChannelRef.current);
        mobileScanChannelRef.current = null;
      }
      setMobileScanStatus('idle');
      setMobileScanError(null);
    };
  }, [scanSessionId, supabase, session?.user?.id, t]);


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

  // MODIFIED: handleAddCapturedImage now directly adds to selectedFiles and capturedImages
  const handleAddCapturedImage = (imageFile: File) => {
    setCapturedImages(prev => [...prev, imageFile]);
    setSelectedFiles(prev => [...prev, imageFile]);
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

  // MODIFIED: New handler for "Scan Document" button
  const handleScanDocumentClick = async () => {
    if (!session) {
      alert(t('upload_page_login_to_scan'));
      return;
    }

    if (isMobileDevice) {
      setIsCameraMode(true);
      setSelectedFiles([]);
    } else {
      // For desktop, create a scan session and show QR code
      setMobileScanStatus('connecting');
      setMobileScanError(null);
      setShowScanOptionModal(true);
      setShowQrCode(false); // Hide QR code initially

      try {
        const { data, error } = await supabase.functions.invoke('create-scan-session', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (error) throw error;
        if (!data?.scanSessionId) throw new Error(t('upload_page_failed_to_create_scan_session'));

        setScanSessionId(data.scanSessionId);
        setShowQrCode(true); // Show QR code once session is created
      } catch (err: any) {
        console.error('UploadPage: Error creating scan session:', err);
        setMobileScanStatus('error');
        setMobileScanError(err.message || t('upload_page_failed_to_create_scan_session'));
        setShowScanOptionModal(false); // Close modal on error
      }
    }
  };

  // ADDED: Handler for "Scan with the camera of this device"
  const handleScanWithDeviceCamera = () => {
    setShowScanOptionModal(false);
    setShowQrCode(false); // Hide QR code if user chooses desktop camera
    setIsCameraMode(true);
    setSelectedFiles([]);
    setScanSessionId(null); // Clear mobile scan session if desktop camera is used
    setMobileScanStatus('idle');
  };

  // ADDED: Handler for "Scan with a smartphone" (just shows QR code, session already created)
  const handleScanWithSmartphone = () => {
    // Session is already created in handleScanDocumentClick for desktop users
    setShowQrCode(true);
  };

  // ADDED: Handler to close the mobile scan session
  const handleEndMobileScanSession = async () => {
    if (mobileScanChannelRef.current) {
      // Notify mobile that desktop is ending session
      if (mobileScanStatus === 'connected') {
        await mobileScanChannelRef.current.send({
          type: 'broadcast',
          event: 'desktop_disconnected',
          payload: { userId: session?.user?.id },
        });
      }
      supabase.removeChannel(mobileScanChannelRef.current);
      mobileScanChannelRef.current = null;
    }
    setScanSessionId(null);
    setMobileScanStatus('idle');
    setMobileScanError(null);
    setShowScanOptionModal(false);
    setShowQrCode(false);
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

      {/* Mode Toggle Buttons */}
      <div className="flex space-x-4 mb-6">
        <Button
          variant={isCameraMode || mobileScanStatus !== 'idle' ? 'secondary' : 'primary'} // MODIFIED
          onClick={handleScanDocumentClick}
          icon={<Camera className="w-4 h-4" />}
          disabled={isUploading || !canPerformOcr || mobileScanStatus === 'connecting' || mobileScanStatus === 'connected'} // MODIFIED
        >
          {t('scan_document')}
        </Button>
        {mobileScanStatus === 'connected' && ( // ADDED: End mobile scan session button
          <Button
            variant="danger"
            onClick={handleEndMobileScanSession}
            icon={<XCircle className="w-4 h-4" />}
            disabled={isUploading}
          >
            {t('upload_page_end_mobile_scan')}
          </Button>
        )}
      </div>

      {/* ADDED: Mobile Scan Status Display */}
      {mobileScanStatus === 'connected' && (
        <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-4 mb-6" role="alert">
          <div className="flex items-center">
            <Smartphone className="h-5 w-5 mr-3 flex-shrink-0" />
            <div>
              <p className="font-bold">{t('upload_page_mobile_connected')}</p>
              <p className="text-sm">{t('upload_page_mobile_connected_desc', { count: capturedImages.length })}</p>
            </div>
          </div>
        </div>
      )}
      {mobileScanStatus === 'error' && mobileScanError && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
          <div className="flex items-center">
            <XCircle className="h-5 w-5 mr-3 flex-shrink-0" />
            <div>
              <p className="font-bold">{t('upload_page_mobile_error')}</p>
              <p className="text-sm">{mobileScanError}</p>
            </div>
          </div>
        </div>
      )}
      {mobileScanStatus === 'ended' && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6" role="alert">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0" />
            <div>
              <p className="font-bold">{t('upload_page_mobile_session_ended_title')}</p>
              <p className="text-sm">{t('upload_page_mobile_session_ended_desc')}</p>
            </div>
          </div>
        </div>
      )}


      {isCameraMode ? (
        <CameraCapture
          onCapture={handleAddCapturedImage} // MODIFIED: Renamed prop
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

      {/* MODIFIED: Scan Option Modal for Desktop */}
      <Modal
        isOpen={showScanOptionModal}
        onClose={handleEndMobileScanSession} // MODIFIED: Close modal also ends session
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
                disabled={mobileScanStatus === 'connecting'} // Disable if session is being created
              >
                {mobileScanStatus === 'connecting' ? t('upload_page_creating_session') : t('scan_with_smartphone')}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                className="w-full"
                onClick={handleScanWithDeviceCamera}
                icon={<Camera className="w-5 h-5 mr-2" />}
                disabled={mobileScanStatus === 'connecting'}
              >
                {t('scan_with_device_camera')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              {mobileScanStatus === 'connected' ? (
                <p className="text-green-600 font-semibold">{t('upload_page_mobile_connected_qr')}</p>
              ) : (
                <p className="text-gray-600">{t('scan_qr_code_to_connect')}</p>
              )}
              {scanSessionId && (
                <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-md">
                  <QRCode value={`${window.location.origin}/mobile-camera?scanSessionId=${scanSessionId}`} size={256} level="H" />
                </div>
              )}
              <p className="text-sm text-gray-500">{t('qr_code_link_description_connect')}</p>
              {mobileScanStatus === 'connected' && (
                <p className="text-sm text-gray-700">{t('upload_page_images_received', { count: capturedImages.length })}</p>
              )}
              {mobileScanError && (
                <p className="text-sm text-red-500">{mobileScanError}</p>
              )}
              <Button
                variant="outline"
                onClick={handleEndMobileScanSession} // MODIFIED: End session
              >
                {t('upload_page_end_mobile_scan_session')}
              </Button>
            </div>
          )}
        </div>
      </Modal>
      </div>
    </div>
  );
};

export default UploadPage;