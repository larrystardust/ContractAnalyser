import React from 'react';
import Modal from '../ui/Modal';
import AnalysisResults from './AnalysisResults';
import JurisdictionSummary from './JurisdictionSummary';
import { Contract } from '../../types';
import { useTranslation } from 'react-i18next';

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract;
  onReanalyzeInitiated: (contractName: string) => void;
  // REMOVED: onReanalyzeCompleted and onReanalyzeFailed as modal dismissal is handled by parent
}

const AnalysisModal: React.FC<AnalysisModalProps> = ({
  isOpen,
  onClose,
  contract,
  onReanalyzeInitiated,
}) => {
  const { t } = useTranslation();

  if (!contract || !contract.analysisResult) {
    return null; // Should not happen if called correctly
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t('contract_analysis')}: ${contract.translated_name || contract.name}`}
      className="max-w-5xl" // Adjust modal width for better content display
    >
      <div className="space-y-6">
        <AnalysisResults
          analysisResult={contract.analysisResult}
          isSample={false}
          onReanalyzeInitiated={onReanalyzeInitiated}
          contractName={contract.translated_name || contract.name}
        />

        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('jurisdiction_summaries')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.values(contract.analysisResult.jurisdictionSummaries).map((summary) => (
              <JurisdictionSummary key={summary.jurisdiction} summary={summary} />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AnalysisModal;