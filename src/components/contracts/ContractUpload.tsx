import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, AlertTriangle, Sparkles, Camera, FileText } from 'lucide-react';
import Button from '../ui/Button';
import { getAllJurisdictions, getJurisdictionLabel } from '../../utils/jurisdictionUtils';
import { Jurisdiction, AnalysisLanguage } from '../../types';
import { useContracts } from '../../context/ContractContext';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSubscription } from '../../hooks/useSubscription'; // ADDED: Import useSubscription
import { useUserOrders } from '../../hooks/useUserOrders'; // ADDED: Import useUserOrders

// Dynamically import pdfjs-dist and mammoth
const loadPdfjs = async () => {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  return pdfjsLib;
};

const loadMammoth = async () => {
  return await import('mammoth');
};

// Define the structure for a captured image (must match UploadPage.tsx)
interface CapturedImage {
  id: string;
  data: string; // Base64 string
}

interface ContractUploadProps {
  onUploadStatusChange: (status: boolean) => void;
  defaultJurisdictions: Jurisdiction[];
  capturedImages: File[]; // MODIFIED: Array of File objects
  setCapturedImages: (data: File[]) => void; // MODIFIED: Accepts array of File objects
  selectedFiles: File[];
  setSelectedFiles: (files: File[]) => void;
  // MODIFIED: Updated credit checks and costs
  ocrCost: number;
  basicAnalysisCost: number;
  advancedAnalysisAddonCost: number;
  showProcessingOptions: boolean; // ADDED: New prop for visibility
}

