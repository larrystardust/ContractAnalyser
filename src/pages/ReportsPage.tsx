import React from 'react';
import { useContracts } from '../context/ContractContext';
import Card, { CardBody, CardHeader } from '../components/ui/Card';
import { FileText, CheckCircle, Clock, AlertTriangle, Sparkles } from 'lucide-react';
import { getRiskLevelLabel } from '../utils/riskUtils';
import { useSubscription } from '../hooks/useSubscription';
import { useUserOrders } from '../hooks/useUserOrders';
import { sampleContracts } from '../data/sampleData';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RiskLevel } from '../types'; // ADDED: Import RiskLevel type

const ReportsPage: React.FC = () => {
  // console.log('ReportsPage component rendered'); // COMMENTED OUT
  const { contracts, loadingContracts } = useContracts();
  const { t } = useTranslation();
  
  const { subscription, membership, loading: loadingSubscription, totalSubscriptionFiles } = useSubscription(); // MODIFIED: Import totalSubscriptionFiles
  const { hasAvailableSingleUse, loading: loadingOrders } = useUserOrders();

  const isPayingCustomer = (subscription && (subscription.status === 'active' || subscription.status === 'trialing')) ||
                           (membership && membership.status === 'active') ||
                           hasAvailableSingleUse();

  const contractsToDisplay = contracts.length > 0 ? contracts : (isPayingCustomer ? [] : sampleContracts);

  const loadingData = loadingContracts || loadingSubscription || loadingOrders;

  const totalContracts = totalSubscriptionFiles !== null ? totalSubscriptionFiles : contractsToDisplay.length; // MODIFIED: Use totalSubscriptionFiles if available
  const completedContracts = contractsToDisplay.filter(c => c.status === 'completed').length;
  const analyzingContracts = contractsToDisplay.filter(c => c.status === 'analyzing').length;
  const pendingContracts = contractsToDisplay.filter(c => c.status === 'pending').length;

  // MODIFIED: Changed type assertion to Record<RiskLevel, number>
  const aggregatedRiskCounts = contractsToDisplay.reduce((acc, contract) => {
    if (contract.status === 'completed' && contract.analysisResult) {
      contract.analysisResult.findings.forEach(finding => {
        acc[finding.riskLevel] = (acc[finding.riskLevel] || 0) + 1;
      });
    }
    return acc;
  }, { high: 0, medium: 0, low: 0, none: 0 } as Record<RiskLevel, number>); // MODIFIED

  if (loadingData) {
    return (
      <div className="container mx-auto px-4 py-6 mt-16 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-900 mx-auto"></div>
        <p className="text-gray-500 mt-2">{t('loading_reports')}...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('reports_analytics')}</h1>
      
      {contracts.length === 0 && !isPayingCustomer && (
        <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-700 p-4 mb-6" role="alert">
          <p className="font-bold">{t('sample_data_view')}</p>
          <p className="text-sm">{t('upgrade_to_see_analytics')}</p>
          <Link to="/pricing" className="mt-2 inline-block">
            <button className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-900 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              <Sparkles className="w-4 h-4 mr-2" />
              {t('upgrade_now')}
            </button>
          </Link>
        </div>
      )}

      {contracts.length === 0 && isPayingCustomer && (
        <Card>
          <CardBody className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">{t('no_contracts_analyzed_yet')}</p>
            <p className="text-gray-500 mt-2">{t('upload_a_contract_to_see_reports')}</p>
            <Link to="/upload" className="mt-4 inline-block">
              <button className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-900 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                <Sparkles className="w-4 h-4 mr-2" />
                {t('upload_contract')}
              </button>
            </Link>
          </CardBody>
        </Card>
      )}

      {contractsToDisplay.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardBody className="text-center">
                <FileText className="h-10 w-10 text-blue-600 mx-auto mb-3" />
                <p className="text-sm text-gray-600">{t('total_contracts')}</p>
                <p className="text-3xl font-bold text-gray-900">{totalContracts}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <CheckCircle className="h-10 w-10 text-green-600 mx-auto mb-3" />
                <p className="text-sm text-gray-600">{t('completed_analyses')}</p>
                <p className="text-3xl font-bold text-gray-900">{completedContracts}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
                <p className="text-sm text-gray-600">{t('analyzing')}</p>
                <p className="text-3xl font-bold text-gray-900">{analyzingContracts}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <Clock className="h-10 w-10 text-gray-500 mx-auto mb-3" />
                <p className="text-sm text-gray-600">{t('pending')}</p>
                <p className="text-3xl font-bold text-gray-900">{pendingContracts}</p>
              </CardBody>
            </Card>
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('findings_by_risk_level')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.entries(aggregatedRiskCounts).map(([riskLevel, count]) => (
              <Card key={riskLevel}>
                <CardBody className="text-center">
                  <p className="text-sm text-gray-600">
                    {(() => {
                      const keyToTranslate = getRiskLevelLabel(riskLevel as RiskLevel);
                      const translatedValue = t(keyToTranslate);
                      // console.log(`ReportsPage Debug: Attempting to translate key "${keyToTranslate}". Result: "${translatedValue}"`); // COMMENTED OUT
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