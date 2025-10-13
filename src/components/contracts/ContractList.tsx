import React from 'react';
import { Contract } from '../../types';
import Card, { CardBody } from '../ui/Card';
import { JurisdictionBadge } from '../ui/Badge';
import { FileText, Clock, AlertTriangle, CheckCircle, Trash2, Download } from 'lucide-react';
import { useContracts } from '../../context/ContractContext';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import Button from '../ui/Button';
import { useTranslation } from 'react-i18next';

interface ContractListProps {
  contractsToDisplay?: Contract[];
  onSelectContract?: (contractId: string) => void;
  isSample?: boolean;
}

const ContractList: React.FC<ContractListProps> = ({ contractsToDisplay, onSelectContract, isSample = false }) => {
  const { contracts, deleteContract } = useContracts();
  const navigate = useNavigate();
  const supabase = useSupabaseClient();
  const { t } = useTranslation();

  const contractsToRender = contractsToDisplay || contracts;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-gray-500" />;
      case 'analyzing':
        return <AlertTriangle className="h-5 w-5 text-amber-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'pending':
        return 'status_pending';
      case 'analyzing':
        return 'status_analyzing';
      case 'completed':
        return 'status_completed';
      case 'failed':
        return 'status_failed';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };

  const handleDelete = async (contractId: string, filePath: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (window.confirm(t('confirm_delete_contract_and_results'))) {
      try {
        await deleteContract(contractId, filePath);
        alert(t('contract_deleted_successfully'));
      } catch (error) {
        alert(t('failed_to_delete_contract'));
        console.error('Delete failed:', error);
      }
    }
  };

  const handleDownload = async (contract: Contract, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const isImageOCRd = contract.original_file_type?.startsWith('image/');
    const isPDF = contract.original_file_type === 'application/pdf';
    const isWordDoc = contract.original_file_type === 'application/msword' || contract.original_file_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (isImageOCRd && contract.contract_content) {
      // Download OCR'd text as TXT for image-based contracts
      const blob = new Blob([contract.contract_content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${contract.name}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else if (contract.file_path) {
      const { data, error } = await supabase.storage
        .from('contracts')
        .createSignedUrl(contract.file_path, 60);

      if (error) {
        console.error('Error creating signed URL:', error);
        alert(t('failed_to_create_signed_url', { message: error.message }));
        return;
      }

      if (isPDF) {
        // Open PDF in new tab for viewing/downloading
        window.open(data.signedUrl, '_blank');
      } else if (isWordDoc) {
        // Direct download for Word documents
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.download = contract.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Fallback for other file types, default to direct download
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.download = contract.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } else {
      alert(t('no_downloadable_file_found'));
    }
  };

  return (
    <div className="space-y-4">
      {contractsToDisplay === undefined && (
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">{t('your_contracts')}</h2>
        </div>
      )}
      
      {contractsToRender.length === 0 ? (
        <Card>
          <CardBody className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">{t('no_contracts_found')}</p>
            {contractsToDisplay === undefined && (
              <p className="text-sm text-gray-400 mt-1">{t('upload_to_get_started')}</p> 
            )}
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {contractsToRender.map((contract) => {
            // Determine button text and title dynamically
            let downloadButtonText = t('download');
            let downloadButtonTitle = t('download_original_file');

            const isImageOCRd = contract.original_file_type?.startsWith('image/');

            if (isImageOCRd && contract.contract_content) {
              downloadButtonText = t('download_text');
              downloadButtonTitle = t('download_contract_text');
            }

            return (
              <Card 
                key={contract.id} 
                hoverable={true}
                onClick={() => {
                  if (onSelectContract) {
                    onSelectContract(contract.id);
                  } else {
                    navigate(`/dashboard?contractId=${contract.id}`);
                  }
                }}
                className={`transition-all duration-200 border border-gray-100`}
              >
                <CardBody className="flex justify-between items-center">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 mr-4">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-blue-900" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">{contract.translated_name || contract.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(contract.created_at)} • {contract.size}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {contract.jurisdictions.map((jurisdiction) => (
                          <JurisdictionBadge 
                            key={jurisdiction} 
                            jurisdiction={jurisdiction} 
                            showLabel={true}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex flex-col items-center">
                      <div className="flex items-center px-3 py-1 rounded-full bg-gray-100">
                        {getStatusIcon(contract.status)}
                        <span className="ml-1 text-xs font-medium text-gray-700">
                          {t(getStatusLabel(contract.status))}
                        </span>
                      </div>
                      {contract.status === 'analyzing' && contract.processing_progress !== undefined && (
                        <div className="w-24 bg-gray-200 rounded-full h-1.5 mt-2">
                          <div 
                            className="bg-blue-600 h-1.5 rounded-full" 
                            style={{ width: `${contract.processing_progress}%` }}
                          ></div>
                        </div>
                      )}
                      {!isSample && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => handleDownload(contract, e)}
                          icon={<Download className="h-4 w-4" />}
                          title={downloadButtonTitle}
                        >
                          {downloadButtonText}
                        </Button>
                      )}
                    </div>
                    {!isSample && (
                      <button
                        onClick={(e) => handleDelete(contract.id, contract.file_path, e)}
                        className="p-2 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title={t('delete_contract')} 
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ContractList;