const ContractUpload: React.FC<ContractUploadProps> = ({
  onUploadStatusChange,
  defaultJurisdictions,
  capturedImages,
  setCapturedImages,
  selectedFiles,
  setSelectedFiles,
  // MODIFIED: Destructure new credit checks and costs
  ocrCost,
  basicAnalysisCost,
  advancedAnalysisAddonCost,
  showProcessingOptions, // ADDED: Destructure new prop
}) => {
  const { addContract, refetchContracts } = useContracts();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedJurisdictions, setSelectedJurisdictions] = useState<Jurisdiction[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { subscription, loading: loadingSubscription } = useSubscription(); // ADDED: Use subscription hook
  const { getTotalSingleUseCredits } = useUserOrders(); // ADDED: Use user orders hook

  const [sourceLanguage, setSourceLanguage] = useState<AnalysisLanguage>('auto');
  const [outputLanguage, setOutputLanguage] = useState<AnalysisLanguage>('en');
  const [performOcr, setPerformOcr] = useState(false);
  const [performAnalysis, setPerformAnalysis] = useState(true);
  const [performAdvancedAnalysis, setPerformAdvancedAnalysis] = useState(false); // ADDED: New state for advanced analysis

  // ADDED: State for managing drag and drop reordering
  const [draggedItemIndex, setDraggedItemIndex, ] = useState<number | null>(null);
  const [draggedItemType, setDraggedItemType] = useState<'file' | 'image' | null>(null);

  // ADDED: State to track if any document files (pdf, docx, doc) are selected
  const [hasDocumentFiles, setHasDocumentFiles] = useState(false);

  const languageOptions = [
    { value: 'auto', label: t('auto_detect') },
    { value: 'en', label: t('english') },
    { value: 'fr', label: t('french') },
    { value: 'es', label: t('spanish') },
    { value: 'ar', label: t('arabic') },
  ];

  // ADDED: Determine if user has an advanced subscription plan
  const isAdvancedSubscription = subscription && (subscription.tier === 4 || subscription.tier === 5);
  const isBasicSubscription = subscription && (subscription.tier === 2 || subscription.tier === 3);
  const availableCredits = getTotalSingleUseCredits();

  // MODIFIED: Recalculate canPerformOcr, canPerformBasicAnalysis, canPerformAdvancedAddon based on new logic
  const canPerformOcr = isAdvancedSubscription || isBasicSubscription || availableCredits >= ocrCost;
  const canPerformBasicAnalysis = isAdvancedSubscription || isBasicSubscription || availableCredits >= basicAnalysisCost;
  const canPerformAdvancedAddon = isAdvancedSubscription || availableCredits >= advancedAnalysisAddonCost;


  useEffect(() => {
    if (defaultJurisdictions && defaultJurisdictions.length > 0) {
      setSelectedJurisdictions(defaultJurisdictions);
    } else {
      setSelectedJurisdictions([]);
    }
  }, [defaultJurisdictions]);

  // Effect to determine processing options and document type
  useEffect(() => {
    const currentSelectedFiles = Array.isArray(selectedFiles) ? selectedFiles : [];
    const currentCapturedImages = Array.isArray(capturedImages) ? capturedImages : [];

    const anyImageInput = currentCapturedImages.length > 0 || currentSelectedFiles.some(f => f.type.startsWith('image/'));
    const anyDocumentFile = currentSelectedFiles.some(f => f.type === 'application/pdf' || f.name.endsWith('.docx') || f.name.endsWith('.doc'));

    setHasDocumentFiles(anyDocumentFile); // Set the new state

    if (anyImageInput) {
      setPerformOcr(true);
      setPerformAnalysis(true); // Always perform basic analysis if OCR is needed
      setPerformAdvancedAnalysis(isAdvancedSubscription); // Auto-check if advanced subscription
    } else if (anyDocumentFile) {
      setPerformOcr(false);
      setPerformAnalysis(true);
      setPerformAdvancedAnalysis(isAdvancedSubscription); // Auto-check if advanced subscription
    } else {
      setPerformOcr(false);
      setPerformAnalysis(true);
      setPerformAdvancedAnalysis(isAdvancedSubscription); // Auto-check if advanced subscription
    }
  }, [capturedImages, selectedFiles, isAdvancedSubscription]); // MODIFIED: Added isAdvancedSubscription to dependencies

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
    e.preventDefault(); // Necessary to allow dropping
    e.stopPropagation(); // Prevent propagation to parent elements
    e.dataTransfer.dropEffect = 'move';
  };

  const processNewFiles = (incomingFiles: File[]) => {
    const supportedFiles = incomingFiles.filter(file =>
      file.type === 'application/pdf' ||
      file.name.endsWith('.docx') ||
      file.name.endsWith('.doc') ||
      file.type.startsWith('image/')
    );

    if (supportedFiles.length === 0) {
      alert(t('unsupported_file_type_alert'));
      return;
    }

    const newImageFiles = supportedFiles.filter(f => f.type.startsWith('image/'));
    const newDocumentFiles = supportedFiles.filter(f => f.type === 'application/pdf' || f.name.endsWith('.docx') || f.name.endsWith('.doc'));

    const currentSelectedImageFiles = selectedFiles.filter(f => f.type.startsWith('image/'));
    const currentSelectedDocumentFiles = selectedFiles.filter(f => f.type === 'application/pdf' || f.name.endsWith('.docx') || f.name.endsWith('.doc'));
    const currentCapturedImages = capturedImages; // These are always images

    // Determine if there are any existing image or document inputs
    const hasExistingImageInput = currentSelectedImageFiles.length > 0 || currentCapturedImages.length > 0;
    const hasExistingDocumentInput = currentSelectedDocumentFiles.length > 0;

    // --- Validation Logic ---

    // Scenario 1: New files contain both images and documents
    if (newImageFiles.length > 0 && newDocumentFiles.length > 0) {
      alert(t('cannot_mix_image_document_files'));
      return;
    }

    // Scenario 2: New files are images, but existing inputs are documents
    if (newImageFiles.length > 0 && hasExistingDocumentInput) {
      alert(t('cannot_mix_image_document_files'));
      return;
    }

    // Scenario 3: New files are documents, but existing inputs are images
    if (newDocumentFiles.length > 0 && hasExistingImageInput) {
      alert(t('cannot_mix_image_document_files'));
      return;
    }

    // Scenario 4: Multiple document files in the new batch
    if (newDocumentFiles.length > 1) {
      alert(t('only_one_document_allowed'));
      return;
    }

    // Scenario 5: A single document file is being added, but a document file already exists
    if (newDocumentFiles.length === 1 && hasExistingDocumentInput) {
      alert(t('only_one_document_allowed'));
      return;
    }

    // --- Update State Based on Validated Input ---

    if (newDocumentFiles.length === 1) {
      // If a single document is valid, it replaces everything else
      setSelectedFiles([newDocumentFiles[0]]);
      setCapturedImages([]); // Clear any captured images
    } else if (newImageFiles.length > 0) {
      // If new images are valid, add them to existing selected images (if any)
      setSelectedFiles(prev => [...currentSelectedImageFiles, ...newImageFiles]);
      setCapturedImages([]); // Clear captured images if files are selected via input/drop
    } else if (supportedFiles.length > 0 && !hasExistingDocumentInput && !hasExistingImageInput) {
      // This case handles adding images when no files were previously selected
      setSelectedFiles(supportedFiles);
      setCapturedImages([]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processNewFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processNewFiles(Array.from(e.target.files));
      e.target.value = ''; // Clear input to allow re-selection of same files
    }
  };

  const handleBrowseFilesClick = () => {
    fileInputRef.current?.click();
  };

  const removeInput = (idToRemove: string, type: 'file' | 'image') => {
    if (type === 'file') {
      setSelectedFiles(prev => (Array.isArray(prev) ? prev.filter((file) => `${file.name}-${file.size}` !== idToRemove) : []));
    } else {
      setCapturedImages(prev => (Array.isArray(prev) ? prev.filter((image) => image.name !== idToRemove) : [])); // MODIFIED: Filter by image.name
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
    if (performAnalysis) {
      currentCreditCost += basicAnalysisCost; // MODIFIED: Use basicAnalysisCost
      if (performAdvancedAnalysis && !isAdvancedSubscription) { // ADDED: Only add cost if not on advanced plan
        currentCreditCost += advancedAnalysisAddonCost;
      }
    }

    // MODIFIED: Update credit checks for submission
    if (!performOcr && !performAnalysis) {
      alert(t('select_ocr_or_analysis'));
      return;
    }
    if (performOcr && !canPerformOcr) {
      alert(t('not_enough_credits_for_ocr', { cost: ocrCost }));
      return;
    }
    if (performAnalysis && !canPerformBasicAnalysis) {
      alert(t('not_enough_credits_for_analysis', { cost: basicAnalysisCost }));
      return;
    }
    if (performAdvancedAnalysis && !isAdvancedSubscription && !canPerformAdvancedAddon) { // MODIFIED: Check if not advanced sub AND not enough credits
      alert(t('not_enough_credits_for_advanced_analysis', { cost: advancedAnalysisAddonCost }));
      return;
    }


    const allInputs = [...(Array.isArray(selectedFiles) ? selectedFiles : []), ...(Array.isArray(capturedImages) ? capturedImages : [])]; // Defensive spread
    if (allInputs.length === 0 || selectedJurisdictions.length === 0) {
      alert(t('select_file_and_jurisdiction_alert'));
      return;
    }

    setUploading(true);
    onUploadStatusChange(true);
    try {
      let contractText = '';
      let fileName = '';
      let fileSize = '';
      let fileType = '';
      let filesToUpload: File[] = [];
      let imageDatasToProcess: string[] = [];

      if (capturedImages.length > 0) {
        // For captured images, OCR will happen on backend
        fileName = `${t('scanned_document_prefix')}_${Date.now()}.jpeg`;
        fileSize = t('not_applicable');
        fileType = 'image/jpeg';
        
        // Convert captured image files to Base64 for the Edge Function
        for (const imageFile of capturedImages) {
          imageDatasToProcess.push(await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              if (typeof reader.result === 'string') {
                resolve(reader.result.split(',')[1]); // Extract Base64 part
              } else {
                reject(new Error('Failed to read file as Base64.'));
              }
            };
            reader.onerror = reject;
            reader.readAsDataURL(imageFile);
          }));
          filesToUpload.push(imageFile); // Add the actual File object to filesToUpload
        }
      } else if (selectedFiles.length > 0) {
        // For uploaded files
        // If multiple files, name them as "Multi-page Contract"
        fileName = selectedFiles.length > 1 ? `${t('multi_page_contract_prefix')}_${Date.now()}` : selectedFiles[0].name;
        fileSize = selectedFiles.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024) + ` ${t('megabytes_unit')}`;
        fileType = selectedFiles[0].type; // Take type of first file, or generalize

        // Separate files into those needing OCR and those providing text directly
        for (const file of selectedFiles) {
          if (file.type.startsWith('image/')) {
            imageDatasToProcess.push(await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                  resolve(reader.result.split(',')[1]); // Extract Base64 part
                } else {
                  reject(new Error('Failed to read file as Base64.'));
                }
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            }));
            filesToUpload.push(file); // Still upload image files to storage
          } else if (!performOcr && (file.type === 'application/pdf' || file.name.endsWith('.docx') || file.name.endsWith('.doc'))) {
            // If it's a document and OCR is NOT selected, extract text locally
            contractText += await extractTextFromFile(file) + '\n\n';
            filesToUpload.push(file);
          } else {
            // If it's a document and OCR IS selected, or other file types, upload it
            filesToUpload.push(file);
          }
        }
      }

      const newContractId = await addContract({
        files: filesToUpload.length > 0 ? filesToUpload : undefined, // Pass files if available
        imageDatas: imageDatasToProcess.length > 0 ? imageDatasToProcess : undefined, // Pass image data if available
        fileName,
        fileSize,
        fileType,
        jurisdictions: selectedJurisdictions,
        contractText, // This will be empty if OCR is performed on backend
        sourceLanguage,
        outputLanguage,
        performOcr, // Pass OCR flag
        performAnalysis, // Pass Analysis flag
        performAdvancedAnalysis, // ADDED: Pass new flag
        creditCost: currentCreditCost, // Pass calculated credit cost
      });
      
      alert(t('contract_uploaded_analysis_initiated'));
      refetchContracts();
      
      if (newContractId) {
        navigate(`/dashboard?contractId=${newContractId}`);
      }

      setSelectedFiles([]); // Clear selected files
      setCapturedImages([]); // Clear captured images
      setSelectedJurisdictions([]);
      setSourceLanguage('auto');
      setOutputLanguage('en');
      setPerformOcr(false); // Reset OCR state
      setPerformAnalysis(true); // Reset Analysis state
      setPerformAdvancedAnalysis(false); // ADDED: Reset advanced analysis state
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
  };

  const isAnyInputSelected = capturedImages.length > 0 || selectedFiles.length > 0;
  const hasImageInput = capturedImages.length > 0 || selectedFiles.some(f => f.type.startsWith('image/'));
  // hasDocumentFiles is already calculated in useEffect

  // Drag and Drop functions
  const reorder = (list: any[], startIndex: number, endIndex: number) => {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
  };

  const handleDragStart = (e: React.DragEvent, index: number, type: 'file' | 'image') => {
    setDraggedItemIndex(index);
    setDraggedItemType(type);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ index, type })); // MODIFIED: Store index and type
  };

  const handleDropReorder = (e: React.DragEvent, dropIndex: number, dropType: 'file' | 'image') => {
    e.preventDefault();
    e.stopPropagation(); // Ensure event doesn't bubble to parent drop zone

    const data = e.dataTransfer.getData('text/plain');
    if (!data) return; // No data means it's not our draggable item

    const { index: draggedIndex, type: draggedType } = JSON.parse(data); // MODIFIED: Parse data

    if (draggedIndex === null || draggedType === null || draggedType !== dropType) {
      return; // Only reorder items of the same type
    }

    if (draggedType === 'file') { // MODIFIED: Use draggedType
      const reorderedFiles = reorder(selectedFiles, draggedIndex, dropIndex); // MODIFIED: Use draggedIndex
      setSelectedFiles(reorderedFiles);
    } else if (draggedType === 'image') { // MODIFIED: Use draggedType
      const reorderedImages = reorder(capturedImages, draggedIndex, dropIndex); // MODIFIED: Use draggedIndex
      setCapturedImages(reorderedImages);
    }

    setDraggedItemIndex(null);
    setDraggedItemType(null);
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
    setDraggedItemType(null);
  };


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
          {/* MODIFIED: Condition for showing browse files button */}
          {!hasDocumentFiles ? (
            <>
              <Upload className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-sm text-gray-700 font-medium">{t('drag_and_drop_file_here')}</p>
              <p className="text-xs text-gray-500 mt-1">{t('supports_pdf_docx_doc_image_formats')}</p>

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
                    multiple
                    className="sr-only"
                    accept=".pdf,.doc,.docx,image/*"
                    onChange={handleFileInput}
                    ref={fileInputRef}
                    disabled={uploading}
                  />
                </label>
              </div>
            </>
          ) : (
            // This block is shown if a document file is selected, hiding the browse button
            <div className="w-full text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-700 font-medium">{t('document_selected_for_upload')}</p>
              <p className="text-xs text-gray-500 mt-1">{t('only_one_document_at_a_time')}</p>
            </div>
          )}

          {/* Display selected files and captured images for reordering */}
          {isAnyInputSelected && (
            <div className="w-full mt-6">
              <p className="text-sm text-gray-700 font-medium mb-3">{t('selected_files_for_upload')}:</p>
              {/* ADDED: Re-ordering instruction message */}
              <p className="text-xs text-gray-500 mb-3">{t('reorder_pages_message')}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedFiles.map((file, index) => (
                  <div
                    key={`file-${file.name}-${file.size}`} // Use file name and size for a more stable key
                    draggable="true"
                    onDragStart={(e) => handleDragStart(e, index, 'file')}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropReorder(e, index, 'file')}
                    onDragEnd={handleDragEnd}
                    className={`relative group flex items-center p-2 border border-gray-300 rounded-md bg-white
                      ${draggedItemIndex === index && draggedItemType === 'file' ? 'opacity-50 border-blue-500' : ''}
                      ${hasDocumentFiles ? 'cursor-not-allowed' : 'cursor-grab'}
                    `}
                  >
                    <FileText className="h-5 w-5 text-blue-900 mr-2 flex-shrink-0" />
                    <span className="text-sm text-gray-700 truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeInput(`${file.name}-${file.size}`, 'file')} // MODIFIED: Pass unique ID
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      title={t('remove_file')}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {capturedImages.map((image, index) => (
                  <div
                    key={image.name} // MODIFIED: Use image.name as key
                    draggable="true"
                    onDragStart={(e) => handleDragStart(e, index, 'image')}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropReorder(e, index, 'image')}
                    onDragEnd={handleDragEnd}
                    className={`relative group
                      ${draggedItemIndex === index && draggedItemType === 'image' ? 'opacity-50 border-blue-500' : ''}
                      cursor-grab
                    `}
                  >
                    <img src={URL.createObjectURL(image)} alt={`${t('captured_page')} ${index + 1}`} className="w-full h-auto rounded-md border border-gray-300" /> {/* MODIFIED: Create object URL */}
                    <button
                      type="button"
                      onClick={() => removeInput(image.name, 'image')} // MODIFIED: Pass image.name
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      title={t('remove_image')}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              {/* Only show this prompt if there are image inputs */}
              {(capturedImages.length > 0 || selectedFiles.some(f => f.type.startsWith('image/'))) && (
                <p className="text-sm text-gray-500 mt-4">
                  {t('ensure_all_pages_scanned_uploaded')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Processing Options */}
        {showProcessingOptions && isAnyInputSelected && ( // MODIFIED: Conditionally render based on showProcessingOptions
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
                    disabled={uploading || !canPerformOcr || !hasImageInput}
                  />
                  <span className="ml-2 text-gray-700">
                    {t('perform_ocr')} ({ocrCost} {t('credits')})
                  </span>
                </label>
                {!canPerformOcr && (
                  <p className="text-xs text-red-500 ml-7">{t('not_enough_credits_for_ocr', { cost: ocrCost })}</p>
                )}
                {!hasImageInput && (
                  <p className="text-xs text-gray-500 ml-7">{t('ocr_only_for_images')}</p>
                )}
              </div>

              {/* Perform Analysis Checkbox */}
              <div>
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    className="form-checkbox h-5 w-5 text-blue-600"
                    checked={performAnalysis}
                    onChange={(e) => {
                      setPerformAnalysis(e.target.checked);
                      if (!e.target.checked) {
                        setPerformAdvancedAnalysis(false); // Disable advanced if basic analysis is unchecked
                      }
                    }}
                    disabled={uploading || !canPerformBasicAnalysis} // MODIFIED: Use canPerformBasicAnalysis
                  />
                  <span className="ml-2 text-gray-700">
                    {t('perform_analysis')} ({basicAnalysisCost} {t('credits')}) {/* MODIFIED: Use basicAnalysisCost */}
                  </span>
                </label>
                {!canPerformBasicAnalysis && ( // MODIFIED: Use canPerformBasicAnalysis
                  <p className="text-xs text-red-500 ml-7">{t('not_enough_credits_for_analysis', { cost: basicAnalysisCost })}</p>
                )}
              </div>

              {/* ADDED: Perform Advanced Analysis Checkbox */}
              <div>
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    className="form-checkbox h-5 w-5 text-blue-600"
                    checked={performAdvancedAnalysis}
                    onChange={(e) => setPerformAdvancedAnalysis(e.target.checked)}
                    disabled={uploading || isAdvancedSubscription || !performAnalysis || !canPerformAdvancedAddon} // MODIFIED: Disabled if basic analysis is not selected or not enough credits
                  />
                  <span className="ml-2 text-gray-700">
                    {t('perform_advanced_analysis')}
                    {!isAdvancedSubscription && ` (${advancedAnalysisAddonCost} ${t('credits')})`} {/* MODIFIED: Only show cost if not advanced sub */}
                  </span>
                </label>
                {!performAnalysis && (
                  <p className="text-xs text-gray-500 ml-7">{t('advanced_analysis_requires_basic')}</p>
                )}
                {!isAdvancedSubscription && performAnalysis && !canPerformAdvancedAddon && ( // Only show this warning if basic analysis is selected
                  <p className="text-xs text-red-500 ml-7">{t('not_enough_credits_for_advanced_analysis', { cost: advancedAnalysisAddonCost })}</p>
                )}
                {isAdvancedSubscription && (
                  <p className="text-xs text-gray-500 ml-7">{t('advanced_analysis_included_in_plan')}</p>
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

        {/* Document Language Selection */}
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

        {/* Analysis Output Language Selection */}
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