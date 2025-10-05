import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, AlertTriangle } from 'lucide-react'; // ADDED: AlertTriangle
import Button from '../ui/Button';
import { getAllJurisdictions, getJurisdictionLabel } from '../../utils/jurisdictionUtils';
import { Jurisdiction, AnalysisLanguage } from '../../types';
import { useContracts } from '../../context/ContractContext';
import { useNavigate, Link } from 'react-router-dom';
import { useUserOrders } from '../../hooks/useUserOrders';
import { useSubscription } from '../../hooks/useSubscription';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react'; // ADDED: Import Sparkles

// REMOVED: Direct imports for pdfjs-dist and mammoth
// import * as pdfjsLib from 'pdfjs-dist';
// import mammoth from 'mammoth';

// REMOVED: Direct setting of workerSrc
// pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'; // New update 

interface ContractUploadProps {
  onUploadStatusChange: (status: boolean) => void;
  defaultJurisdictions: Jurisdiction[];
}

const ContractUpload: React.FC<ContractUploadProps> = ({ onUploadStatusChange, defaultJurisdictions }) => {
  const { contracts, addContract, loadingContracts, refetchContracts } = useContracts();
  const { hasAvailableSingleUse, loading: loadingOrders, error: ordersError, getTotalSingleUseCredits } = useUserOrders(); // MODIFIED: Get getTotalSingleUseCredits
  const { subscription, loading: loadingSubscription } = useSubscription();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedJurisdictions, setSelectedJurisdictions] = useState<Jurisdiction[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  // ADDED: State variables for language selection
  const [sourceLanguage, setSourceLanguage] = useState<AnalysisLanguage>('auto');
  const [outputLanguage, setOutputLanguage] = useState<AnalysisLanguage>('en');

  // ADDED: Language options array
  const languageOptions = [
    { value: 'auto', label: t('auto_detect') },
    { value: 'en', label: t('english') },
    { value: 'fr', label: t('french') },
    { value: 'es', label: t('spanish') },
    { value: 'ar', label: t('arabic') },
  ];

  useEffect(() => {
    if (defaultJurisdictions && defaultJurisdictions.length > 0) {
      setSelectedJurisdictions(defaultJurisdictions);
    } else {
      setSelectedJurisdictions([]);
    }
  }, [defaultJurisdictions]);

  // Determine current file count
  const currentFileCount = contracts.length;
  // Determine max allowed files based on subscription, default to a very high number if no quota
  const maxAllowedFiles = subscription?.max_files || Infinity;
  // ADDED: Get total single-use credits
  const creditsRemaining = getTotalSingleUseCredits();

  // Determine if the user can upload based on available credits OR subscription quota
  const canUpload = !uploading && (
    (creditsRemaining > 0 && !loadingOrders) || // MODIFIED: Use creditsRemaining
    (subscription && !loadingSubscription && currentFileCount < maxAllowedFiles)
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
          droppedFile.name.endsWith('.doc')) {
        setFile(droppedFile);
      } else {
        alert(t('unsupported_file_type_alert'));
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === 'application/pdf' ||
          selectedFile.name.endsWith('.docx') ||
          selectedFile.name.endsWith('.doc')) {
        setFile(selectedFile);
      } else {
        alert(t('unsupported_file_type_alert'));
        e.target.value = '';
      }
    }
  };

  const handleBrowseFilesClick = () => {
    fileInputRef.current?.click();
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
      // Dynamically import pdfjs-dist
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'; // Set workerSrc here
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map(item => item.str).join(' ') + '\n';
      }
      return fullText;
    } else if (fileExtension === 'docx' || fileExtension === 'doc') {
      // Dynamically import mammoth
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
      return result.value;
    } else {
      throw new Error(t('unsupported_file_type_for_text_extraction'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canUpload) {
      // MODIFIED: Removed specific alerts here as the blue box will show status
      alert(t('cannot_upload_no_credits_or_subscription'));
      return;
    }
    if (file && selectedJurisdictions.length > 0) {
      setUploading(true);
      onUploadStatusChange(true);
      try {
        const contractText = await extractTextFromFile(file);
        
        const newContractId = await addContract({
          file,
          jurisdictions: selectedJurisdictions,
          contractText,
          sourceLanguage,
          outputLanguage,
        });
        
        alert(t('contract_uploaded_analysis_initiated'));
        refetchContracts();
        
        if (newContractId) {
          navigate(`/dashboard?contractId=${newContractId}`);
        }

        setFile(null);
        setSelectedJurisdictions([]);
        setSourceLanguage('auto');
        setOutputLanguage('en');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error: any) {
        // MODIFIED: Check for specific PDF.js worker error and provide a generic translated message
        let errorMessage = error.message || t('failed_to_upload_contract_or_extract_text', { message: error.message });
        if (errorMessage.includes('Setting up fake worker failed') || errorMessage.includes('Failed to fetch dynamically imported module')) {
          errorMessage = t('error_pdf_processing_failed');
        }
        alert(errorMessage);
        console.error('Upload failed:', error);
      } finally {
        setUploading(false);
        onUploadStatusChange(false);
      }
    } else {
      alert(t('select_file_and_jurisdiction_alert'));
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('upload_new_contract')}</h2>
      
      {/* ADDED: Blue Alert Box for Credits/Subscription Status */}
      {(loadingOrders || loadingSubscription) ? (
        <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-700 p-4 mb-6" role="alert">
          <div className="flex items-center">
            <Sparkles className="h-5 w-5 mr-3 flex-shrink-0" />
            <div>
              <p className="font-bold">{t('checking_status')}</p>
              <p className="text-sm">{t('checking_credits_subscription_status')}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-700 p-4 mb-6" role="alert">
          <div className="flex items-center">
            <Sparkles className="h-5 w-5 mr-3 flex-shrink-0" />
            <div>
              {subscription && (subscription.status === 'active' || subscription.status === 'trialing') ? (
                <>
                  <p className="font-bold">{t('active_subscription')}</p>
                  <p className="text-sm">
                    {subscription.max_files === Infinity ? t('unlimited_files_message') : t('subscription_files_remaining', { count: maxAllowedFiles - currentFileCount, maxFiles: maxAllowedFiles })}
                  </p>
                </>
              ) : creditsRemaining > 0 ? (
                <>
                  <p className="font-bold">{t('single_use_credits_available')}</p>
                  <p className="text-sm">{t('credits_remaining_message', { count: creditsRemaining })}</p>
                </>
              ) : (
                <>
                  <p className="font-bold">{t('no_active_plan')}</p>
                  <p className="text-sm">
                    {t('no_active_plan_message')} <Link to="/pricing" className="font-medium underline">{t('pricing_page')}</Link>.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* File Retention Policy Message */}
     <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-700 p-4 mb-6" role="alert">
        <p className="font-bold">{t('important_data_retention_policy')}</p>
        <p className="text-sm">
          {t('single_use_retention_policy')}
          {t('subscription_retention_policy')}
          {t('max_files_storage_limit_policy', { maxProfessional: 200, maxEnterprise: 1000 })}
          <Link to="/contracts" className="font-medium underline">{t('contracts_page')}</Link>.
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
              <p className="text-sm text-gray-700 font-medium">{t('drag_and_drop_file_here')}</p>
              <p className="text-xs text-gray-500 mt-1">{t('supports_pdf_docx_doc_formats')}</p>

              <div className="mt-4">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleBrowseFilesClick}
                    disabled={!canUpload}
                  >
                    {t('browse_files')}
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
            {t('select_jurisdictions')}
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
                {t(getJurisdictionLabel(jurisdiction))}
              </button>
            ))}
          </div>
        </div>

        {/* ADDED: Document Language Selection */}
        <div className="mt-4">
          <label htmlFor="sourceLanguage" className="block text-sm font-medium text-gray-700 mb-2">
            {t('document_language')}
          </label>
          <select
            id="sourceLanguage"
            name="sourceLanguage"
            value={sourceLanguage}
            onChange={(e) => setSourceLanguage(e.target.value as AnalysisLanguage)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            disabled={!canUpload}
          >
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">{t('document_language_hint')}</p>
        </div>

        {/* ADDED: Analysis Output Language Selection */}
        <div className="mt-4">
          <label htmlFor="outputLanguage" className="block text-sm font-medium text-gray-700 mb-2">
            {t('analysis_output_language')}
          </label>
          <select
            id="outputLanguage"
            name="outputLanguage"
            value={outputLanguage}
            onChange={(e) => setOutputLanguage(e.target.value as AnalysisLanguage)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            disabled={!canUpload}
          >
            {languageOptions.filter(opt => opt.value !== 'auto').map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">{t('analysis_output_language_hint')}</p>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            type="submit"
            variant="primary"
            disabled={!file || selectedJurisdictions.length === 0 || uploading || !canUpload}
            icon={<Upload className="w-4 h-4" />}
          >
            {uploading ? t('uploading') : t('upload_contract_button')}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ContractUpload;