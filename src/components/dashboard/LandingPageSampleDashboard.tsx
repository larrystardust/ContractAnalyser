import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SampleContractList from '../contracts/SampleContractList';
import SampleAnalysisResults from '../analysis/SampleAnalysisResults';
import JurisdictionSummary from '../analysis/JurisdictionSummary';
import { sampleContracts } from '../../data/sampleData';
import { Contract } from '../../types';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next'; // ADDED

const LandingPageSampleDashboard: React.FC = () => {
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const { t } = useTranslation(); // ADDED

  useEffect(() => {
    const firstCompletedSample = sampleContracts.find(c => c.status === 'completed');
    if (firstCompletedSample) {
      setSelectedContractId(firstCompletedSample.id);
    } else if (sampleContracts.length > 0) {
      setSelectedContractId(sampleContracts.id);
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

  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3 mb-6 px-4">
          <Link to="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('back_to_landing_page_button')} {/* MODIFIED */}
          </Link>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <SampleContractList contractsToDisplay={sampleContracts} onSelectContract={handleSelectContract} />
        </div>
        
        <div className="lg:col-span-2">
          {selectedContract && selectedContract.analysisResult ? (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold text-gray-900">{t('sample_contract_analysis')}: {selectedContract.name}</h1> {/* MODIFIED */}
              
              <SampleAnalysisResults analysisResult={selectedContract.analysisResult} />
              
              <div className="mt-8">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('jurisdiction_summaries')}</h2> {/* MODIFIED */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.values(selectedContract.analysisResult.jurisdictionSummaries).map((summary) => (
                    <JurisdictionSummary key={summary.jurisdiction} summary={summary} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <div className="mx-auto w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {t('no_completed_sample_contract_selected_sidebar')} {/* MODIFIED */}
              </h2>
              <p className="text-gray-600 mb-6">
                {t('select_completed_sample_contract_to_view_analysis')} {/* MODIFIED */}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LandingPageSampleDashboard;