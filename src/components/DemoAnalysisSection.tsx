import React, { useState, useRef } from 'react';
import { Upload, FileText, AlertTriangle, CheckCircle, Loader2, X } from 'lucide-react';
import Button from './ui/Button';
import Card, { CardBody } from './ui/Card';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DemoAnalysisResult, RiskLevel } from '../types';
import { getRiskColor } from '../utils/riskUtils';

// Dynamically import pdfjs-dist and mammoth
const loadPdfjs = async () => {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  return pdfjsLib;
};

const loadMammoth = async () => {
  return await import('mammoth');
};

const DemoAnalysisSection: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoResult, setDemoResult] = useState<DemoAnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    e.dataTransfer.dropEffect = 'copy';
  };

  const processFile = (file: File) => {
    setError(null);
    setDemoResult(null);

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!fileExtension || !['pdf', 'docx', 'doc'].includes(fileExtension)) {
      setError(t('demo_unsupported_file_type'));
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (e.dataTransfer.files.length > 1) {
        setError(t('demo_only_one_file_allowed'));
        return;
      }
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
      e.target.value = ''; // Clear input to allow re-selection of same file
    }
  };

  const handleBrowseFilesClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setDemoResult(null);
    setError(null);
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
      throw new Error(t('demo_unsupported_file_type_for_text_extraction'));
    }
  };

  const handleAnalyzeDemo = async () => {
    if (!selectedFile) {
      setError(t('demo_please_select_file'));
      return;
    }

    setLoading(true);
    setError(null);
    setDemoResult(null);

    try {
      const contractText = await extractTextFromFile(selectedFile);
      if (!contractText.trim()) {
        throw new Error(t('demo_no_extractable_text'));
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/demo-analyzer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contractText: contractText,
          outputLanguage: i18n.language,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('demo_analysis_failed'));
      }

      const result: DemoAnalysisResult = await response.json();
      setDemoResult(result);

    } catch (err: any) {
      console.error('Demo analysis failed:', err);
      setError(err.message || t('demo_analysis_failed_unexpected'));
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevelLabel = (risk: RiskLevel): string => {
    switch (risk) {
      case 'high': return t('risk_level_high');
      case 'medium': return t('risk_level_medium');
      case 'low': return t('risk_level_low');
      case 'none': return t('risk_level_none');
      default: return t('risk_level_unknown');
    }
  };

  return (
    <div className="bg-gray-100 dark:bg-gray-800 py-16">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-white mb-8">
          {t('demo_section_title')}
        </h2>
        <p className="text-lg text-center text-gray-700 dark:text-gray-300 max-w-3xl mx-auto mb-12">
          {t('demo_section_description')}
        </p>

        <Card className="max-w-4xl mx-auto p-6">
          <CardBody>
            {/* ADDED: Disclaimer for demo purposes */}
            <div className="bg-yellow-50 border-l-4 border-yellow-300 text-yellow-800 p-4 mb-6" role="alert">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0" />
                <div>
                  <p className="font-bold">{t('demo_disclaimer_title')}</p>
                  <p className="text-sm">{t('demo_disclaimer_message')}</p>
                </div>
              </div>
            </div>

            {!selectedFile ? (
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
                <Upload className="h-12 w-12 text-gray-400 mb-3" />
                <p className="text-sm text-gray-700 font-medium">{t('demo_drag_drop_file')}</p>
                <p className="text-xs text-gray-500 mt-1">{t('demo_supported_file_types')}</p>
                <div className="mt-4">
                  <label htmlFor="demo-file-upload" className="cursor-pointer">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleBrowseFilesClick}
                      disabled={loading}
                    >
                      {t('demo_browse_files')}
                    </Button>
                    <input
                      id="demo-file-upload"
                      name="demo-file-upload"
                      type="file"
                      className="sr-only"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileInput}
                      ref={fileInputRef}
                      disabled={loading}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 border border-gray-300 rounded-md bg-gray-50">
                <div className="flex items-center">
                  <FileText className="h-5 w-5 text-blue-900 mr-2" />
                  <span className="text-sm text-gray-700">{selectedFile.name}</span>
                </div>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={handleRemoveFile}
                  icon={<X className="h-4 w-4" />}
                >
                  {t('demo_remove_file')}
                </Button>
              </div>
            )}

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-4 flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2" />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-6 text-center">
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={handleAnalyzeDemo}
                disabled={!selectedFile || loading}
                icon={loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
              >
                {loading ? t('demo_analyzing') : t('demo_analyze_document')}
              </Button>
            </div>

            {demoResult && (
              <div className="mt-8 p-6 bg-white dark:bg-gray-700 rounded-lg shadow-inner">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('demo_analysis_preview')}</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('executive_summary')}:</p>
                    <p className="text-gray-800 dark:text-gray-200">{demoResult.executiveSummary}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('overall_risk_level')}:</p>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRiskColor(demoResult.overallRiskLevel)}`}>
                      {getRiskLevelLabel(demoResult.overallRiskLevel)}
                    </span>
                  </div>
                  {demoResult.keyFindingTitle && demoResult.keyFindingDescription && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('key_finding')}:</p>
                      <p className="text-gray-800 dark:text-gray-200"><strong>{demoResult.keyFindingTitle}</strong>: {demoResult.keyFindingDescription}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('compliance_score')}:</p>
                    <p className="text-gray-800 dark:text-gray-200">{demoResult.complianceScore}%</p>
                  </div>

                  {/* ADDED: Display Advanced Analysis Fields for Demo */}
                  {(demoResult.effectiveDate || demoResult.terminationDate || demoResult.renewalDate ||
                    demoResult.contractType || demoResult.contractValue || demoResult.parties ||
                    demoResult.liabilityCapSummary || demoResult.indemnificationClauseSummary || demoResult.confidentialityObligationsSummary) && (
                    <div className="pt-4 border-t border-gray-200">
                      <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-2">{t('advanced_analysis_details')}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-gray-700 dark:text-gray-200">
                        {demoResult.effectiveDate && (
                          <p><strong>{t('effective_date')}:</strong> {demoResult.effectiveDate}</p>
                        )}
                        {demoResult.terminationDate && (
                          <p><strong>{t('termination_date')}:</strong> {demoResult.terminationDate}</p>
                        )}
                        {demoResult.renewalDate && (
                          <p><strong>{t('renewal_date')}:</strong> {demoResult.renewalDate}</p>
                        )}
                        {demoResult.contractType && (
                          <p><strong>{t('contract_type')}:</strong> {demoResult.contractType}</p>
                        )}
                        {demoResult.contractValue && (
                          <p><strong>{t('contract_value')}:</strong> {demoResult.contractValue}</p>
                        )}
                        {demoResult.parties && demoResult.parties.length > 0 && (
                          <p><strong>{t('parties')}:</strong> {demoResult.parties.join(', ')}</p>
                        )}
                        {demoResult.liabilityCapSummary && (
                          <p className="md:col-span-2"><strong>{t('liability_cap_summary')}:</strong> {demoResult.liabilityCapSummary}</p>
                        )}
                        {demoResult.indemnificationClauseSummary && (
                          <p className="md:col-span-2"><strong>{t('indemnification_clause_summary')}:</strong> {demoResult.indemnificationClauseSummary}</p>
                        )}
                        {demoResult.confidentialityObligationsSummary && (
                          <p className="md:col-span-2"><strong>{t('confidentiality_obligations_summary')}:</strong> {demoResult.confidentialityObligationsSummary}</p>
                        )}
                      </div>
                    </div>
                  )}

                </div>
                <div className="mt-6 text-center">
                  <p className="text-md text-gray-700 dark:text-gray-300 mb-4">
                    {t('demo_full_analysis_prompt')}
                  </p>
                  <Link to="/signup">
                    <Button variant="primary" size="lg">
                      {t('demo_sign_up_for_full_analysis')}
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

export default DemoAnalysisSection;