import React, { useRef, useEffect, useState, useCallback } from 'react';
import Button from '../ui/Button';
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
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const { t } = useTranslation();

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCapturedImage(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Prefer rear camera
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      setCameraError(t('camera_access_denied_or_unavailable'));
    }
  }, [t]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        // Set canvas dimensions to match video stream
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw the current video frame onto the canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Get image data as Base64
        const imageData = canvas.toDataURL('image/jpeg', 0.9); // JPEG format, 90% quality
        setCapturedImage(imageData);
        stopCamera(); // Stop camera after capture
        onCapture(imageData); // Pass captured image data to parent
      }
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    onCapture(null); // Clear captured image in parent
    startCamera(); // Restart camera
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
              <canvas ref={canvasRef} className="hidden" /> {/* Hidden canvas for capture */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleCapture}
                  disabled={!stream || isLoading}
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
                  onClick={() => onCapture(capturedImage)} // Re-confirm capture to parent if needed
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