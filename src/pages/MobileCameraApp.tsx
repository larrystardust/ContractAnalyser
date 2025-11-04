import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Camera, X, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import Button from '../components/ui/Button';
import Card, { CardBody } from '../components/ui/Card';
import { useTranslation } from 'react-i18next';
import { ScanSessionMessage } from '../types';

const MobileCameraApp: React.FC = () => {
  const supabase = useSupabaseClient();
  const session = useSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); // Keep for initial QR code parsing
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

  // --- Camera Logic (reused from CameraCapture, adapted) ---
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
        video: { facingMode: 'environment' }, // Always use environment camera for mobile scanning
      });
      mediaStreamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.videoWidth = 1280; // Set a standard resolution for video feed
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

  // MODIFIED: This useEffect now *only* parses ALL tokens from the hash and sets local state
  useEffect(() => {
    const hashParams = new URLSearchParams(location.hash.substring(1));
    const hashScanSessionId = hashParams.get('scanSessionId'); // Get from hash
    const hashAuthToken = hashParams.get('auth_token'); // Get from hash
    const supabaseAccessToken = hashParams.get('access_token'); // Get from hash
    const supabaseRefreshToken = hashParams.get('refresh_token'); // Get from hash

    if (hashScanSessionId && hashAuthToken && supabaseAccessToken && supabaseRefreshToken) {
      console.log('MobileCameraApp: Found all tokens in URL hash.');
      setScanSessionId(hashScanSessionId);
      // mobileAuthToken is not directly used in this component's state, but used in main useEffect
      // The Supabase session should already be set by App.tsx
      setIsConnecting(false); // Finished processing initial hash
      // Clear the hash from the URL to remove sensitive tokens
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    } else {
      console.error('MobileCameraApp: Missing essential tokens in hash. Redirecting to upload.');
      setConnectionError(t('mobile_scan_session_id_missing'));
      setIsConnecting(false);
      navigate('/upload', { replace: true }); // Redirect to upload page if direct access
    }
  }, [location.hash, navigate, t]);

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
        setIsConnecting(false); // Desktop is ready, can start capturing
      })
      .on('broadcast', { event: 'desktop_disconnected' }, () => {
        setConnectionError(t('mobile_scan_desktop_disconnected'));
        setIsConnecting(false);
        stopCamera();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('MobileCameraApp: Subscribed to scan session channel.');
          // Broadcast that mobile is ready
          await newChannel.send({
            type: 'broadcast',
            event: 'mobile_ready',
            payload: { userId: userId },
          });
        } else if (status === 'CHANNEL_ERROR') {
          setConnectionError(t('mobile_scan_channel_error'));
          setIsConnecting(false);
        }
      });

    channelRef.current = newChannel;
  }, [supabase, t, stopCamera]);

  // Main useEffect for Realtime connection (after session is established)
  useEffect(() => {
    if (session?.user?.id && scanSessionId) {
      console.log('MobileCameraApp: Session exists and scanSessionId is set. Connecting to Realtime.');
      connectToRealtime(scanSessionId, session.user.id);
    } else if (!session?.user?.id && !isConnecting) {
      // If no session and not connecting, means initial hash processing failed or user is not logged in
      console.error('MobileCameraApp: No active session after hash processing. Redirecting to upload.');
      setConnectionError(t('mobile_scan_authentication_required'));
      navigate('/upload', { replace: true });
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      // stopCamera is handled by its own useEffect cleanup
    };
  }, [session, scanSessionId, connectToRealtime, navigate, isConnecting, t]);

  // --- Image Capture and Upload ---
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
            // Upload image to temporary storage
            const { data, error: uploadError } = await supabase.storage
              .from('temp_scans')
              .upload(filePath, blob, {
                contentType: 'image/jpeg',
                upsert: false,
              });

            if (uploadError) {
              throw uploadError;
            }

            // Get public URL for the uploaded image
            const { data: publicUrlData } = supabase.storage
              .from('temp_scans')
              .getPublicUrl(filePath);

            if (!publicUrlData?.publicUrl) {
              throw new Error(t('mobile_scan_failed_to_get_public_url'));
            }

            // Send message to desktop via Realtime
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
            // Also send error message to desktop
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
      await channelRef.current?.send({ // Use optional chaining as channelRef.current might be null
        type: 'broadcast',
        event: 'image_data',
        payload: message,
      });
    }
    navigate('/upload', { replace: true }); // Redirect back to upload page
  };

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

      <Button onClick={handleDone} variant="outline" className="mt-8">{t('mobile_scan_cancel_session')}</Button>
    </div>
  );
};

export default MobileCameraApp;