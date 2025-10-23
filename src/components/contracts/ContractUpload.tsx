import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, AlertTriangle, Sparkles, Camera, FileText } from 'lucide-react';
import Button from '../ui/Button';
import { getAllJurisdictions, getJurisdictionLabel } from '../../utils/jurisdictionUtils';
import { Jurisdiction, AnalysisLanguage } from '../../types';
import { useContracts } from '../../context/ContractContext';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSubscription } from '../../hooks/useSubscription';
import { useUserOrders } from '../../hooks/useUserOrders';

// Dynamically import pdfjs-dist and mammoth
const loadPdfjs = async () => {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  return pdfjsLib;
};

const loadMammoth = async () => {
  return await import('mammoth');
};

// Define the structure for a captured image
interface CapturedImage {
  id: string;
  data: string; // Base64 string
}

interface ContractUploadProps {
  onUploadStatusChange: (status: boolean) => void;
  defaultJurisdictions: Jurisdiction[];
  capturedImages: File[];
  setCapturedImages: (data: File[]) => void;
  selectedFiles: File[];
  setSelectedFiles: (files: File[]) => void;
  ocrCost: number;
  basicAnalysisCost: number;
  advancedAnalysisAddonCost: number;
  showProcessingOptions: boolean; // This now controls visibility for single-use users
  isAdvancedSubscription: boolean;
  isBasicSubscription: boolean;
  loadingOrders: boolean; // MODIFIED: Added loadingOrders prop
}

