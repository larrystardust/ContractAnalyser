import React, { useState, useEffect } from 'react';
import ContractList from '../contracts/ContractList';
import AnalysisResults from '../analysis/AnalysisResults';
import JurisdictionSummary from '../analysis/JurisdictionSummary';
import { useContracts } from '../../context/ContractContext';
import { Contract } from '../../types';
import { useSearchParams } from 'react-router-dom';
import { useSubscription } from '../../hooks/useSubscription';
import { useUserOrders } from '../../hooks/useUserOrders';
import SampleDashboardContent from './SampleDashboardContent';
import { useSessionContext } from '@supabase/auth-helpers-react';

const Dashboard: React.FC = () => {
  const { contracts, loadingContracts, errorContracts } = useContracts();
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [searchParams] = useSearchParams();

  const { subscription, membership, loading: loadingSubscription, error: errorSubscription } = useSubscription();
  const { hasAvailableSingleUse, loading: loadingOrders, orders, error: errorOrders } = useUserOrders();
  const { session, isLoading: isSessionLoading } = useSessionContext();

  // Temporary log for debugging
  useEffect(() => {
    console.log('Dashboard Render Check:');
    console.log('  isSessionLoading:', isSessionLoading);
    console.log('  session:', session);
    console.log('  session?.user?.id:', session?.user?.id);
    console.log('  loadingSubscription:', loadingSubscription);
    console.log('  loadingOrders:', loadingOrders);
    console.log('  loadingContracts:', loadingContracts);
  }, [isSessionLoading, session, loadingSubscription, loadingOrders, loadingContracts]);


  useEffect(() => {
    const contractIdFromUrl = searchParams.get('contractId');

    if (contractIdFromUrl) {
      setSelectedContractId(contractIdFromUrl);
    } else if (selectedContractId) {
      // If there's a selectedContractId but no URL param, keep it
    } else if (contracts.length > 0) {
      // Automatically select the first completed contract if none is selected
      const firstCompleted = contracts.find(c => c.status === 'completed');
      if (firstCompleted) {
        setSelectedContractId(firstCompleted.id);
      } else {
        // If no completed contracts, select the first analyzing/pending one
        const firstProcessing = contracts.find(c => c.status === 'analyzing' || c.status === 'pending');
        if (firstProcessing) {
          setSelectedContractId(firstProcessing.id);
        } else {
          setSelectedContractId(null); // No contracts to display
        }
      }
    }
  }, [contracts, searchParams, selectedContractId]);

  useEffect(() => {
    if (selectedContractId) {
      const contract = contracts.find(c => c.id === selectedContractId);
      setSelectedContract(contract || null);
    } else {
      setSelectedContract(null);
    }
  }, [selectedContractId, contracts]);

  // Determine if the user is a paying customer based on subscription/orders
  const isPayingCustomerByPlan = (subscription && (subscription.status === 'active' || subscription.status === 'trialing')) ||
                                 (membership && membership.status === 'active') ||
                                 hasAvailableSingleUse();

  // Determine if the user has any of their own contracts
  const hasUserContracts = contracts.length > 0;

  // Show loading indicator while checking authentication, payment status and contracts
  // CRITICAL MODIFICATION: Ensure session.user.id is available before rendering content
  if (isSessionLoading || loadingSubscription || loadingOrders || loadingContracts || !session?.user?.id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  // ADDED: Handle errors from data fetching hooks
  if (errorContracts || errorSubscription || errorOrders) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-4">
            There was a problem fetching your data. This might be due to a temporary issue or a configuration problem.
          </p>
          {errorContracts && <p className="text-sm text-red-500">Contracts Error: {errorContracts.message}</p>}
          {errorSubscription && <p className="text-sm text-red-500">Subscription Error: {errorSubscription.message}</p>}
          {errorOrders && <p className="text-sm text-red-500">Orders Error: {errorOrders.message}</p>}
          <p className="text-sm text-gray-500 mt-4">
            Please check your Supabase RLS policies and database logs for more details.
          </p>
        </div>
      </div>
    );
  }

  // Conditional rendering:
  // If the user has their own contracts OR is identified as a paying customer by plan, show their real dashboard.
  // Otherwise, show the sample dashboard content.
  if (hasUserContracts || isPayingCustomerByPlan) {
    return (
      <div className="container mx-auto px-4 py-6 mt-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* MODIFIED: Pass isSample={false} */}
            <ContractList isSample={false} /> {/* ContractList will use useContracts internally */}
          </div>
          
          {/* Main Content */}
          <div className="lg:col-span-2">
            {selectedContract && selectedContract.analysisResult ? (
              <div className="space-y-6">
                <h1 className="text-2xl font-bold text-gray-900">Contract Analysis: {selectedContract.name}</h1>
                
                {/* Analysis Results */}
                {/* MODIFIED: Pass isSample={false} and contractStatus */}
                <AnalysisResults
                  analysisResult={selectedContract.analysisResult}
                  isSample={false}
                  contractStatus={selectedContract.status} // ADDED: Pass the contract status
                />
                
                {/* Jurisdiction Summaries */}
                <div className="mt-8">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">Jurisdiction Summaries</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Pass the original contract jurisdictions to JurisdictionSummary */}
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
                  {selectedContract && selectedContract.status !== 'completed'
                    ? `Analyzing "${selectedContract.name}"... (${selectedContract.processing_progress || 0}%)`
                    : 'No Completed Contract Selected'}
                </h2>
                <p className="text-gray-600 mb-6">
                  {selectedContract && selectedContract.status !== 'completed'
                    ? 'Please wait while the analysis is in progress.'
                    : 'Select a completed contract from the list or upload a new one to begin analysis.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  } else {
    return (
      <div className="container mx-auto px-4 py-6 mt-16">
        <SampleDashboardContent />
      </div>
    );
  }
};

export default Dashboard;