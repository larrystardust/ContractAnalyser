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
import Card, { CardBody } from '../ui/Card'; // ADDED: Import Card and CardBody

const SampleDashboardContent: React.FC = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile(); // ADDED: Use the hook
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [contractForModal, setContractForModal] = useState<Contract | null>(null);

  useEffect(() => {
    const firstCompletedSample = sampleContracts.find(c => c.status === 'completed');
    if (firstCompletedSample) {
      setContractForModal(firstCompletedSample);
    } else if (sampleContracts.length > 0) {
      setContractForModal(sampleContracts[0]);
    }
  }, []);

  useEffect(() => {
    if (contractForModal) {
      if (isMobile) {
        setIsAnalysisModalOpen(true);
      } else {
        setIsAnalysisModalOpen(false);
      }
    } else {
      setIsAnalysisModalOpen(false);
    }
  }, [contractForModal, isMobile]); // MODIFIED: Added isMobile to dependencies

  // MODIFIED: handleSelectContract now directly sets selectedContractId
  const handleSelectContract = (contractId: string) => {
    const contract = sampleContracts.find(c => c.id === contractId);
    setContractForModal(contract || null);
  };

  // ADDED: Handle viewing analysis (for both mobile and desktop)
  const handleViewAnalysis = (contract: Contract) => {
    setContractForModal(contract);
    if (isMobile) {
      setIsAnalysisModalOpen(true);
    }
    // For desktop, contractForModal is set, and the content will render directly
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
      
      {/* Main Content - Placeholder when modal is closed */}
      <div className="lg:col-span-2">
        {/* MODIFIED: Conditional rendering based on isMobile */}
        {!isMobile && contractForModal && (contractForModal.status === 'completed' || contractForModal.status === 'failed') ? (
          <>
            <SampleAnalysisResults
              analysisResult={contractForModal.analysisResult!} // Assert non-null as we check status
              isSample={true}
              contractName={contractForModal.name}
            />
            {contractForModal.analysisResult && contractForModal.analysisResult.jurisdictionSummaries && Object.keys(contractForModal.analysisResult.jurisdictionSummaries).length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('jurisdiction_summaries')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.values(contractForModal.analysisResult.jurisdictionSummaries).map((summary) => (
                    <JurisdictionSummary key={summary.jurisdiction} summary={summary} />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          // MODIFIED: Replaced div with Card and CardBody
          <Card>
            <CardBody className="text-center py-8">
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
              <Link to="/signup">
                <Button variant="primary" size="lg" icon={<Sparkles className="w-5 h-5" />}>
                  {t('upgrade_to_analyze_own_contracts_button')}
                </Button>
              </Link>
            </CardBody>
          </Card>
        )}
      </div>

      {/* ADDED: Main Analysis Modal for Sample Content */}
      {isMobile && contractForModal && (
        <AnalysisModal
          isOpen={isAnalysisModalOpen}
          onClose={() => setIsAnalysisModalOpen(false)}
          contract={contractForModal}
          onReanalyzeInitiated={handleReanalyzeInitiated} // Pass placeholder function
          isSampleContract={true} // ADDED: This is a sample contract
        />
      )}
    </div>
  );
};

export default SampleDashboardContent;