const ContractUpload: React.FC<ContractUploadProps> = ({
  onUploadStatusChange,
  defaultJurisdictions,
  capturedImages,
  setCapturedImages,
  selectedFiles,
  setSelectedFiles,
  ocrCost,
  basicAnalysisCost,
  advancedAnalysisAddonCost,
  showProcessingOptions, // This now controls visibility for single-use users
  isAdvancedSubscription,
  isBasicSubscription,
  loadingOrders, // MODIFIED: Destructure loadingOrders
}) => {
  const { addContract, refetchContracts } = useContracts();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedJurisdictions, setSelectedJurisdictions] = useState<Jurisdiction[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { subscription, loading: loadingSubscription } = useSubscription();
  const { getTotalSingleUseCredits } = useUserOrders();

  const [sourceLanguage, setSourceLanguage] = useState<AnalysisLanguage>('auto');
  const [outputLanguage, setOutputLanguage] = useState<AnalysisLanguage>('en');
  // MODIFIED: Default performOcr and performAnalysis to true for subscription users
  const [performOcr, setPerformOcr] = useState(isBasicSubscription || isAdvancedSubscription);
  const [performAnalysis, setPerformAnalysis] = useState(isBasicSubscription || isAdvancedSubscription);
  const [performAdvancedAnalysis, setPerformAdvancedAnalysis] = useState(isAdvancedSubscription); // Default to true for advanced subs

  const [draggedItemIndex, setDraggedItemIndex, ] = useState<number | null>(null);
  const [draggedItemType, setDraggedItemType] = useState<'file' | 'image' | null>(null);

  const [hasDocumentFiles, setHasDocumentFiles] = useState(false);

  const languageOptions = [
    { value: 'auto', label: t('auto_detect') },
    { value: 'en', label: t('english') },
    { value: 'fr', label: t('french') },
    { value: 'es', label: t('spanish') },
    { value: 'ar', label: t('arabic') },
  ];

  const availableCredits = getTotalSingleUseCredits();

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

    setHasDocumentFiles(anyDocumentFile);

    // MODIFIED: Logic for setting initial performOcr, performAnalysis, performAdvancedAnalysis
    // These are internal states that reflect what the backend should do, not necessarily what the user sees.
    if (isAdvancedSubscription) {
      setPerformOcr(true);
      setPerformAnalysis(true);
      setPerformAdvancedAnalysis(true); // Always true for advanced
    } else if (isBasicSubscription) {
      setPerformOcr(true);
      setPerformAnalysis(true);
      setPerformAdvancedAnalysis(false); // Default to false for basic, user can select
    } else { // Single-use user
      // If there are image inputs, OCR and Analysis are mandatory and should be reflected in the state
      setPerformOcr(anyImageInput); // <-- MODIFIED: Set performOcr to true if any image input
      setPerformAnalysis(anyImageInput); // <-- ADDED: Set performAnalysis to true if any image input
      setPerformAdvancedAnalysis(false);
    }
  }, [capturedImages, selectedFiles, isAdvancedSubscription, isBasicSubscription]); // MODIFIED: Removed hasImageInput from dependencies as it's derived here

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
    const currentCapturedImages = capturedImages;

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
      setCapturedImages(prev => (Array.isArray(prev) ? prev.filter((image) => image.name !== idToRemove) : []));
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
    // MODIFIED: Credit calculation logic based on subscription type
    if (!isAdvancedSubscription && !isBasicSubscription) { // Single-use user
      if (performOcr) currentCreditCost += ocrCost; // <-- This now correctly uses the updated performOcr state
      if (performAnalysis) {
        currentCreditCost += basicAnalysisCost;
        if (performAdvancedAnalysis) {
          currentCreditCost += advancedAnalysisAddonCost;
        }
      }
    } else if (isBasicSubscription) { // Basic/Admin-assigned subscription user
      // OCR and basic analysis are included, so only charge for advanced if selected
      if (performAdvancedAnalysis) {
        currentCreditCost = advancedAnalysisAddonCost; // MODIFIED: Set to ADVANCED_ANALYSIS_ADDON_COST (1)
      } else {
        currentCreditCost = 0; // MODIFIED: If advanced not selected, cost is 0
      }
    }
    // For AdvancedSubscription, currentCreditCost remains 0 as everything is included

    console.log(`ContractUpload: DEBUG - Final currentCreditCost calculated: ${currentCreditCost}`);
    console.log(`ContractUpload: DEBUG - isAdvancedSubscription: ${isAdvancedSubscription}, isBasicSubscription: ${isBasicSubscription}, performAdvancedAnalysis: ${performAdvancedAnalysis}`);


    // MODIFIED: Update credit checks for submission
    // For single-use users, check all selected options
    if (!isBasicSubscription && !isAdvancedSubscription) {
      // Ensure at least OCR or Analysis is selected
      if (!performOcr && !performAnalysis) {
        alert(t('select_ocr_or_analysis'));
        return;
      }

      // Perform a single, comprehensive credit check for single-use users
      if (availableCredits < currentCreditCost) {
        alert(t('not_enough_credits_for_operation', { requiredCredits: currentCreditCost, availableCredits: availableCredits }));
        return;
      }
    } else { // For basic/advanced subscription users, OCR and basic analysis are always performed
      // Only check advanced analysis credits if it's a basic subscription and advanced is selected
      if (isBasicSubscription && performAdvancedAnalysis && !canPerformAdvancedAddon) {
        alert(t('not_enough_credits_for_advanced_analysis', { cost: advancedAnalysisAddonCost }));
        return;
      }
    }


    const allInputs = [...(Array.isArray(selectedFiles) ? selectedFiles : []), ...(Array.isArray(capturedImages) ? capturedImages : [])];
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
      let needsBackendOcr = false; // Flag to tell backend whether to perform OCR

      // Process captured images first
      if (capturedImages.length > 0) {
        fileName = `${t('scanned_document_prefix')}_${Date.now()}.jpeg`;
        fileSize = t('not_applicable');
        fileType = 'image/jpeg';
        needsBackendOcr = true; // Captured images always need OCR
        
        for (const imageFile of capturedImages) {
          imageDatasToProcess.push(await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              if (typeof reader.result === 'string') {
                resolve(reader.result.split(',')[1]);
              } else {
                reject(new Error('Failed to read file as Base64.'));
              }
            };
            reader.onerror = reject;
            reader.readAsDataURL(imageFile);
          }));
          filesToUpload.push(imageFile);
        }
      } else if (selectedFiles.length > 0) {
        // Process uploaded files
        fileName = selectedFiles.length > 1 ? `${t('multi_page_contract_prefix')}_${Date.now()}` : selectedFiles[0].name;
        fileSize = selectedFiles.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024) + ` ${t('megabytes_unit')}`;
        fileType = selectedFiles[0].type;

        for (const file of selectedFiles) {
          if (file.type.startsWith('image/')) {
            needsBackendOcr = true; // Uploaded images always need OCR
            imageDatasToProcess.push(await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                  resolve(reader.result.split(',')[1]);
                } else {
                  reject(new Error('Failed to read file as Base64.'));
                }
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            }));
            filesToUpload.push(file);
          } else if (file.type === 'application/pdf' || file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
            // For text-selectable PDF/DOCX, always extract text locally.
            contractText += await extractTextFromFile(file) + '\n\n';
            filesToUpload.push(file);
            // If contractText is populated, OCR is not needed on the backend for this file.
            // needsBackendOcr will only be true if an image was also processed.
          } else {
            // Other file types, just upload
            filesToUpload.push(file);
          }
        }
      }

      // Final determination of performOcr flag for the backend
      // OCR is needed if image data is present, OR if no contractText was extracted (meaning it's a non-selectable PDF/DOCX)
      // AND either it's a subscription user (OCR is included) or a single-use user explicitly checked the OCR box.
      const finalPerformOcrFlag = (imageDatasToProcess.length > 0) || (contractText === '' && (isBasicSubscription || isAdvancedSubscription || performOcr));

      const newContractId = await addContract({
        files: filesToUpload.length > 0 ? filesToUpload : undefined,
        imageDatas: imageDatasToProcess.length > 0 ? imageDatasToProcess : undefined,
        fileName,
        fileSize,
        fileType,
        jurisdictions: selectedJurisdictions,
        contractText, // This will now contain text for PDF/DOCX if applicable
        sourceLanguage,
        outputLanguage,
        performOcr: finalPerformOcrFlag, // Use the new logic for backend OCR
        performAnalysis: isAdvancedSubscription || isBasicSubscription ? true : performAnalysis,
        performAdvancedAnalysis: isAdvancedSubscription ? true : performAdvancedAnalysis,
        creditCost: currentCreditCost,
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
      setPerformAdvancedAnalysis(false); // Reset advanced analysis state
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
    e.dataTransfer.setData('text/plain', JSON.stringify({ index, type }));
  };

  const handleDropReorder = (e: React.DragEvent, dropIndex: number, dropType: 'file' | 'image') => {
    e.preventDefault();
    e.stopPropagation();

    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;

    const { index: draggedIndex, type: draggedType } = JSON.parse(data);

    if (draggedIndex === null || draggedType === null || draggedType !== dropType) {
      return;
    }

    if (draggedType === 'file') {
      const reorderedFiles = reorder(selectedFiles, draggedIndex, dropIndex);
      setSelectedFiles(reorderedFiles);
    } else if (draggedType === 'image') {
      const reorderedImages = reorder(capturedImages, draggedIndex, dropIndex);
      setCapturedImages(reorderedImages);
    }

    setDraggedItemIndex(null);
    setDraggedItemType(null);
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
    setDraggedItemType(null);
  };

  // Debugging log for the translation key
  const debugTranslation = t('perform_advanced_analysis_with_credits', { cost: advancedAnalysisAddonCost, count: availableCredits });
  console.log('DEBUG: perform_advanced_analysis_with_credits translation output:', debugTranslation);


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
            <div className="w-full text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-700 font-medium">{t('document_selected_for_upload')}</p>
              <p className="text-xs text-gray-500 mt-1">{t('only_one_document_at_a_time')}</p>
            </div>
          )}

          {isAnyInputSelected && (
            <div className="w-full mt-6">
              <p className="text-sm text-gray-700 font-medium mb-3">{t('selected_files_for_upload')}:</p>
              <p className="text-xs text-gray-500 mb-3">{t('reorder_pages_message')}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedFiles.map((file, index) => (
                  <div
                    key={`file-${file.name}-${file.size}`}
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
                      onClick={() => removeInput(`${file.name}-${file.size}`, 'file')}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      title={t('remove_file')}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {capturedImages.map((image, index) => (
                  <div
                    key={image.name}
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
                    <img src={URL.createObjectURL(image)} alt={`${t('captured_page')} ${index + 1}`} className="w-full h-auto rounded-md border border-gray-300" />
                    <button
                      type="button"
                      onClick={() => removeInput(image.name, 'image')}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      title={t('remove_image')}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              {(capturedImages.length > 0 || selectedFiles.some(f => f.type.startsWith('image/'))) && (
                <p className="text-sm text-gray-500 mt-4">
                  {t('ensure_all_pages_scanned_uploaded')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Conditional rendering for Processing Options section (Single-Use Users Only) */}
        {isAnyInputSelected && !isBasicSubscription && !isAdvancedSubscription && (
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
                    disabled={uploading || !canPerformOcr || hasImageInput} // MODIFIED: Disable if hasImageInput
                  />
                  <span className="ml-2 text-gray-700">
                    {t('perform_ocr_with_cost', { cost: ocrCost })}
                  </span>
                </label>
                {!canPerformOcr && (
                  <p className="text-xs text-red-500 ml-7">{t('not_enough_credits_for_ocr_with_cost', { cost: ocrCost })}</p>
                )}
                {/* MODIFIED: New message for mandatory OCR */}
                {hasImageInput && (
                  <p className="text-xs text-gray-500 ml-7">{t('ocr_mandatory_for_images')}</p>
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
                        setPerformAdvancedAnalysis(false);
                      }
                    }}
                    disabled={uploading || (!isAdvancedSubscription && isBasicSubscription && isAnyInputSelected)} // MODIFIED: Always disabled for single-use if input selected
                  />
                  <span className="ml-2 text-gray-700">
                    {t('perform_analysis_with_cost', { cost: basicAnalysisCost })}
                  </span>
                </label>
                {!canPerformBasicAnalysis && (
                  <p className="text-xs text-red-500 ml-7">{t('not_enough_credits_for_analysis_with_cost', { cost: basicAnalysisCost })}</p>
                )}
                {hasImageInput && ( // ADDED: Message for mandatory analysis
                  <p className="text-xs text-gray-500 ml-7">{t('analysis_mandatory_for_images')}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* NEW: Advanced Analysis (Optional) Section for Single Use and Basic/Admin-Assigned */}
        {isAnyInputSelected && !isAdvancedSubscription && (
          <div className="mt-6 p-4 border-l-4 border-purple-500 bg-purple-50 rounded-md">
            <h3 className="text-md font-semibold text-purple-800 mb-3">{t('advanced_analysis_optional')}</h3>
            <div className="space-y-3">
              <div>
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    className="form-checkbox h-5 w-5 text-purple-600"
                    checked={performAdvancedAnalysis}
                    onChange={(e) => setPerformAdvancedAnalysis(e.target.checked)}
                    disabled={uploading || loadingOrders}
                  />
                  <span className="ml-2 text-purple-700">
                    {t('advanced_analysis_cost_and_available_credits', { cost: advancedAnalysisAddonCost, count: availableCredits })}
                    <Link to="/pricing" className="underline text-purple-700 hover:text-purple-900">{t('pricing_page')}</Link>
                  </span>
                </label>
                {!canPerformAdvancedAddon && (
                  <p className="text-xs text-red-500 ml-7">{t('not_enough_credits_for_advanced_analysis', { cost: advancedAnalysisAddonCost })}</p>
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