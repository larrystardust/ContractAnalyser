import React from 'react';
import { AdminContract } from '../../services/adminService';
import AnalysisResults from '../analysis/AnalysisResults';
import JurisdictionSummary from '../analysis/JurisdictionSummary';
import Card, { CardBody } from '../ui/Card';
import { User, Mail, FileText, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next'; // ADDED

interface AdminContractDetailsModalProps {
  contract: AdminContract;
}

const AdminContractDetailsModal: React.FC<AdminContractDetailsModalProps> = ({ contract }) => {
  const { t } = useTranslation(); // ADDED

  return (
    <div className="space-y-6">
      {/* Contract and User Info */}
      <Card>
        <CardBody>
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t('contract_information_modal')}</h2> {/* MODIFIED */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
            <div>
              <p><strong className="font-medium">{t('contract_name')}:</strong> {contract.name}</p> {/* MODIFIED */}
              <p><strong className="font-medium">{t('status')}:</strong> {contract.status}</p> {/* MODIFIED */}
              <p><strong className="font-medium">{t('size')}:</strong> {contract.size}</p> {/* MODIFIED */}
              <p><strong className="font-medium">{t('uploaded_on_modal')}:</strong> {new Date(contract.created_at).toLocaleDateString()}</p> {/* MODIFIED */}
            </div>
            <div>
              <p className="flex items-center"><User className="h-4 w-4 mr-2" /> <strong className="font-medium">{t('user')}:</strong> {contract.user_full_name}</p> {/* MODIFIED */}
              <p className="flex items-center"><Mail className="h-4 w-4 mr-2" /> <strong className="font-medium">{t('email_address')}:</strong> {contract.user_email}</p> {/* MODIFIED */}
              <p><strong className="font-medium">{t('marked_for_deletion_modal')}:</strong> {contract.marked_for_deletion_by_admin ? t('yes') : t('no')}</p> {/* MODIFIED */}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Analysis Results */}
      {contract.analysisResult ? (
        <>
          <AnalysisResults analysisResult={contract.analysisResult} isSample={false} />

          {/* Jurisdiction Summaries */}
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('jurisdiction_summaries_modal')}</h2> {/* MODIFIED */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.values(contract.analysisResult.jurisdictionSummaries).map((summary) => (
                <JurisdictionSummary key={summary.jurisdiction} summary={summary} />
              ))}
            </div>
          </div>
        </>
      ) : (
        <Card>
          <CardBody className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">{t('no_analysis_results_available_modal')}</p> {/* MODIFIED */}
            {contract.status === 'analyzing' && (
              <p className="text-gray-500 mt-2">{t('analysis_in_progress_modal', { progress: contract.processing_progress || 0 })}</p> 
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
};

export default AdminContractDetailsModal;