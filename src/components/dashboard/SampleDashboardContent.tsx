import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SampleContractList from '../contracts/SampleContractList';
import SampleAnalysisResults from '../analysis/SampleAnalysisResults';
import JurisdictionSummary from '../analysis/JurisdictionSummary';
import { sampleContracts } from '../../data/sampleData';
import { Contract } from '../../types';
import Button from '../ui/Button';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from '../ui/Modal'; // ADDED: Import Modal
import AnalysisModal from '../analysis/AnalysisModal'; // ADDED: Import AnalysisModal

const SampleDashboardContent: React.FC = () => {
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const { t } = useTranslation();

  // ADDED: State for the main analysis modal
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [contractForModal, setContractForModal] = useState<Contract | null>(null);

  useEffect(() => {
    const firstCompletedSample = sampleContracts.find(c => c.status === 'completed');
    if (firstCompletedSample) {
      setSelectedContractId(firstCompletedSample.id);
    } else if (sampleContracts.length > 0) {
      setSelectedContractId(sampleContracts[0].id); // MODIFIED: Ensure it selects an actual contract
    }
  }, []);

  useEffect(() => {
    if (selectedContractId) {
      const contract = sampleContracts.find(c => c.id === selectedContractId);
      setSelectedContract(contract || null);
    } else {
      setSelectedContract(null);
    }
  }, [selectedContractId]);

  const handleSelectContract = (contractId: string) => {
    setSelectedContractId(contractId);
  };

  // ADDED: Handle viewing analysis in modal for sample contracts
  const handleViewAnalysis = (contract: Contract) => {
    setContractForModal(contract);
    setIsAnalysisModalOpen(true);
  };

  // Placeholder for re-analysis initiated in sample mode (won't actually re-analyze)
  const handleReanalyzeInitiated = (contractName: string) => {
    alert(t('sample_reanalysis_not_available'));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-700 p-4 mb-4" role="alert">
          <p className="font-bold">{t('sample_data_view_dashboard')}</p>
          <p className="text-sm">{t('upgrade_to_analyze_own_contracts')}</p>
          <Link to="/pricing" className="mt-2 inline-block">
            <Button variant="primary" size="sm" icon={<Sparkles className="w-4 h-4" />}>
              {t('upgrade_now')}
            </Button>
          </Link>
        </div>
        <SampleContractList contractsToDisplay={sampleContracts} onViewAnalysis={handleViewAnalysis} /> {/* MODIFIED: Pass onViewAnalysis */}
      </div>
      
      {/* Main Content - Placeholder when modal is closed */}
      <div className="lg:col-span-2">
        {!isAnalysisModalOpen && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="mx-auto w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {t('no_completed_sample_contract_selected_sidebar')}
            </h2>
            <p className="text-gray-600 mb-6">
              {t('select_completed_sample_contract_to_view_analysis')}
            </p>
            <Link to="/pricing">
              <Button variant="primary" size="lg" icon={<Sparkles className="w-5 h-5" />}>
                {t('upgrade_to_analyze_own_contracts_button')}
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* ADDED: Main Analysis Modal for Sample Content */}
      {contractForModal && (
        <AnalysisModal
          isOpen={isAnalysisModalOpen}
          onClose={() => setIsAnalysisModalOpen(false)}
          contract={contractForModal}
          onReanalyzeInitiated={handleReanalyzeInitiated} // Pass placeholder function
        />
      )}
    </div>
  );
};

export default SampleDashboardContent;