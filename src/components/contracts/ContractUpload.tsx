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

// Define the structure for a captured image (must match UploadPage.tsx)
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
  showProcessingOptions: boolean;
  isAdvancedSubscription: boolean;
  isBasicSubscription: boolean;
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
  showProcessingOptions,
  isAdvancedSubscription,
  isBasicSubscription,
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
  const [performOcr, setPerformOcr] = useState(false);
  const [performAnalysis, setPerformAnalysis] = useState(true);
  const [performAdvancedAnalysis, setPerformAdvancedAnalysis] = useState(false);

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
    if (isAdvancedSubscription) {
      setPerformOcr(true); // Included
      setPerformAnalysis(true); // Included
      setPerformAdvancedAnalysis(true); // Included
    } else if (isBasicSubscription) {
      setPerformOcr(true); // Included
      setPerformAnalysis(true); // Included
      setPerformAdvancedAnalysis(false); // Not included by default, can be selected
    } else { // Single-use user
      setPerformOcr(false);
      setPerformAnalysis(true);
      setPerformAdvancedAnalysis(false);
    }
  }, [capturedImages, selectedFiles, isAdvancedSubscription, isBasicSubscription]);

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

    const hasExistingImageInput = currentSelectedImageFiles.length > 0 || currentCapturedImages.length > 0;
    const hasExistingDocumentInput = currentSelectedDocumentFiles.length > 0;

    if (newImageFiles.length > 0 && newDocumentFiles.length > 0) {
      alert(t('cannot_mix_image_document_files'));
      return;
    }

    if (newImageFiles.length > 0 && hasExistingDocumentInput) {
      alert(t('cannot_mix_image_document_files'));
      return;
    }

    if (newDocumentFiles.length > 0 && hasExistingImageInput) {
      alert(t('cannot_mix_image_document_files'));
      return;
    }

    if (newDocumentFiles.length > 1) {
      alert(t('only_one_document_allowed'));
      return;
    }

    if (newDocumentFiles.length === 1 && hasExistingDocumentInput) {
      alert(t('only_one_document_allowed'));
      return;
    }

    if (newDocumentFiles.length === 1) {
      setSelectedFiles([newDocumentFiles[0]]);
      setCapturedImages([]);
    } else if (newImageFiles.length > 0) {
      setSelectedFiles(prev => [...currentSelectedImageFiles, ...newImageFiles]);
      setCapturedImages([]);
    } else if (supportedFiles.length > 0 && !hasExistingDocumentInput && !hasExistingImageInput) {
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
      e.target.value = '';
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
    if (!isAdvancedSubscription && !isBasicSubscription) { // Single-use user
      if (performOcr) currentCreditCost += ocrCost;
      if (performAnalysis) {
        currentCreditCost += basicAnalysisCost;
        if (performAdvancedAnalysis) {
          currentCreditCost += advancedAnalysisAddonCost;
        }
      }
    } else if (isBasicSubscription) { // Basic/Admin-assigned subscription user
      // OCR and basic analysis are included, only charge for advanced if selected
      if (performAdvancedAnalysis) {
        currentCreditCost += advancedAnalysisAddonCost;
      }
    }
    // For AdvancedSubscription, currentCreditCost remains 0 as everything is included


    if (!performOcr && !performAnalysis) {
      alert(t('select_ocr_or_analysis'));
      return;
    }
    // Only check credits for OCR/Basic Analysis if not on a subscription plan
    if (!isAdvancedSubscription && !isBasicSubscription) {
      if (performOcr && !canPerformOcr) {
        alert(t('not_enough_credits_for_ocr', { cost: ocrCost }));
        return;
      }
      if (performAnalysis && !canPerformBasicAnalysis) {
        alert(t('not_enough_credits_for_analysis', { cost: basicAnalysisCost }));
        return;
      }
    }
    // Always check credits for Advanced Analysis if not on an Advanced Subscription
    if (performAdvancedAnalysis && !isAdvancedSubscription && !canPerformAdvancedAddon) {
      alert(t('not_enough_credits_for_advanced_analysis', { cost: advancedAnalysisAddonCost }));
      return;
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

      if (capturedImages.length > 0) {
        fileName = `${t('scanned_document_prefix')}_${Date.now()}.jpeg`;
        fileSize = t('not_applicable');
        fileType = 'image/jpeg';
        
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
        fileName = selectedFiles.length > 1 ? `${t('multi_page_contract_prefix')}_${Date.now()}` : selectedFiles[0].name;
        fileSize = selectedFiles.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024) + ` ${t('megabytes_unit')}`;
        fileType = selectedFiles[0].type;

        for (const file of selectedFiles) {
          if (file.type.startsWith('image/')) {
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
          } else if (!performOcr && (file.type === 'application/pdf' || file.name.endsWith('.docx') || file.name.endsWith('.doc'))) {
            contractText += await extractTextFromFile(file) + '\n\n';
            filesToUpload.push(file);
          } else {
            filesToUpload.push(file);
          }
        }
      }

      const newContractId = await addContract({
        files: filesToUpload.length > 0 ? filesToUpload : undefined,
        imageDatas: imageDatasToProcess.length > 0 ? imageDatasToProcess : undefined,
        fileName,
        fileSize,
        fileType,
        jurisdictions: selectedJurisdictions,
        contractText,
        sourceLanguage,
        outputLanguage,
        performOcr: isAdvancedSubscription || isBasicSubscription ? true : performOcr,
        performAnalysis: isAdvancedSubscription || isBasicSubscription ? true : performAnalysis,
        performAdvancedAnalysis: isAdvancedSubscription ? true : performAdvancedAnalysis,
        creditCost: currentCreditCost,
      });
      
      alert(t('contract_uploaded_analysis_initiated'));
      refetchContracts();
      
      if (newContractId) {
        navigate(`/dashboard?contractId=${newContractId}`);
      }

      setSelectedFiles([]);
      setCapturedImages([]);
      setSelectedJurisdictions([]);
      setSourceLanguage('auto');
      setOutputLanguage('en');
      setPerformOcr(false);
      setPerformAnalysis(true);
      setPerformAdvancedAnalysis(false);
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

        {/* Processing Options */}
        {showProcessingOptions && isAnyInputSelected && ( // MODIFIED: Conditionally render based on showProcessingOptions
          <div className="mt-6 p-4 border border-gray-200 rounded-md bg-gray-50">
            <h3 className="text-md font-semibold text-gray-800 mb-3">{t('processing_options')}</h3>
            <div className="space-y-3">
              {/* MODIFIED: Only show Perform Advanced Analysis checkbox for basic/admin-assigned subscriptions */}
              {isBasicSubscription && (
                <div>
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      className="form-checkbox h-5 w-5 text-blue-600"
                      checked={performAdvancedAnalysis}
                      onChange={(e) => setPerformAdvancedAnalysis(e.target.checked)}
                      disabled={uploading || !performAnalysis || !canPerformAdvancedAddon} // Disabled if basic analysis is not selected or not enough credits
                    />
                    <span className="ml-2 text-gray-700">
                      {t('perform_advanced_analysis')}
                      {` (${advancedAnalysisAddonCost} ${t('credits')})`} {/* Only show cost if not advanced sub */}
                    </span>
                  </label>
                  {!performAnalysis && (
                    <p className="text-xs text-gray-500 ml-7">{t('advanced_analysis_requires_basic')}</p>
                  )}
                  {!isAdvancedSubscription && performAnalysis && !canPerformAdvancedAddon && ( // Only show this warning if basic analysis is selected
                    <p className="text-xs text-red-500 ml-7">{t('not_enough_credits_for_advanced_analysis', { cost: advancedAnalysisAddonCost })}</p>
                  )}
                </div>
              )}
              {/* For Single-Use Users, show all options */}
              {!isBasicSubscription && !isAdvancedSubscription && (
                <>
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
                            setPerformAdvancedAnalysis(false);
                          }
                        }}
                        disabled={uploading || !canPerformBasicAnalysis}
                      />
                      <span className="ml-2 text-gray-700">
                        {t('perform_analysis')} ({basicAnalysisCost} {t('credits')})
                      </span>
                    </label>
                    {!canPerformBasicAnalysis && (
                      <p className="text-xs text-red-500 ml-7">{t('not_enough_credits_for_analysis', { cost: basicAnalysisCost })}</p>
                    )}
                  </div>

                  {/* Perform Advanced Analysis Checkbox for single-use */}
                  <div>
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        className="form-checkbox h-5 w-5 text-blue-600"
                        checked={performAdvancedAnalysis}
                        onChange={(e) => setPerformAdvancedAnalysis(e.target.checked)}
                        disabled={uploading || !performAnalysis || !canPerformAdvancedAddon}
                      />
                      <span className="ml-2 text-gray-700">
                        {t('perform_advanced_analysis')} ({advancedAnalysisAddonCost} {t('credits')})
                      </span>
                    </label>
                    {!performAnalysis && (
                      <p className="text-xs text-gray-500 ml-7">{t('advanced_analysis_requires_basic')}</p>
                    )}
                    {performAnalysis && !canPerformAdvancedAddon && (
                      <p className="text-xs text-red-500 ml-7">{t('not_enough_credits_for_advanced_analysis', { cost: advancedAnalysisAddonCost })}</p>
                    )}
                  </div>
                </>
              )}
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