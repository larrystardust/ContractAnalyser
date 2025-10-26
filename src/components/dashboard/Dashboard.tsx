import React, { useState, useEffect } from 'react';
import ContractList from '../contracts/ContractList';
import AnalysisResults from '../analysis/AnalysisResults';
import JurisdictionSummary from '../analysis/JurisdictionSummary';
import { useContracts } from '../../context/ContractContext';
import { Contract } from '../../types';
import { useSearchParams, useNavigate } from 'react-router-dom'; // MODIFIED: Added useNavigate
import { useSubscription } from '../../hooks/useSubscription';
import { useUserOrders } from '../../hooks/useUserOrders';
import SampleDashboardContent from './SampleDashboardContent';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Modal from '../ui/Modal';
import { Loader2, CalendarDays, AlertTriangle as AlertIcon } from 'lucide-react'; // MODIFIED: Added CalendarDays, AlertTriangle as AlertIcon
import { useTranslation } from 'react-i18next';
import AnalysisModal from '../analysis/AnalysisModal'; // ADDED: Import AnalysisModal
import { useIsMobile } from '../../hooks/useIsMobile'; // ADDED: Import useIsMobile
import Card, { CardBody } from '../ui/Card'; // ADDED: Import Card and CardBody

const Dashboard: React.FC = () => {
  const { contracts, loadingContracts, errorContracts } = useContracts();
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate(); // MODIFIED: Initialize useNavigate
  const { t } = useTranslation();
  const isMobile = useIsMobile(); // ADDED: Use the hook

  const { subscription, membership, loading: loadingSubscription, error: errorSubscription, totalSubscriptionFiles } = useSubscription(); // MODIFIED: Import totalSubscriptionFiles
  const { hasAvailableSingleUse, loading: loadingOrders, orders, error: errorOrders } = useUserOrders();
  const { session, isLoading: isSessionLoading } = useSessionContext();

  // ADDED: State for the re-analysis modal
  const [showReanalysisModal, setShowReanalysisModal] = useState(false);
  const [reanalyzingContractName, setReanalyzingContractName] = useState<string | null>(null);
  const [contractIdBeingAnalyzed, setContractIdBeingAnalyzed] = useState<string | null>(null);

  // ADDED: State for the main analysis modal
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [contractForModal, setContractForModal] = useState<Contract | null>(null);

  // ADDED: State for upcoming key dates
  const [upcomingRenewals, setUpcomingRenewals] = useState<Contract[]>([]);
  const [upcomingTerminations, setUpcomingTerminations] = useState<Contract[]>([]);


  // Temporary log for debugging
  useEffect(() => {
    // console.log('Dashboard Render Check:'); // COMMENTED OUT
    // console.log('  isSessionLoading:', isSessionLoading); // COMMENTED OUT
    // console.log('  session:', session); // COMMENTED OUT
    // console.log('  session?.user?.id:', session?.user?.id); // COMMENTED OUT
    // console.log('  loadingSubscription:', loadingSubscription); // COMMENTED OUT
    // console.log('  loadingOrders:', loadingOrders); // COMMENTED OUT
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
      // If on mobile, also set contractForModal to open the modal
      if (isMobile) {
        setContractForModal(contract || null);
        setIsAnalysisModalOpen(true);
      }
    } else {
      setSelectedContract(null);
      if (isMobile) {
        setContractForModal(null);
        setIsAnalysisModalOpen(false);
      }
    }
  }, [selectedContractId, contracts, isMobile]);

  // ADDED: Effect to calculate upcoming key dates
  useEffect(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Normalize to start of day

    const renewals: Contract[] = [];
    const terminations: Contract[] = [];

    contracts.forEach(contract => {
      if (contract.status === 'completed' && contract.analysisResult) {
        const ar = contract.analysisResult;

        // Check for upcoming renewals
        if (ar.renewalDate) {
          const renewalDate = new Date(ar.renewalDate);
          renewalDate.setHours(0, 0, 0, 0);
          const diffTime = renewalDate.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays > 0 && diffDays <= 90) { // Upcoming within 90 days
            renewals.push(contract);
          }
        }

        // Check for upcoming terminations
        if (ar.terminationDate) {
          const terminationDate = new Date(ar.terminationDate);
          terminationDate.setHours(0, 0, 0, 0);
          const diffTime = terminationDate.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays > 0 && diffDays <= 90) { // Upcoming within 90 days
            terminations.push(contract);
          }
        }
      }
    });

    setUpcomingRenewals(renewals.sort((a, b) => {
      const dateA = new Date(a.analysisResult?.renewalDate || 0).getTime();
      const dateB = new Date(b.analysisResult?.renewalDate || 0).getTime();
      return dateA - dateB;
    }));
    setUpcomingTerminations(terminations.sort((a, b) => {
      const dateA = new Date(a.analysisResult?.terminationDate || 0).getTime();
      const dateB = new Date(b.analysisResult?.terminationDate || 0).getTime();
      return dateA - dateB;
    }));
  }, [contracts]);


  // ADDED: Handle viewing analysis (for both mobile and desktop)
  const handleViewAnalysis = (contract: Contract) => {
    // MODIFIED: Update the URL search parameter to reflect the newly selected contract
    navigate(`/dashboard?contractId=${contract.id}`); 
    
    // The rest of the logic for mobile modal can remain, but it will now be consistent
    // with the URL and the useEffect's behavior.
    if (isMobile) {
      setContractForModal(contract);
      setIsAnalysisModalOpen(true);
    } else {
      setContractForModal(null);
      setIsAnalysisModalOpen(false);
    }
  };

  // Callback to be passed to AnalysisResults when re-analysis is initiated
  const handleReanalyzeInitiated = (contractName: string) => {
    setShowReanalysisModal(true);
    setReanalyzingContractName(contractName);
    if (contractForModal) { // Use contractForModal for re-analysis context
      setContractIdBeingAnalyzed(contractForModal.id);
    } else if (selectedContract) { // Fallback to selectedContract if modal context is missing
      setContractIdBeingAnalyzed(selectedContract.id);
    }
  };

  // Callback for when re-analysis is completed
  const handleReanalyzeCompleted = () => {
    // This callback is now triggered when the reanalyzeContract promise resolves/rejects
    // We still need to wait for the UI to update via the real-time listener
    // The useEffect below will handle closing the modal based on contract status
  };

  // Callback for when re-analysis fails
  const handleReanalyzeFailed = () => {
    // This callback is now triggered when the reanalyzeContract promise resolves/rejects
    // We still need to wait for the UI to update via the real-time listener
    // The useEffect below will handle closing the modal based on contract status
  };

  // ADDED: Effect to monitor the status of the contract being analyzed
  useEffect(() => {
    if (contractIdBeingAnalyzed) {
      const currentContractState = contracts.find(c => c.id === contractIdBeingAnalyzed);
      if (currentContractState && currentContractState.status === 'completed') {
        setShowReanalysisModal(false);
        setReanalyzingContractName(null);
        setContractIdBeingAnalyzed(null);
        // If the re-analyzed contract is the one in the modal, update the modal's content
        if (contractForModal && contractForModal.id === currentContractState.id) {
          setContractForModal(currentContractState);
        } else if (selectedContract && selectedContract.id === currentContractState.id) {
          setSelectedContract(currentContractState);
        }
      } else if (currentContractState && currentContractState.status === 'failed') {
        // Also close modal if analysis fails
        setShowReanalysisModal(false);
        setReanalyzingContractName(null);
        setContractIdBeingAnalyzed(null);
      }
    }
  }, [contracts, contractIdBeingAnalyzed, contractForModal, selectedContract]);


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
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('error_loading_dashboard')}</h2>
          <p className="text-gray-600 mb-4">
            {t('problem_fetching_data')}
          </p>
          {errorContracts && <p className="text-sm text-red-500">{t('contracts_error')} {errorContracts.message}</p>}
          {errorSubscription && <p className="text-sm text-red-500">{t('subscription_error')} {errorSubscription.message}</p>}
          {errorOrders && <p className="text-sm text-red-500">{t('orders_error')} {errorOrders.message}</p>}
          <p className="text-sm text-gray-500 mt-4">
            {t('check_supabase_rls')}
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
            {/* ADDED: Upcoming Renewals Widget */}
            {upcomingRenewals.length > 0 && (
              <Card>
                <CardBody>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <CalendarDays className="h-5 w-5 mr-2 text-blue-600" /> {t('upcoming_renewals')}
                  </h3>
                  <ul className="space-y-2">
                    {upcomingRenewals.map(contract => (
                      <li key={contract.id} className="text-sm text-gray-700">
                        <span className="font-medium">{contract.translated_name || contract.name}</span>: {contract.analysisResult?.renewalDate}
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            )}

            {/* ADDED: Upcoming Terminations Widget */}
            {upcomingTerminations.length > 0 && (
              <Card>
                <CardBody>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <AlertIcon className="h-5 w-5 mr-2 text-red-600" /> {t('upcoming_terminations')}
                  </h3>
                  <ul className="space-y-2">
                    {upcomingTerminations.map(contract => (
                      <li key={contract.id} className="text-sm text-gray-700">
                        <span className="font-medium">{contract.translated_name || contract.name}</span>: {contract.analysisResult?.terminationDate}
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            )}

            <ContractList isSample={false} onViewAnalysis={handleViewAnalysis} /> {/* MODIFIED: Pass onViewAnalysis */}
          </div>
          
          {/* Main Content Area */}
          <div className="lg:col-span-2">
            {/* MODIFIED: Conditional rendering based on isMobile */}
            {!isMobile && selectedContract && (selectedContract.status === 'completed' || selectedContract.status === 'failed') ? (
              <>
                <AnalysisResults
                  analysisResult={selectedContract.analysisResult}
                  isSample={false}
                  onReanalyzeInitiated={handleReanalyzeInitiated}
                  contractName={selectedContract.translated_name || selectedContract.name}
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
                  {t('select_contract_to_view_analysis')}
                </h2>
                <p className="text-gray-600 mb-6">
                  {t('click_contract_list_to_open_analysis')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ADDED: Main Analysis Modal (for real contracts on mobile) */}
        {isMobile && contractForModal && (
          <AnalysisModal
            isOpen={isAnalysisModalOpen}
            onClose={() => setIsAnalysisModalOpen(false)}
            contract={contractForModal}
            onReanalyzeInitiated={handleReanalyzeInitiated}
            isSampleContract={false} // ADDED: This is a real contract
          />
        )}

        {/* ADDED: Re-analysis Modal (managed by Dashboard) */}
        {showReanalysisModal && (
          <Modal
            isOpen={showReanalysisModal}
            onClose={() => setShowReanalysisModal(false)}
            title={t('contract_analysis_in_progress')}
          >
            <div className="text-center py-4">
              <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
              <p className="text-gray-700 text-lg">
                {reanalyzingContractName ? t('contract_being_analyzed', { contractName: reanalyzingContractName }) : t('the_contract_is_being_analyzed')}
              </p>
              <p className="text-sm text-gray-500 mt-2">{t('may_take_minutes')}</p>
            </div>
          </Modal>
        )}
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