import React, { useRef, useEffect, useState, useCallback } from 'react';
import Button from './ui/Button';
import { Camera, X, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SupabaseClient, Session } from '@supabase/supabase-js';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ScanSessionMessage } from '../types';
import { useSessionContext } from '@supabase/auth-helpers-react'; // MODIFIED: Import useSessionContext

interface CameraCaptureProps {
  onCapture: (imageFile: File) => void;
  onDoneCapturing: () => void;
  onCancel: () => void;
  isLoading: boolean;
  capturedImages: File[];
  removeCapturedImage: (id: string) => void;
  facingMode?: 'user' | 'environment';
  // ADDED: Props for mobile scan session management
  scanSessionId: string | null;
  mobileAuthToken: string | null;
  mobileScanStatus: 'idle' | 'connecting' | 'connected' | 'error' | 'ended';
  setMobileScanStatus: (status: 'idle' | 'connecting' | 'connected' | 'error' | 'ended') => void;
  setMobileScanError: (error: string | null) => void;
  // ADDED: Supabase client and session props
  supabase: SupabaseClient;
  session: Session | null;
  isSessionLoading: boolean; // MODIFIED: Add isSessionLoading prop
}

const CameraCapture: React.FC<CameraCaptureProps> = ({
  onCapture,
  onDoneCapturing,
  onCancel,
  isLoading,
  capturedImages,
  removeCapturedImage,
  facingMode = 'environment',
  // ADDED: Destructure new props
  scanSessionId,
  mobileAuthToken,
  mobileScanStatus,
  setMobileScanStatus,
  setMobileScanError,
  // ADDED: Destructure supabase and session
  supabase,
  session,
  isSessionLoading, // MODIFIED: Destructure isSessionLoading
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const { t } = useTranslation();
  const channelRef = useRef<RealtimeChannel | null>(null);

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
        video: { facingMode: facingMode },
      });
      mediaStreamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        try {
          await videoRef.current.play();
          setIsPlaying(true);
        } catch (err: any) {
          if (err.name === 'AbortError') {
            console.warn('CameraCapture: Video play() was aborted, likely due to rapid component changes or unmount. This is often non-critical.', err);
          } else {
            console.error('CameraCapture: Error playing video stream:', err);
            setCameraError(t('camera_access_denied_or_unavailable'));
            stopCamera();
          }
        }
      }
    } catch (err: any) {
      console.error('CameraCapture: Error accessing camera:', err);
      setCameraError(t('camera_access_denied_or_unavailable'));
    }
  }, [t, stopCamera, facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera]);

  // ADDED: Realtime Session Management for CameraCapture
  useEffect(() => {
    // Only proceed if session is loaded and we have scan session details
    if (isSessionLoading || !scanSessionId || !mobileAuthToken) { // MODIFIED: Check isSessionLoading
      setMobileScanStatus('idle'); // Ensure status is idle if not ready to connect
      return;
    }

    // If session is null after loading, it means user is not authenticated
    if (!session) {
      setMobileScanStatus('error');
      setMobileScanError(t('mobile_scan_not_authenticated_desc'));
      return;
    }

    // Cleanup previous channel if it exists
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
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
      .on('broadcast', { event: 'desktop_ready' }, (payload) => {
        console.log('CameraCapture: Desktop ready signal received:', payload);
        setMobileScanStatus('connected'); // Desktop is ready, can start capturing
      })
      .on('broadcast', { event: 'desktop_disconnected' }, () => {
        setMobileScanError(t('mobile_scan_desktop_disconnected'));
        setMobileScanStatus('ended'); // Desktop disconnected, end session
        stopCamera();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('CameraCapture: Subscribed to scan session channel.');
          // Broadcast that mobile is ready
          await newChannel.send({
            type: 'broadcast',
            event: 'mobile_ready',
            payload: { userId: session.user.id },
          });
        } else if (status === 'CHANNEL_ERROR') {
          setMobileScanError(t('mobile_scan_channel_error'));
          setMobileScanStatus('error');
        }
      });

    channelRef.current = newChannel;

    return () => {
      if (channelRef.current) {
        // Notify desktop that mobile is disconnecting
        if (mobileScanStatus === 'connected') {
          channelRef.current.send({
            type: 'broadcast',
            event: 'mobile_disconnected',
            payload: { userId: session.user.id },
          });
        }
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setMobileScanStatus('idle');
      setMobileScanError(null);
    };
  }, [scanSessionId, mobileAuthToken, session, supabase, t, stopCamera, setMobileScanStatus, setMobileScanError, mobileScanStatus, isSessionLoading]); // MODIFIED: Add isSessionLoading to dependencies


  const handleCapture = async () => {
    if (videoRef.current && canvasRef.current) {
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
            const imageFile = new File([blob], fileName, { type: 'image/jpeg' });
            onCapture(imageFile);

            // ADDED: If in mobile scan session, upload to temp storage and notify desktop
            if (scanSessionId && session?.user?.id && channelRef.current && mobileScanStatus === 'connected') {
              try {
                const filePath = `${session.user.id}/${scanSessionId}/${fileName}`;
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
                await channelRef.current.send({
                  type: 'broadcast',
                  event: 'image_data',
                  payload: message,
                });
                console.log('CameraCapture: Image captured and sent to desktop:', fileName);

              } catch (err: any) {
                console.error('CameraCapture: Error uploading or sending image to desktop:', err);
                setMobileScanError(err.message || t('mobile_scan_failed_to_send_image'));
                // Also send error message to desktop
                const errorMessage: ScanSessionMessage = {
                  type: 'error',
                  payload: { errorMessage: err.message || t('mobile_scan_failed_to_send_image') },
                };
                await channelRef.current.send({
                  type: 'broadcast',
                  event: 'image_data',
                  payload: errorMessage,
                });
              }
            }
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  // ADDED: Render loading/error states for mobile scan session
  if (isSessionLoading) { // MODIFIED: Check isSessionLoading first
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4 text-center">
        <Loader2 className="h-12 w-12 text-blue-400 animate-spin mx-auto mb-4" />
        <p className="text-lg">{t('mobile_scan_loading_session')}</p>
        <p className="text-sm text-gray-400">{t('mobile_scan_please_wait')}</p>
      </div>
    );
  }

  if (!session) { // MODIFIED: If no session after loading
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-lg font-bold">{t('mobile_scan_not_authenticated_title')}</p>
        <p className="text-sm text-gray-400 mb-4">{t('mobile_scan_not_authenticated_desc')}</p>
        <Button onClick={onCancel} variant="outline">{t('back_to_upload')}</Button>
      </div>
    );
  }

  if (mobileScanStatus === 'connecting') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4 text-center">
        <Loader2 className="h-12 w-12 text-blue-400 animate-spin mx-auto mb-4" />
        <p className="text-lg">{t('mobile_scan_connecting_title')}</p>
        <p className="text-sm text-gray-400">{t('mobile_scan_connecting_desc')}</p>
      </div>
    );
  }

  if (mobileScanStatus === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-lg font-bold">{t('mobile_scan_connection_error_title')}</p>
        <p className="text-sm text-gray-400 mb-4">{mobileScanError || t('mobile_scan_generic_connection_error')}</p>
        <Button onClick={onCancel} variant="outline">{t('back_to_upload')}</Button>
      </div>
    );
  }

  if (cameraError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-lg font-bold">{t('mobile_scan_camera_error_title')}</p>
        <p className="text-sm text-gray-400 mb-4">{cameraError}</p>
        <Button onClick={onCancel} variant="outline">{t('back_to_upload')}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* MODIFIED: Removed cameraError check here, handled above */}
      <>
        <div className="relative w-full bg-gray-200 rounded-lg overflow-hidden">
          <video ref={videoRef} className="w-full h-auto rounded-lg" playsInline autoPlay muted />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
            <Button
              type="button"
              variant="primary"
              onClick={handleCapture}
              disabled={!mediaStreamRef.current || isLoading || !isPlaying || (scanSessionId && mobileScanStatus !== 'connected')}
              icon={isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
            >
              {isLoading ? t('capturing') : t('capture_page')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onDoneCapturing}
              disabled={isLoading || capturedImages.length === 0}
              icon={<CheckCircle className="h-5 w-5" />}
            >
              {t('done_capturing')} ({capturedImages.length})
            </Button>
          </div>
        </div>

        {capturedImages.length > 0 && (
          <div className="mt-4 p-4 border border-gray-200 rounded-md bg-gray-50">
              <h3 className="text-md font-semibold text-gray-800 mb-3">{t('captured_images_preview')}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {capturedImages.map((imageFile, index) => (
                <div key={imageFile.name} className="relative group">
                  <img src={URL.createObjectURL(imageFile)} alt={`${t('captured_page')} ${index + 1}`} className="w-full h-auto rounded-md border border-gray-300" />
                  <button
                    type="button"
                    onClick={() => removeCapturedImage(imageFile.name)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    title={t('remove_image')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              {t('cancel')}
            </Button>
          </div>
        </>
    </div>
  );
};

export default CameraCapture;