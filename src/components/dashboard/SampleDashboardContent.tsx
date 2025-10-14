import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SampleContractList from '../contracts/SampleContractList';
import { sampleContracts } from '../../data/sampleData';
import { Contract } from '../../types';
import Button from '../ui/Button';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from '../ui/Modal';
import AnalysisModal from '../analysis/AnalysisModal';
import SampleAnalysisResults from '../analysis/SampleAnalysisResults'; // ADDED: Import SampleAnalysisResults
import JurisdictionSummary from '../analysis/JurisdictionSummary'; // ADDED: Import JurisdictionSummary
import { useIsMobile } from '../../hooks/useIsMobile'; // ADDED: Import useIsMobile

const SampleDashboardContent: React.FC = () => {
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const { t } = useTranslation();
  const isMobile = useIsMobile(); // ADDED: Use the hook

  // State for the main analysis modal
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [contractForModal, setContractForModal] = useState<Contract | null>(null);

  useEffect(() => {
    const firstCompletedSample = sampleContracts.find(c => c.status === 'completed');
    if (firstCompletedSample) {
      setSelectedContractId(firstCompletedSample.id);
    } else if (sampleContracts.length > 0) {
      setSelectedContractId(sampleContracts[0].id);
    }
  }, []);

  useEffect(() => {
    if (selectedContractId) {
      const contract = sampleContracts.find(c => c.id === selectedContractId);
      setSelectedContract(contract || null);
      // If on mobile, also set contractForModal to open the modal
      if (isMobile) {
        setContractForModal(contract || null);
        setIsAnalysisModalOpen(true);
      } else {
        // On desktop, ensure modal is closed and contractForModal is cleared
        setContractForModal(null);
        setIsAnalysisModalOpen(false);
      }
    } else {
      setSelectedContract(null);
      setContractForModal(null);
      setIsAnalysisModalOpen(false);
    }
  }, [selectedContractId, isMobile]); // MODIFIED: Added isMobile to dependencies

  // MODIFIED: handleSelectContract now directly sets selectedContractId
  const handleSelectContract = (contractId: string) => {
    setSelectedContractId(contractId);
  };

  // ADDED: Handle viewing analysis (for both mobile and desktop)
  const handleViewAnalysis = (contract: Contract) => {
    setSelectedContractId(contract.id); // Keep selectedContractId updated
    if (isMobile) {
      setContractForModal(contract);
      setIsAnalysisModalOpen(true);
    } else {
      // For desktop, analysis is shown directly, no modal needed
      setContractForModal(null); // Clear modal state
      setIsAnalysisModalOpen(false);
    }
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
          <Link to="/pricing">
            <Button variant="primary" size="sm" icon={<Sparkles className="w-4 h-4" />}>
              {t('upgrade_now')}
            </Button>
          </Link>
        </div>
        <SampleContractList contractsToDisplay={sampleContracts} onViewAnalysis={handleViewAnalysis} />
      </div>
      
      {/* Main Content Area */}
      <div className="lg:col-span-2">
        {/* Conditional rendering based on isMobile */}
        {!isMobile && selectedContract && (selectedContract.status === 'completed' || selectedContract.status === 'failed') ? (
          <>
            <SampleAnalysisResults
              analysisResult={selectedContract.analysisResult!} // Assert non-null as we check status
              isSample={true}
              contractName={selectedContract.name}
            />
            {selectedContract.analysisResult && selectedContract.analysisResult.jurisdictionSummaries && Object.keys(selectedContract.analysisResult.jurisdictionSummaries).length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('jurisdiction_summaries')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.values(selectedContract.analysisResult.jurisdictionSummaries).map((summary) => (
                    <JurisdictionSummary key={summary.jurisdiction} summary={summary} />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
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

      {/* Main Analysis Modal for Sample Content (only on mobile) */}
      {isMobile && contractForModal && (
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