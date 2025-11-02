import React, { useState, useEffect, useRef, useCallback } from 'react';
import ContractUpload from '../components/contracts/ContractUpload';
import CameraCapture from '../components/CameraCapture';
import { Loader2, AlertTriangle, Camera, FileText, Smartphone, XCircle } from 'lucide-react';
import { useUserProfile } from '../hooks/useUserProfile';
import { useAppSettings } from '../hooks/useAppSettings';
import { useTranslation } from 'react-i18next';
import { useUserOrders } from '../hooks/useUserOrders';
import { useSubscription } from '../hooks/useSubscription';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useIsMobile } from '../hooks/useIsMobile';
import QRCode from 'qrcode.react';
import { useSupabaseClient, useSessionContext } from '@supabase/auth-helpers-react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ScanSessionMessage } from '../types';

const UploadPage: React.FC = () => {
  const supabase = useSupabaseClient();
  const { session, isLoading: isSessionLoading } = useSessionContext();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const location = useLocation();

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

  // States for mobile scan session
  const [scanSessionId, setScanSessionId] = useState<string | null>(null);
  const [mobileScanStatus, setMobileScanStatus] = useState<'idle' | 'connecting' | 'connected' | 'error' | 'ended'>('idle');
  const [mobileScanError, setMobileScanError] = useState<string | null>(null);
  const mobileScanChannelRef = useRef<RealtimeChannel | null>(null);
  const [mobileAuthToken, setMobileAuthToken] = useState<string | null>(null);
  const [isMobileAuthProcessing, setIsMobileAuthProcessing] = useState(false);

  // Effect to check for scanSessionId and auth_token in URL on load
  useEffect(() => {
    const urlScanSessionId = searchParams.get('scanSessionId');
    const urlAuthToken = searchParams.get('auth_token');

    if (urlScanSessionId && urlAuthToken) {
      setScanSessionId(urlScanSessionId);
      setMobileAuthToken(urlAuthToken);
      setIsCameraMode(true); // Directly enter camera mode

      // Case 1: Mobile device lands on /upload with scanSessionId and auth_token, but is NOT authenticated
      // and does NOT have Supabase tokens in the hash (meaning magic link hasn't been processed yet).
      if (!session && !isSessionLoading && !location.hash) {
        console.log('UploadPage: Mobile device not authenticated, initiating mobile-auth Edge Function.');
        setIsMobileAuthProcessing(true);
        supabase.functions.invoke('mobile-auth', {
          body: { auth_token: urlAuthToken },
        }).then(({ data, error }) => {
          if (error) {
            console.error('UploadPage: Error invoking mobile-auth Edge Function:', error);
            setMobileScanError(t('mobile_scan_authentication_failed_magic_link'));
            setMobileScanStatus('error');
          } else if (data?.magicLinkUrl) {
            console.log('UploadPage: Received magicLinkUrl, redirecting for authentication.');
            // Redirect to the magic link URL. Supabase will handle authentication and redirect back.
            window.location.replace(data.magicLinkUrl);
          } else {
            console.error('UploadPage: mobile-auth Edge Function returned no magicLinkUrl.');
            setMobileScanError(t('mobile_scan_authentication_failed_no_magic_link'));
            setMobileScanStatus('error');
          }
        }).finally(() => {
          // isMobileAuthProcessing will be set to false after the redirect, or if an error occurs.
          // If redirect happens, this finally might not execute before page unload.
          // If error, we need to stop loading.
          if (mobileScanStatus !== 'error') { // Only set to false if not already in error state
            setIsMobileAuthProcessing(false);
          }
        });
        return; // Exit early, as a redirect is pending or processing is ongoing
      }

      // Case 2: Mobile device lands on /upload with scanSessionId and auth_token, and HAS Supabase tokens in the hash.
      // This happens AFTER the magic link redirect.
      if (!session && location.hash) { 
        const hashParams = new URLSearchParams(location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken && refreshToken) {
          console.log('UploadPage: Explicitly setting session from URL hash.');
          setIsMobileAuthProcessing(true);
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          }).then(({ error }) => {
            if (error) {
              console.error('UploadPage: Error setting session from hash:', error);
              setMobileScanError(t('mobile_scan_authentication_failed_session_set'));
              setMobileScanStatus('error');
            } else {
              // Clear the hash from the URL to prevent re-processing
              window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
            }
          }).finally(() => {
            setIsMobileAuthProcessing(false);
          });
        }
      }
    }
  }, [searchParams, session, supabase, location.hash, t, isSessionLoading]); // Added isSessionLoading to dependencies

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

  const showProcessingOptions = !isBasicSubscription && !isAdvancedSubscription;

  const handleUploadStatusChange = (status: boolean) => {
    setIsUploading(status);
  };

  const handleAddCapturedImage = (imageFile: File) => {
    setCapturedImages(prev => [...prev, imageFile]);
    setSelectedFiles(prev => [...prev, imageFile]);
  };

  const handleDoneCapturing = () => {
    setIsCameraMode(false);
    // Clear URL parameters after exiting camera mode
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete('scanSessionId');
    newSearchParams.delete('auth_token');
    window.history.replaceState({}, document.title, `${window.location.pathname}${newSearchParams.toString() ? `?${newSearchParams.toString()}` : ''}`);
  };

  const handleCancelCamera = () => {
    setIsCameraMode(false);
    setCapturedImages([]);
    setSelectedFiles(prev => prev.filter(file => !file.name.startsWith('scanned_image_')));
    // Clear URL parameters after exiting camera mode
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete('scanSessionId');
    newSearchParams.delete('auth_token');
    window.history.replaceState({}, document.title, `${window.location.pathname}${newSearchParams.toString() ? `?${newSearchParams.toString()}` : ''}`);
  };

  const removeCapturedImage = (fileNameToRemove: string) => {
    setCapturedImages(prev => prev.filter(file => file.name !== fileNameToRemove));
    setSelectedFiles(prev => prev.filter(file => file.name !== fileNameToRemove));
  };

  const removeSelectedFile = (indexToRemove: number) => {
    setSelectedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleScanDocumentClick = async () => {
    if (!session) {
      alert(t('upload_page_login_to_scan'));
      return;
    }

    if (isMobileDevice) {
      setIsCameraMode(true);
      setSelectedFiles([]);
      setScanSessionId(null);
      setMobileAuthToken(null);
      setMobileScanStatus('idle');
      setMobileScanError(null);
      return;
    }

    setMobileScanStatus('connecting');
    setMobileScanError(null);
    setShowScanOptionModal(true);
    setShowQrCode(false);

    try {
      const { data, error } = await supabase.functions.invoke('create-scan-session', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (!data?.scanSessionId || !data?.auth_token) throw new Error(t('upload_page_failed_to_create_scan_session'));

      setScanSessionId(data.scanSessionId);
      setMobileAuthToken(data.auth_token);
      setShowQrCode(true);
    } catch (err: any) {
      console.error('UploadPage: Error creating scan session:', err);
      setMobileScanStatus('error');
      setMobileScanError(err.message || t('upload_page_failed_to_create_scan_session'));
      setShowScanOptionModal(false);
    }
  };

  const handleScanWithDeviceCamera = () => {
    setShowQrCode(false);
    setIsCameraMode(true);
    setSelectedFiles([]);
    setScanSessionId(null);
    setMobileScanStatus('idle');
    setMobileAuthToken(null);
    setShowScanOptionModal(false);
  };

  const handleScanWithSmartphone = () => {
    setShowQrCode(true);
  };

  const handleEndMobileScanSession = async () => {
    if (mobileScanChannelRef.current) {
      if (mobileScanStatus === 'connected') {
        mobileScanChannelRef.current.send({
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
    setMobileAuthToken(null);
    setIsCameraMode(false);
  };


  if (loadingUserProfile || loadingAppSettings || loadingOrders || loadingSubscription || isSessionLoading || isMobileAuthProcessing) {
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

      <div className="flex space-x-4 mb-6">
        <Button
          variant={isCameraMode || mobileScanStatus !== 'idle' ? 'secondary' : 'primary'}
          onClick={handleScanDocumentClick}
          icon={<Camera className="w-4 h-4" />}
          disabled={isUploading || !canPerformOcr || mobileScanStatus === 'connecting' || mobileScanStatus === 'connected'}
        >
          {t('scan_document')}
        </Button>
        {mobileScanStatus === 'connected' && (
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
          onCapture={handleAddCapturedImage}
          onDoneCapturing={handleDoneCapturing}
          onCancel={handleCancelCamera}
          isLoading={isUploading}
          capturedImages={capturedImages}
          removeCapturedImage={removeCapturedImage}
          // Pass supabase and session for internal Realtime management
          supabase={supabase}
          session={session}
          isSessionLoading={isSessionLoading}
          // Pass scanSessionId and mobileAuthToken to CameraCapture
          scanSessionId={scanSessionId}
          mobileAuthToken={mobileAuthToken}
          // Pass status setters to CameraCapture
          setMobileScanStatus={setMobileScanStatus}
          setMobileScanError={setMobileScanError}
          mobileScanStatus={mobileScanStatus}
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

      <Modal
        isOpen={showScanOptionModal}
        onClose={handleEndMobileScanSession}
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
                disabled={mobileScanStatus === 'connecting'}
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
              {scanSessionId && mobileAuthToken && (
                <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-md">
                  <QRCode value={`${window.location.origin}/upload?scanSessionId=${scanSessionId}&auth_token=${mobileAuthToken}`} size={256} level="H" />
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
                onClick={handleEndMobileScanSession}
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