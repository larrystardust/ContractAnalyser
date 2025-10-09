import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, AlertTriangle, Sparkles } from 'lucide-react';
import Button from '../ui/Button';
import { getAllJurisdictions, getJurisdictionLabel } from '../../utils/jurisdictionUtils';
import { Jurisdiction, AnalysisLanguage } from '../../types';
import { useContracts } from '../../context/ContractContext';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// Dynamically import pdfjs-dist and mammoth
const loadPdfjs = async () => {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  return pdfjsLib;
};

const loadMammoth = async () => {
  return await import('mammoth');
};

interface ContractUploadProps {
  onUploadStatusChange: (status: boolean) => void;
  defaultJurisdictions: Jurisdiction[];
  capturedImageData: string | null; // ADDED: Prop for captured image data
  setCapturedImageData: (data: string | null) => void; // ADDED: Prop to clear captured image
  canPerformOcrAndAnalysis: boolean; // ADDED: Credit status
  canPerformOcr: boolean; // ADDED: Credit status
  canPerformAnalysis: boolean; // ADDED: Credit status
  ocrCost: number; // ADDED: OCR credit cost
  analysisCost: number; // ADDED: Analysis credit cost
}

const ContractUpload: React.FC<ContractUploadProps> = ({
  onUploadStatusChange,
  defaultJurisdictions,
  capturedImageData, // Destructure new prop
  setCapturedImageData, // Destructure new prop
  canPerformOcrAndAnalysis,
  canPerformOcr,
  canPerformAnalysis,
  ocrCost,
  analysisCost,
}) => {
  const { addContract, refetchContracts } = useContracts();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedJurisdictions, setSelectedJurisdictions] = useState<Jurisdiction[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [sourceLanguage, setSourceLanguage] = useState<AnalysisLanguage>('auto');
  const [outputLanguage, setOutputLanguage] = useState<AnalysisLanguage>('en');
  const [performOcr, setPerformOcr] = useState(false); // ADDED: State to control OCR
  const [performAnalysis, setPerformAnalysis] = useState(true); // ADDED: State to control Analysis

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

  // Effect to handle captured image data
  useEffect(() => {
    if (capturedImageData) {
      // If image data is present, automatically select OCR option
      setPerformOcr(true);
      // If enough credits, also select analysis
      if (canPerformOcrAndAnalysis) {
        setPerformAnalysis(true);
      } else {
        setPerformAnalysis(false); // Disable analysis if not enough credits for both
      }
    } else {
      setPerformOcr(false);
      setPerformAnalysis(true); // Default to analysis for file uploads
    }
  }, [capturedImageData, canPerformOcrAndAnalysis]);

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
          droppedFile.name.endsWith('.doc') ||
          droppedFile.type.startsWith('image/')) { // MODIFIED: Allow image files
        setFile(droppedFile);
        setCapturedImageData(null); // Clear captured image if a file is dropped
        // If an image file is dropped, enable OCR by default
        if (droppedFile.type.startsWith('image/')) {
          setPerformOcr(true);
          if (canPerformOcrAndAnalysis) {
            setPerformAnalysis(true);
          } else {
            setPerformAnalysis(false);
          }
        } else {
          setPerformOcr(false);
          setPerformAnalysis(true);
        }
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
          selectedFile.name.endsWith('.doc') ||
          selectedFile.type.startsWith('image/')) { // MODIFIED: Allow image files
        setFile(selectedFile);
        setCapturedImageData(null); // Clear captured image if a file is selected
        // If an image file is selected, enable OCR by default
        if (selectedFile.type.startsWith('image/')) {
          setPerformOcr(true);
          if (canPerformOcrAndAnalysis) {
            setPerformAnalysis(true);
          } else {
            setPerformAnalysis(false);
          }
        } else {
          setPerformOcr(false);
          setPerformAnalysis(true);
        }
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
    setCapturedImageData(null); // Clear captured image
    setPerformOcr(false); // Reset OCR state
    setPerformAnalysis(true); // Reset Analysis state
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
      const pdfjsLib = await loadPdfjs();
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
      const mammoth = await loadMammoth();
      const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
      return result.value;
    } else {
      throw new Error(t('unsupported_file_type_for_text_extraction'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let currentCreditCost = 0;
    if (performOcr) currentCreditCost += ocrCost;
    if (performAnalysis) currentCreditCost += analysisCost;

    // Frontend credit check
    if (!canPerformOcrAndAnalysis && performOcr && performAnalysis) {
      alert(t('not_enough_credits_for_ocr_analysis', { cost: ocrCost + analysisCost }));
      return;
    }
    if (!canPerformOcr && performOcr && !performAnalysis) {
      alert(t('not_enough_credits_for_ocr', { cost: ocrCost }));
      return;
    }
    if (!canPerformAnalysis && !performOcr && performAnalysis) {
      alert(t('not_enough_credits_for_analysis', { cost: analysisCost }));
      return;
    }
    if (currentCreditCost === 0) {
      alert(t('select_ocr_or_analysis'));
      return;
    }

    if ((file || capturedImageData) && selectedJurisdictions.length > 0) {
      setUploading(true);
      onUploadStatusChange(true);
      try {
        let contractText = '';
        let fileName = '';
        let fileSize = '';
        let fileType = '';

        if (capturedImageData) {
          // For captured image, no local text extraction needed, OCR will happen on backend
          fileName = `scanned_document_${Date.now()}.jpeg`;
          fileSize = 'N/A'; // Size is not easily determined from Base64 without decoding
          fileType = 'image/jpeg';
        } else if (file) {
          fileName = file.name;
          fileSize = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
          fileType = file.type;

          // If it's a document file (PDF/DOCX) and OCR is NOT selected, extract text locally
          if (!performOcr && (file.type === 'application/pdf' || file.name.endsWith('.docx') || file.name.endsWith('.doc'))) {
            contractText = await extractTextFromFile(file);
          }
          // If it's an image file, or OCR is selected for a document, text extraction will happen on backend
        }

        const newContractId = await addContract({
          file: file || undefined, // Pass file if available
          imageData: capturedImageData || undefined, // Pass image data if available
          fileName,
          fileSize,
          fileType,
          jurisdictions: selectedJurisdictions,
          contractText, // This will be empty if OCR is performed on backend
          sourceLanguage,
          outputLanguage,
          performOcr, // Pass OCR flag
          performAnalysis, // Pass Analysis flag
          creditCost: currentCreditCost, // Pass calculated credit cost
        });
        
        alert(t('contract_uploaded_analysis_initiated'));
        refetchContracts();
        
        if (newContractId) {
          navigate(`/dashboard?contractId=${newContractId}`);
        }

        setFile(null);
        setCapturedImageData(null); // Clear captured image after successful upload
        setSelectedJurisdictions([]);
        setSourceLanguage('auto');
        setOutputLanguage('en');
        setPerformOcr(false); // Reset OCR state
        setPerformAnalysis(true); // Reset Analysis state
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error: any) {
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

  const isImageFileSelected = file && file.type.startsWith('image/');
  const isDocumentFileSelected = file && (file.type === 'application/pdf' || file.name.endsWith('.docx') || file.name.endsWith('.doc'));
  const isAnyInputSelected = file || capturedImageData;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('upload_new_contract')}</h2>
      
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
            ${isAnyInputSelected ? 'bg-gray-100' : ''}
            transition-colors duration-200`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {!isAnyInputSelected ? (
            <>
              <Upload className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-sm text-gray-700 font-medium">{t('drag_and_drop_file_here')}</p>
              <p className="text-xs text-gray-500 mt-1">{t('supports_pdf_docx_doc_image_formats')}</p> {/* MODIFIED */}

              <div className="mt-4">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleBrowseFilesClick}
                    disabled={uploading}
                  >
                    {t('browse_files')}
                  </Button>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="sr-only"
                    accept=".pdf,.doc,.docx,image/*" // MODIFIED: Accept image files
                    onChange={handleFileInput}
                    ref={fileInputRef}
                    disabled={uploading}
                  />
                </label>
              </div>
            </>
          ) : (
            <div className="w-full">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    {capturedImageData ? <Camera className="h-5 w-5 text-blue-900" /> : <Upload className="h-5 w-5 text-blue-900" />}
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-700">{file?.name || t('captured_image')}</p> {/* MODIFIED */}
                    <p className="text-xs text-gray-500">{file?.size ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : 'N/A'}</p> {/* MODIFIED */}
                  </div>
                </div>
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-500"
                  onClick={removeFile}
                  disabled={uploading}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {capturedImageData && (
                <div className="mt-4">
                  <img src={capturedImageData} alt={t('captured_document_preview')} className="max-w-full h-auto rounded-lg" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* OCR and Analysis Options */}
        {isAnyInputSelected && (
          <div className="mt-6 p-4 border border-gray-200 rounded-md bg-gray-50">
            <h3 className="text-md font-semibold text-gray-800 mb-3">{t('processing_options')}</h3>
            <div className="space-y-3">
              {/* Perform OCR Checkbox */}
              <div>
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    className="form-checkbox h-5 w-5 text-blue-600"
                    checked={performOcr}
                    onChange={(e) => setPerformOcr(e.target.checked)}
                    disabled={uploading || !canPerformOcr || isDocumentFileSelected} // Disable if not enough credits or if it's a document file (OCR is implicit for images)
                  />
                  <span className="ml-2 text-gray-700">
                    {t('perform_ocr')} ({ocrCost} {t('credits')})
                  </span>
                </label>
                {!canPerformOcr && (
                  <p className="text-xs text-red-500 ml-7">{t('not_enough_credits_for_ocr', { cost: ocrCost })}</p>
                )}
                {isDocumentFileSelected && (
                  <p className="text-xs text-gray-500 ml-7">{t('ocr_not_needed_for_documents')}</p>
                )}
              </div>

              {/* Perform Analysis Checkbox */}
              <div>
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    className="form-checkbox h-5 w-5 text-blue-600"
                    checked={performAnalysis}
                    onChange={(e) => setPerformAnalysis(e.target.checked)}
                    disabled={uploading || !canPerformAnalysis} // Disable if not enough credits
                  />
                  <span className="ml-2 text-gray-700">
                    {t('perform_analysis')} ({analysisCost} {t('credits')})
                  </span>
                </label>
                {!canPerformAnalysis && (
                  <p className="text-xs text-red-500 ml-7">{t('not_enough_credits_for_analysis', { cost: analysisCost })}</p>
                )}
              </div>
            </div>
          </div>
        )}

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
                disabled={uploading}
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
            disabled={uploading}
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
            disabled={uploading}
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
            disabled={!isAnyInputSelected || selectedJurisdictions.length === 0 || uploading || (!performOcr && !performAnalysis)}
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