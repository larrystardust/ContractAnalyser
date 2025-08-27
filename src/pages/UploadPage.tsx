import React, { useState } from 'react';
import ContractUpload from '../components/contracts/ContractUpload';
import { Loader2 } from 'lucide-react'; // Import Loader2

const UploadPage: React.FC = () => {
  console.log('UploadPage component rendered');
  const [isUploading, setIsUploading] = useState(false); // New state for upload progress

  const handleUploadStatusChange = (status: boolean) => {
    setIsUploading(status);
  };

  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Upload New Contract</h1>
      <ContractUpload onUploadStatusChange={handleUploadStatusChange} /> {/* Pass the callback */}

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