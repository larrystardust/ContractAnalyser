import React, { useState, useRef, useEffect } from 'react';
import { Upload, X } from 'lucide-react';
import Button from '../ui/Button';
import { getAllJurisdictions } from '../../utils/jurisdictionUtils';
import { Jurisdiction } from '../../types';
import { useContracts } from '../../context/ContractContext';
import { useNavigate } from 'react-router-dom';
import { useUserOrders } from '../../hooks/useUserOrders';
import { useSubscription } from '../../hooks/useSubscription';

// Import text extraction libraries
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// CHANGE: Set the worker source for pdfjs-dist using new URL() for Vite
// This approach is often more compatible with pdfjs-dist in development mode
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

interface ContractUploadProps { // Define props interface
  onUploadStatusChange: (status: boolean) => void;
  defaultJurisdictions: Jurisdiction[]; // ADDED: New prop for default jurisdictions
}

const ContractUpload: React.FC<ContractUploadProps> = ({ onUploadStatusChange, defaultJurisdictions }) => { // Accept the prop
  const { contracts, addContract, loadingContracts, refetchContracts } = useContracts(); // MODIFIED: Destructure contracts
  const { hasAvailableSingleUse, loading: loadingOrders, error: ordersError } = useUserOrders();
  const { subscription, loading: loadingSubscription } = useSubscription(); // ADDED: Use useSubscription
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedJurisdictions, setSelectedJurisdictions] = useState<Jurisdiction[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false); // Keep this for internal button state
  const navigate = useNavigate();

  // ADDED: Effect to set default jurisdictions when component mounts or defaultJurisdictions prop changes
  useEffect(() => {
    if (defaultJurisdictions && defaultJurisdictions.length > 0) {
      setSelectedJurisdictions(defaultJurisdictions);
    }
  }, [defaultJurisdictions]);


  // Determine current file count
  const currentFileCount = contracts.length;
  // Determine max allowed files based on subscription, default to a very high number if no quota
  const maxAllowedFiles = subscription?.max_files || Infinity;

  // Determine if the user can upload based on available credits OR subscription quota
  const canUpload = !uploading && (
    (hasAvailableSingleUse() && !loadingOrders) || // Single-use credit available
    (subscription && !loadingSubscription && currentFileCount < maxAllowedFiles) // Active subscription with quota remaining
  );

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf' ||
          droppedFile.name.endsWith('.docx') ||
          droppedFile.name.endsWith('.doc')) { // Note: .doc support is limited by mammoth.js
        setFile(droppedFile);
      } else {
        alert('Unsupported file type. Please upload PDF, DOCX, or DOC.');
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === 'application/pdf' ||
          selectedFile.name.endsWith('.docx') ||
          selectedFile.name.endsWith('.doc')) { // Note: .doc support is limited by mammoth.js
        setFile(selectedFile);
      } else {
        alert('Unsupported file type. Please upload PDF, DOCX, or DOC.');
        e.target.value = ''; // Clear the input
      }
    }
  };

  const handleBrowseFilesClick = () => {
    fileInputRef.current?.click();
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Clear the input
    }
  };

  const toggleJurisdiction = (jurisdiction: Jurisdiction) => {
    if (selectedJurisdictions.includes(jurisdiction)) {
      setSelectedJurisdictions(selectedJurisdictions.filter(j => j !== jurisdiction));
    } else {
      setSelectedJurisdictions([...selectedJurisdictions, jurisdiction]);
    }
  };

  // Helper function to extract text from file
  const extractTextFromFile = async (file: File): Promise<string> => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const arrayBuffer = await file.arrayBuffer();

    if (fileExtension === 'pdf') {
      // MODIFIED: Use pdfjs-dist for PDF parsing
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map(item => item.str).join(' ') + '\n';
      }
      return fullText;
    } else if (fileExtension === 'docx') {
      const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
      return result.value; // The raw text
    } else if (fileExtension === 'doc') {
      // mammoth.js has limited support for .doc (old Word format)
      // It might work for simple .doc files, but .docx is preferred.
      const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
      return result.value;
    } else {
      throw new Error('Unsupported file type for text extraction.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canUpload) {
      if (subscription && currentFileCount >= maxAllowedFiles) {
        alert(`You have reached your file storage limit of ${maxAllowedFiles} files. To add more files, please delete old files from your Contracts page.`);
      } else if (!hasAvailableSingleUse()) {
        alert('You do not have an available single-use credit. Please purchase one to upload a contract.');
      }
      return;
    }
    if (file && selectedJurisdictions.length > 0) {
      setUploading(true); // For button state
      onUploadStatusChange(true); // Notify parent to show full-page loader
      try {
        // Extract text from the file
        const contractText = await extractTextFromFile(file);
        
        // Pass the extracted text along with other data
        const newContractId = await addContract({ file, jurisdictions: selectedJurisdictions, contractText });
        
        alert('Contract uploaded and analysis initiated!');
        refetchContracts(); // Call refetchContracts after alert is dismissed
        
        // MODIFIED: Redirect to the dashboard with the new contract ID
        if (newContractId) {
          navigate(`/dashboard?contractId=${newContractId}`);
        }

        // Reset the form
        setFile(null);
        setSelectedJurisdictions([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error: any) {
        alert(`Failed to upload contract or extract text: ${error.message}`);
        console.error('Upload failed:', error);
      } finally {
        setUploading(false); // For button state
        onUploadStatusChange(false); // Notify parent to hide full-page loader
      }
    } else {
      alert('Please select a file and at least one jurisdiction.');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Upload New Contract</h2>

      {loadingOrders || loadingSubscription ? (
        <p className="text-gray-600 mb-4">Checking available credits and subscription status...</p>
      ) : (
        <>
          {!hasAvailableSingleUse() && (!subscription || currentFileCount >= maxAllowedFiles) && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
              {subscription && currentFileCount >= maxAllowedFiles ? (
                <p>
                  You have reached your file storage limit of {maxAllowedFiles} files. To add more files, please delete old files from your <a href="/contracts" className="font-medium underline">Contracts page</a>.
                </p>
              ) : (
                <p>
                  You do not have an available single-use credit or a subscription plan. Please purchase one from the <a href="/pricing" className="font-medium underline">Pricing page</a> to start uploading and analyzing contracts.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* File Retention Policy Message */}
      <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-700 p-4 mb-6" role="alert">
        <p className="font-bold">Important Data Retention Policy</p>
        <p className="text-sm">
          For single-use purchases, your uploaded contracts and their analysis results will be automatically deleted after 30 days.
          For active subscription plans, your data will be retained for the duration of your subscription plus a 30 day grace period.
          The maximum number of files you can store at any given time is 200 for 'Professional Use' and 1000 for 'Enterprise Use'. To add more files after reaching your limit, please delete old files from your <a href="/contracts" className="font-medium underline">Contracts page</a>.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div
          className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center
            ${isDragging ? 'border-blue-600 bg-blue-50' : 'border-gray-300 bg-gray-50'}
            ${file ? 'bg-gray-100' : ''}
            transition-colors duration-200`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {!file ? (
            <>
              <Upload className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-sm text-gray-700 font-medium">Drag and drop your contract file here</p>
              <p className="text-xs text-gray-500 mt-1">Supports PDF, DOCX, DOC formats</p>

              <div className="mt-4">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleBrowseFilesClick}
                    disabled={!canUpload}
                  >
                    Browse Files
                  </Button>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="sr-only"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileInput}
                    ref={fileInputRef}
                    disabled={!canUpload}
                  />
                </label>
              </div>
            </>
          ) : (
            <div className="w-full">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Upload className="h-5 w-5 text-blue-900" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-700">{file.name}</p>
                    <p className="text-xs text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-500"
                  onClick={removeFile}
                  disabled={!canUpload}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Jurisdictions
          </label>
          <div className="flex flex-wrap gap-2">
            {getAllJurisdictions().map((jurisdiction) => (
              <button
                key={jurisdiction}
                type="button"
                onClick={() => toggleJurisdiction(jurisdiction)}
                className={`py-1 px-3 rounded-full text-xs font-medium transition-colors
                  ${selectedJurisdictions.includes(jurisdiction)
                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                    : 'bg-gray-100 text-gray-800 border border-gray-200 hover:bg-gray-200'
                  }`}
                disabled={!canUpload}
              >
                {jurisdiction}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            type="submit"
            variant="primary"
            disabled={!file || selectedJurisdictions.length === 0 || uploading || !canUpload}
            icon={<Upload className="w-4 h-4" />}
          >
            {uploading ? 'Uploading...' : 'Upload Contract'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ContractUpload;