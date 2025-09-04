import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ContractList from '../contracts/ContractList';
import AnalysisResults from '../analysis/AnalysisResults';
import JurisdictionSummary from '../analysis/JurisdictionSummary';
import { sampleContracts } from '../../data/sampleData'; // Import sample data
import { Contract } from '../../types';
import { ArrowLeft } from 'lucide-react'; // Import ArrowLeft icon

const LandingPageSampleDashboard: React.FC = () => {
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  useEffect(() => {
    // Automatically select the first completed sample contract
    const firstCompletedSample = sampleContracts.find(c => c.status === 'completed');
    if (firstCompletedSample) {
      setSelectedContractId(firstCompletedSample.id);
    } else if (sampleContracts.length > 0) {
      // If no completed, select the first available sample contract
      setSelectedContractId(sampleContracts[0].id);
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

  // Function to handle selecting a contract from the list
  const handleSelectContract = (contractId: string) => {
    setSelectedContractId(contractId);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Back to Landing Page Link */}
      <div className="lg:col-span-3 mb-6">
        <Link to="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Landing Page
        </Link>
      </div>

      {/* Sidebar for Sample Contracts */}
      <div className="lg:col-span-1 space-y-6">
        {/* REMOVED: Upgrade Now banner */}
        {/* Pass the handleSelectContract function to ContractList */}
        <ContractList contractsToDisplay={sampleContracts} onSelectContract={handleSelectContract} />
      </div>
      
      {/* Main Content for Sample Analysis */}
      <div className="lg:col-span-2">
        {selectedContract && selectedContract.analysisResult ? (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Sample Contract Analysis: {selectedContract.name}</h1>
            
            {/* Analysis Results */}
            <AnalysisResults analysisResult={selectedContract.analysisResult} />
            
            {/* Jurisdiction Summaries */}
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Jurisdiction Summaries</h2>
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
              No Sample Contract Selected
            </h2>
            <p className="text-gray-600 mb-6">
              Select a sample contract from the list to view its analysis.
            </p>
            {/* REMOVED: Upgrade button */}
          </div>
        )}
      </div>
    </div>
  );
};

export default LandingPageSampleDashboard;