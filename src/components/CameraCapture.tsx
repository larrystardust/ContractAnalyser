import React, { useRef, useEffect, useState, useCallback } from 'react';
import Button from './ui/Button';
import { Camera, X, Loader2, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CameraCaptureProps {
  onCapture: (imageFile: File) => void; // MODIFIED: Renamed from onAddImage
  onDoneCapturing: () => void;
  onCancel: () => void;
  isLoading: boolean;
  capturedImages: File[];
  removeCapturedImage: (id: string) => void;
  facingMode?: 'user' | 'environment'; // ADDED: Option to choose camera
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onDoneCapturing, onCancel, isLoading, capturedImages, removeCapturedImage, facingMode = 'environment' }) => { // MODIFIED: Added facingMode prop
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const { t } = useTranslation();

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
        video: { facingMode: facingMode }, // MODIFIED: Use facingMode prop
      });
      mediaStreamRef.current = mediaStream;
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
  }, [t, stopCamera, facingMode]); // MODIFIED: Added facingMode to dependencies

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const videoElement = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const uniqueId = crypto.randomUUID();
            const imageFile = new File([blob], `scanned_image_${uniqueId}.jpeg`, { type: 'image/jpeg' });
            onCapture(imageFile); // MODIFIED: Call onCapture
          }
        }, 'image/jpeg', 0.9);
      }
    }
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
          <div className="relative w-full bg-gray-200 rounded-lg overflow-hidden">
            <video ref={videoRef} className="w-full h-auto rounded-lg" playsInline autoPlay muted />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
              <Button
                type="button"
                variant="primary"
                onClick={handleCapture}
                disabled={!mediaStreamRef.current || isLoading || !isPlaying}
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
      )}
    </div>
  );
};

export default CameraCapture;