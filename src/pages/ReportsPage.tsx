import React from 'react';
import { useContracts } from '../context/ContractContext';
import Card, { CardBody, CardHeader } from '../components/ui/Card';
import { FileText, CheckCircle, Clock, AlertTriangle, Sparkles } from 'lucide-react'; // ADDED Sparkles icon
import { getRiskLevelLabel } from '../utils/riskUtils';
import { useSubscription } from '../hooks/useSubscription'; // ADDED
import { useUserOrders } from '../hooks/useUserOrders'; // ADDED
import { sampleContracts } from '../data/sampleData'; // ADDED
import { Link } from 'react-router-dom'; // ADDED
import { useTranslation } from 'react-i18next'; // ADDED

const ReportsPage: React.FC = () => {
  console.log('ReportsPage component rendered');
  const { contracts, loadingContracts } = useContracts();
  const { t } = useTranslation(); // ADDED
  
  // ADDED: Hooks for conditional rendering
  const { subscription, membership, loading: loadingSubscription } = useSubscription();
  const { hasAvailableSingleUse, loading: loadingOrders } = useUserOrders();

  // Determine if the user is a paying customer (for banner purposes)
  const isPayingCustomer = (subscription && (subscription.status === 'active' || subscription.status === 'trialing')) ||
                           (membership && membership.status === 'active') ||
                           hasAvailableSingleUse();

  // Determine which contracts to display: always real contracts if available, otherwise sample
  // MODIFIED: Only use sampleContracts if the user is NOT a paying customer AND has no real contracts.
  const contractsToDisplay = contracts.length > 0 ? contracts : (isPayingCustomer ? [] : sampleContracts);

  // Determine overall loading state
  const loadingData = loadingContracts || loadingSubscription || loadingOrders; // MODIFIED: Combine all loading states

  const totalContracts = contractsToDisplay.length;
  const completedContracts = contractsToDisplay.filter(c => c.status === 'completed').length;
  const analyzingContracts = contractsToDisplay.filter(c => c.status === 'analyzing').length;
  const pendingContracts = contractsToDisplay.filter(c => c.status === 'pending').length;

  // Aggregate findings by risk level across all completed contracts
  const aggregatedRiskCounts = contractsToDisplay.reduce((acc, contract) => {
    if (contract.status === 'completed' && contract.analysisResult) {
      contract.analysisResult.findings.forEach(finding => {
        acc[finding.riskLevel] = (acc[finding.riskLevel] || 0) + 1;
      });
    }
    return acc;
  }, { high: 0, medium: 0, low: 0, none: 0 } as Record<string, number>);

  if (loadingData) { // Use combined loading state
    return (
      <div className="container mx-auto px-4 py-6 mt-16 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-900 mx-auto"></div>
        <p className="text-gray-500 mt-2">{t('loading_reports')}...</p> {/* MODIFIED */}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('reports_analytics')}</h1> {/* MODIFIED */}
      
      {/* Show sample data banner ONLY if no real contracts AND not a paying customer */}
      {contracts.length === 0 && !isPayingCustomer && ( // MODIFIED: Condition for showing sample data banner
        <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-700 p-4 mb-6" role="alert">
          <p className="font-bold">{t('sample_data_view')}</p> {/* MODIFIED */}
          <p className="text-sm">{t('upgrade_to_see_analytics')}</p> {/* MODIFIED */}
          <Link to="/pricing" className="mt-2 inline-block">
            <button className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-900 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              <Sparkles className="w-4 h-4 mr-2" />
              {t('upgrade_now')} {/* MODIFIED */}
            </button>
          </Link>
        </div>
      )}

      {contracts.length === 0 && isPayingCustomer && ( // ADDED: Empty state for paying users
        <Card>
          <CardBody className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">{t('no_contracts_analyzed_yet')}</p> {/* MODIFIED */}
            <p className="text-gray-500 mt-2">{t('upload_a_contract_to_see_reports')}</p> {/* MODIFIED */}
            <Link to="/upload" className="mt-4 inline-block">
              <button className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-900 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                <Sparkles className="w-4 h-4 mr-2" />
                {t('upload_contract')} {/* MODIFIED */}
              </button>
            </Link>
          </CardBody>
        </Card>
      )}

      {contractsToDisplay.length > 0 && ( // Only show stats if there's data to display
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardBody className="text-center">
                <FileText className="h-10 w-10 text-blue-600 mx-auto mb-3" />
                <p className="text-sm text-gray-600">{t('total_contracts')}</p> {/* MODIFIED */}
                <p className="text-3xl font-bold text-gray-900">{totalContracts}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <CheckCircle className="h-10 w-10 text-green-600 mx-auto mb-3" />
                <p className="text-sm text-gray-600">{t('completed_analyses')}</p> {/* MODIFIED */}
                <p className="text-3xl font-bold text-gray-900">{completedContracts}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
                <p className="text-sm text-gray-600">{t('analyzing')}</p> {/* MODIFIED */}
                <p className="text-3xl font-bold text-gray-900">{analyzingContracts}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <Clock className="h-10 w-10 text-gray-500 mx-auto mb-3" />
                <p className="text-sm text-gray-600">{t('pending')}</p> {/* MODIFIED */}
                <p className="text-3xl font-bold text-gray-900">{pendingContracts}</p>
              </CardBody>
            </Card>
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('findings_by_risk_level')}</h2> {/* MODIFIED */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.entries(aggregatedRiskCounts).map(([riskLevel, count]) => (
              <Card key={riskLevel}>
                <CardBody className="text-center">
                  {/* MODIFIED: Add console.log for debugging */}
                  <p className="text-sm text-gray-600">
                    {(() => {
                      const keyToTranslate = getRiskLevelLabel(riskLevel as any);
                      const translatedValue = t(keyToTranslate);
                      console.log(`ReportsPage Debug: Attempting to translate key "${keyToTranslate}". Result: "${translatedValue}"`);
                      return translatedValue;
                    })()}
                  </p>
                  <p className="text-3xl font-bold text-gray-900">{count}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ReportsPage;