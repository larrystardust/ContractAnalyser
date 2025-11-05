import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useSupabaseClient, useSession, useSessionContext } from '@supabase/auth-helpers-react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Camera, X, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import Button from '../components/ui/Button';
import Card, { CardBody } from '../components/ui/Card';
import { useTranslation } from 'react-i18next';
import { ScanSessionMessage } from '../types';
import Modal from '../components/ui/Modal';

const MOBILE_AUTH_CONTEXT_KEY = 'mobile_auth_context';
const MOBILE_AUTH_FLOW_ACTIVE_FLAG = 'mobile_auth_flow_active'; // NEW: Persistent flag for mobile auth flow

const MobileCameraApp: React.FC = () => {
  const supabase = useSupabaseClient();
  const { session, isLoading: isSessionLoading } = useSessionContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { t } = useTranslation();

  const [scanSessionId, setScanSessionId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [capturedImagesCount, setCapturedImagesCount] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showReturnToDesktopModal, setShowReturnToDesktopModal] = useState(false);

  const stopCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
      setIsPlaying(false);
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    stopCamera();

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      mediaStreamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.videoWidth = 1280;
        videoRef.videoHeight = 720;
        videoRef.current.srcObject = mediaStream;
        try {
          await videoRef.current.play();
          setIsPlaying(true);
        } catch (err: any) {
          if (err.name === 'AbortError') {
            console.warn('MobileCameraApp: Video play() was aborted, likely due to rapid component changes or unmount. This is often non-critical.', err);
          } else {
            console.error('MobileCameraApp: Error playing video stream:', err);
            setCameraError(t('camera_access_denied_or_unavailable'));
            stopCamera();
          }
        }
      }
    } catch (err: any) {
      console.error('MobileCameraApp: Error accessing camera:', err);
      setCameraError(t('camera_access_denied_or_unavailable'));
    }
  }, [t, stopCamera]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera]);

  // MODIFIED: This useEffect now primarily parses context from localStorage
  useEffect(() => {
    const storedContext = localStorage.getItem(MOBILE_AUTH_CONTEXT_KEY);
    const mobileAuthFlowActive = localStorage.getItem(MOBILE_AUTH_FLOW_ACTIVE_FLAG) === 'true';

    if (!mobileAuthFlowActive || !storedContext) {
      console.error('MobileCameraApp: Mobile auth flow not active or context missing. Redirecting to upload.');
      setConnectionError(t('mobile_scan_session_id_missing'));
      setIsConnecting(false);
      navigate('/upload', { replace: true });
      return;
    }

    try {
      const { scanSessionId: storedScanSessionId, authToken: storedAuthToken } = JSON.parse(storedContext);
      if (!storedScanSessionId || !storedAuthToken) {
        throw new Error('Invalid mobile auth context in localStorage.');
      }
      setScanSessionId(storedScanSessionId);
      // The session should already be active by the time MobileCameraApp loads, handled by App.tsx

      setIsConnecting(false); // Finished processing initial setup

      // NEW: Clear the flags now that MobileCameraApp has consumed the context
      localStorage.removeItem(MOBILE_AUTH_CONTEXT_KEY);
      localStorage.removeItem(MOBILE_AUTH_FLOW_ACTIVE_FLAG);
      console.log('MobileCameraApp: Cleared mobile auth context and active flag from localStorage.');

    } catch (e) {
      console.error('MobileCameraApp: Error parsing stored mobile auth context:', e);
      setConnectionError(t('mobile_scan_session_id_missing'));
      setIsConnecting(false);
      navigate('/upload', { replace: true });
    }
  }, [navigate, t]); // Only depends on navigate and t

  const connectToRealtime = useCallback(async (id: string, userId: string) => {
    setIsConnecting(true);
    setConnectionError(null);

    const newChannel = supabase.channel(`scan-session-${id}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    newChannel
      .on('broadcast', { event: 'desktop_ready' }, (payload) => {
        console.log('MobileCameraApp: Desktop ready signal received:', payload);
        setIsConnecting(false);
      })
      .on('broadcast', { event: 'desktop_disconnected' }, () => {
        setConnectionError(t('mobile_scan_desktop_disconnected'));
        setIsConnecting(false);
        stopCamera();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('MobileCameraApp: Subscribed to scan session channel.');
          await newChannel.send({
            type: 'broadcast',
            event: 'mobile_ready',
            payload: { userId: userId },
          });
          console.log('MobileCameraApp: Sent mobile_ready signal.');
        } else if (status === 'CHANNEL_ERROR') {
          setConnectionError(t('mobile_scan_channel_error'));
          setIsConnecting(false);
        }
      });

    channelRef.current = newChannel;
  }, [supabase, t, stopCamera, setIsConnecting]);

  useEffect(() => {
    if (isSessionLoading) {
      return;
    }

    if (session?.user?.id && scanSessionId) {
      console.log('MobileCameraApp: Session exists and scanSessionId is set. Connecting to Realtime.');
      connectToRealtime(scanSessionId, session.user.id);
    } else if (!session?.user?.id) {
      console.error('MobileCameraApp: No active session after hash processing. Redirecting to upload.');
      setConnectionError(t('mobile_scan_authentication_required'));
      navigate('/upload', { replace: true });
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [session, isSessionLoading, scanSessionId, connectToRealtime, navigate, t]);

  const handleCaptureAndUpload = async () => {
    if (!videoRef.current || !canvasRef.current || !scanSessionId || !session?.user?.id) {
      setConnectionError(t('mobile_scan_capture_error_no_session'));
      return;
    }

    setIsUploading(true);
    const videoElement = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (context) {
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(async (blob) => {
        if (blob) {
          const uniqueId = crypto.randomUUID();
          const fileName = `scanned_image_${uniqueId}.jpeg`;
          const filePath = `${session.user.id}/${scanSessionId}/${fileName}`;

          try {
            const { data, error: uploadError } = await supabase.storage
              .from('temp_scans')
              .upload(filePath, blob, {
                contentType: 'image/jpeg',
                upsert: false,
              });

            if (uploadError) {
              throw uploadError;
            }

            const { data: publicUrlData } = supabase.storage
              .from('temp_scans')
              .getPublicUrl(filePath);

            if (!publicUrlData?.publicUrl) {
              throw new Error(t('mobile_scan_failed_to_get_public_url'));
            }

            const message: ScanSessionMessage = {
              type: 'image_captured',
              payload: {
                imageUrl: publicUrlData.publicUrl,
                imageName: fileName,
                imageSize: blob.size,
              },
            };
            await channelRef.current?.send({
              type: 'broadcast',
              event: 'image_data',
              payload: message,
            });

            setCapturedImagesCount(prev => prev + 1);
            console.log('MobileCameraApp: Image captured and sent:', fileName);

          } catch (err: any) {
            console.error('MobileCameraApp: Error uploading or sending image:', err);
            setConnectionError(err.message || t('mobile_scan_failed_to_send_image'));
            const errorMessage: ScanSessionMessage = {
              type: 'error',
              payload: { errorMessage: err.message || t('mobile_scan_failed_to_send_image') },
            };
            await channelRef.current?.send({
              type: 'broadcast',
              event: 'image_data',
              payload: errorMessage,
            });
          } finally {
            setIsUploading(false);
          }
        } else {
          setConnectionError(t('mobile_scan_failed_to_create_image_blob'));
          setIsUploading(false);
        }
      }, 'image/jpeg', 0.9);
    }
  };

  const handleDone = async () => {
    if (channelRef.current) {
      const message: ScanSessionMessage = { type: 'session_ended' };
      await channelRef.current?.send({
        type: 'broadcast',
        event: 'image_data',
        payload: message,
      });
    }
    setShowReturnToDesktopModal(true);
    localStorage.removeItem(MOBILE_AUTH_FLOW_ACTIVE_FLAG); // NEW: Clear persistent flag on done
  };

  // NEW: handleCancelSession function to clear the persistent flag
  const handleCancelSession = () => {
    localStorage.removeItem(MOBILE_AUTH_FLOW_ACTIVE_FLAG);
    navigate('/upload', { replace: true });
  };

  if (isSessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardBody className="text-center">
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('mobile_scan_loading_session')}</h2>
            <p className="text-gray-600">{t('mobile_scan_please_wait')}</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (isConnecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardBody className="text-center">
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('mobile_scan_connecting_title')}</h2>
            <p className="text-gray-600">{t('mobile_scan_connecting_desc')}</p>
            {connectionError && <p className="text-red-500 mt-2">{connectionError}</p>}
          </CardBody>
        </Card>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardBody className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('mobile_scan_connection_error_title')}</h2>
            <p className="text-gray-600 mb-4">{connectionError}</p>
            <Button onClick={() => navigate('/upload')} variant="primary">{t('back_to_upload')}</Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (cameraError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardBody className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('mobile_scan_camera_error_title')}</h2>
            <p className="text-gray-600 mb-4">{cameraError}</p>
            <Button onClick={() => navigate('/upload')} variant="primary">{t('back_to_upload')}</Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
      <h1 className="text-2xl font-bold mb-4">{t('mobile_scan_capture_documents')}</h1>
      <p className="text-gray-300 mb-6">{t('mobile_scan_captured_count', { count: capturedImagesCount })}</p>

      <div className="relative w-full max-w-lg bg-gray-800 rounded-lg overflow-hidden shadow-lg">
        <video ref={videoRef} className="w-full h-auto rounded-lg" playsInline autoPlay muted />
        <canvas ref={canvasRef} className="hidden" />
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
          <Button
            type="button"
            variant="primary"
            onClick={handleCaptureAndUpload}
            disabled={isUploading || !isPlaying}
            icon={isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
          >
            {isUploading ? t('mobile_scan_uploading') : t('mobile_scan_capture_page')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleDone}
            disabled={isUploading}
            icon={<CheckCircle className="h-5 w-5" />}
          >
            {t('mobile_scan_done')}
          </Button>
        </div>
      </div>

      <Button onClick={handleCancelSession} variant="outline" className="mt-8">{t('mobile_scan_cancel_session')}</Button>

      {showReturnToDesktopModal && (
        <Modal
          isOpen={showReturnToDesktopModal}
          onClose={() => navigate('/upload', { replace: true })}
          title={t('mobile_scan_return_to_desktop_title')}
        >
          <div className="text-center space-y-4">
            <p className="text-gray-700 text-lg">
              {t('mobile_scan_return_to_desktop_message')}
            </p>
            <Button
              variant="primary"
              onClick={() => navigate('/upload', { replace: true })}
            >
              {t('mobile_scan_go_to_desktop')}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default MobileCameraApp;