import React, { useRef, useEffect, useState, useCallback } from 'react';
import Button from './ui/Button';
import { Camera, X, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CameraCaptureProps {
  onCapture: (imageData: string | null) => void;
  onCancel: () => void;
  isLoading: boolean;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onCancel, isLoading }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null); // Use a ref for the MediaStream
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const { t } = useTranslation();

  const stopCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null; // Clear the ref
      setIsPlaying(false);
    }
  }, []); // No dependencies, so this function is stable

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCapturedImage(null);
    stopCamera(); // Stop any existing camera before starting a new one

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Prefer rear camera
      });
      mediaStreamRef.current = mediaStream; // Store stream in ref
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        try {
          await videoRef.current.play();
          setIsPlaying(true);
        } catch (err: any) {
          if (err.name === 'AbortError') {
            console.warn('Video play() was aborted, likely due to rapid component changes or unmount. This is often non-critical.', err);
          } else {
            console.error('Error playing video stream:', err);
            setCameraError(t('camera_access_denied_or_unavailable'));
            stopCamera();
          }
        }
      }
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      setCameraError(t('camera_access_denied_or_unavailable'));
    }
  }, [t, stopCamera]); // Depends on stopCamera, but stopCamera is now stable

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera]); // Now depends only on startCamera, which is stable

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        setCapturedImage(imageData);
        stopCamera(); // Stop camera immediately after capture
        onCapture(imageData);
      }
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    onCapture(null);
    startCamera();
  };

  return (
    <div className="space-y-4">
      {cameraError ? (
        <div className="text-center text-red-600 p-4 border border-red-300 rounded-md">
          <X className="h-6 w-6 mx-auto mb-2" />
          <p>{cameraError}</p>
          <Button variant="secondary" onClick={onCancel} className="mt-4">{t('cancel')}</Button>
        </div>
      ) : (
        <>
          {!capturedImage ? (
            <div className="relative w-full bg-gray-200 rounded-lg overflow-hidden">
              <video ref={videoRef} className="w-full h-auto rounded-lg" playsInline autoPlay muted />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleCapture}
                  disabled={!mediaStreamRef.current || isLoading || !isPlaying} // Check ref for stream
                  icon={isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                >
                  {isLoading ? t('capturing') : t('capture_image')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative w-full bg-gray-200 rounded-lg overflow-hidden">
              <img src={capturedImage} alt={t('captured_document')} className="w-full h-auto rounded-lg" />
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleRetake}
                  disabled={isLoading}
                >
                  {t('retake')}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => onCapture(capturedImage)}
                  disabled={isLoading}
                  icon={isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : undefined}
                >
                  {isLoading ? t('processing') : t('use_image')}
                </Button>
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              {t('cancel')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default CameraCapture;