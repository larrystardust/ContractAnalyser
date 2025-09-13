import React, { useState } from 'react';
import ContractUpload from '../components/contracts/ContractUpload';
import { Loader2 } from 'lucide-react'; // Import Loader2
import { useUserProfile } from '../hooks/useUserProfile'; // ADDED: Import useUserProfile
import { AlertTriangle } from 'lucide-react'; // ADDED: Import AlertTriangle
import { useAppSettings } from '../hooks/useAppSettings'; // ADDED: Import useAppSettings

const UploadPage: React.FC = () => {
  console.log('UploadPage component rendered');
  const [isUploading, setIsUploading] = useState(false); // New state for upload progress
  const { defaultJurisdictions, loading: loadingUserProfile } = useUserProfile(); // ADDED: Fetch user profile default jurisdictions
  // ADDED: Fetch app settings for default jurisdictions
  const { settings: appSettings, loading: loadingAppSettings, error: appSettingsError } = useAppSettings();

  const handleUploadStatusChange = (status: boolean) => {
    setIsUploading(status);
  };

  // MODIFIED: Combine loading states
  if (loadingUserProfile || loadingAppSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
        <p className="text-gray-500 mt-4">Loading user profile and application settings...</p>
      </div>
    );
  }

  // ADDED: Handle error for app settings
  if (appSettingsError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Settings</h2>
          <p className="text-gray-600 mb-4">
            There was a problem fetching application settings. Please try again.
          </p>
          <p className="text-sm text-red-500">Error: {appSettingsError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Upload New Contract</h1>
      
      {/* ADDED: OCR Limitation Alert */}
      <div className="bg-yellow-50 border-l-4 border-yellow-300 text-yellow-800 p-4 mb-6" role="alert">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0" />
          <div>
            <p className="font-bold">Important: Document Format</p>
            <p className="text-sm">
              ContractAnalyser processes text directly from your documents. We **do not support OCR** for scanned documents or images.
              Please ensure your uploaded files contain **selectable (clear) text**. If your document is a scan or an image, you must perform OCR on it manually before uploading.
            </p>
          </div>
        </div>
      </div>

      <ContractUpload
        onUploadStatusChange={handleUploadStatusChange}
        // MODIFIED: Pass default jurisdictions from user profile directly
        defaultJurisdictions={defaultJurisdictions}
      />

      {isUploading && (
        <div className="fixed inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50">
          <div className="text-center">
            <Loader2 className="h-16 w-16 text-blue-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-700 text-lg">Uploading and processing your contract...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadPage;