import React from 'react';
import { CreditCard, Download, ExternalLink } from 'lucide-react';
import Button from '../ui/Button';
import Card, { CardBody, CardHeader } from '../ui/Card';
import { useSubscription } from '../../hooks/useSubscription';
import { stripeProducts } from '../../../supabase/functions/_shared/stripe_products_data';
import { StripeProduct } from '../../../supabase/functions/_shared/stripe_product_types';
import { useContracts } from '../../context/ContractContext';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { Link } from 'react-router-dom'; // Import Link
import { useTranslation } from 'react-i18next'; // ADDED

// ADDED: Define a type for the combined plan information
interface CurrentPlanInfo {
  product: StripeProduct;
  pricingOption: { priceId: string; price: number; interval: 'month' | 'year' | 'one_time' };
}

const BillingSettings: React.FC = () => {
  const { subscription, membership, loading } = useSubscription();
  const { contracts, loadingContracts } = useContracts();
  const supabase = useSupabaseClient();
  const session = useSession();
  const { t } = useTranslation(); // ADDED

  // MODIFIED: Update getCurrentPlan to correctly find the product and its pricing option
  const getCurrentPlan = (): CurrentPlanInfo | null => {
    if (!subscription?.price_id) return null;

    for (const product of stripeProducts) {
      // Check monthly pricing
      if (product.pricing.monthly && product.pricing.monthly.priceId === subscription.price_id) {
        return { product, pricingOption: product.pricing.monthly };
      }
      // Check yearly pricing
      if (product.pricing.yearly && product.pricing.yearly.priceId === subscription.price_id) {
        return { product, pricingOption: product.pricing.yearly };
      }
      // Check one-time pricing
      if (product.pricing.one_time && product.pricing.one_time.priceId === subscription.price_id) {
        return { product, pricingOption: product.pricing.one_time };
      }
    }
    return null;
  };

  const currentPlan = getCurrentPlan();

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleManageBilling = async () => {
    if (!session) {
      alert(t('must_be_logged_in_to_manage_billing')); // MODIFIED
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('create-customer-portal', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: {}, // ADDED: Explicitly send an empty JSON object
      });

      if (error) {
        // This error object from supabase.functions.invoke will have a 'message' property
        // that contains the error message from the Edge Function.
        if (error.message.includes('No associated Stripe customer found')) {
          alert(t('no_associated_billing_account')); // MODIFIED
        } else if (error.message.includes('Forbidden: Only administrators can manage other users\' billing.')) {
          alert(t('no_permission_manage_other_users_billing')); // MODIFIED
        }
        else {
          alert(t('failed_to_open_billing_portal', { message: error.message })); // MODIFIED
        }
        console.error('Error invoking create-customer-portal:', error);
        return; // Stop execution here
      }

      if (data && data.url) {
        window.location.href = data.url;
      } else {
        alert(t('failed_to_get_billing_portal_url')); // MODIFIED
      }
    } catch (error: any) {
      console.error('Unexpected error managing billing:', error);
      alert(t('unexpected_error_occurred_with_message', { message: error.message })); // MODIFIED
    }
  };

  const handleDownloadInvoice = async () => {
    await handleManageBilling();
  };

  const contractsAnalyzedCount = contracts.filter(c => c.status === 'completed').length;
  const findingsIdentifiedCount = contracts.reduce((totalFindings, contract) => {
    if (contract.status === 'completed' && contract.analysisResult && contract.analysisResult.findings) {
      return totalFindings + contract.analysisResult.findings.length;
    }
    return totalFindings;
  }, 0);
  const reportsGeneratedCount = contractsAnalyzedCount; 

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardBody className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900 mx-auto"></div>
            <p className="text-gray-500 mt-2">{t('loading_billing_info')}</p> {/* MODIFIED */}
          </CardBody>
        </Card>
      </div>
    );
  }

  // ADDED: Determine if the current plan is a free admin-assigned plan
  const isFreeAdminAssignedPlan = currentPlan?.product.mode === 'admin_assigned';

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center">
            <CreditCard className="h-5 w-5 text-blue-900 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">{t('current_plan')}</h3> {/* MODIFIED */}
          </div>
        </CardHeader>
        <CardBody>
          {currentPlan ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  {/* MODIFIED: Access product name and pricing option correctly */}
                  <h4 className="text-lg font-medium text-gray-900">{currentPlan.product.name}</h4>
                  <p className="text-sm text-gray-600">
                    ${currentPlan.pricingOption.price.toFixed(2)} / {currentPlan.pricingOption.interval}
                  </p>
                </div>
                <span className="px-3 py-1 text-sm font-medium bg-green-100 text-green-800 rounded-full">
                  {t('active')} {/* MODIFIED */}
                </span>
              </div>

              {subscription && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                  <div>
                    <p className="text-sm text-gray-500">{t('current_period')}</p> {/* MODIFIED */}
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(subscription.current_period_start!)} - {formatDate(subscription.current_period_end!)}
                    </p>
                  </div>
                  
                  {/* MODIFIED: Conditionally render payment method based on membership role */}
                  {membership?.role === 'owner' && subscription.payment_method_brand && subscription.payment_method_last4 && (
                    <div>
                      <p className="text-sm text-gray-500">{t('payment_method')}</p> {/* MODIFIED */}
                      <p className="text-sm font-medium text-gray-900">
                        {subscription.payment_method_brand.toUpperCase()} •••• {subscription.payment_method_last4}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {subscription?.cancel_at_period_end && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    {t('subscription_will_cancel')} {/* MODIFIED */}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-600 mb-4">{t('no_active_subscription')}</p> {/* MODIFIED */}
              <Link to="/pricing"> {/* Changed to Link component */}
                <Button variant="primary" type="button"> {/* type="button" is good practice for buttons inside Link */}
                  {t('view_plans')} {/* MODIFIED */}
                </Button>
              </Link>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Billing Management */}
      {membership?.role === 'owner' && !isFreeAdminAssignedPlan && ( // MODIFIED: Added !isFreeAdminAssignedPlan
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <Download className="h-5 w-5 text-blue-900 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">{t('billing_management')}</h3> {/* MODIFIED */}
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">{t('manage_billing')}</h4> {/* MODIFIED */}
                  <p className="text-sm text-gray-500">{t('update_payment_methods')}</p> {/* MODIFIED */}
                </div>
                <Button
                  variant="outline"
                  onClick={handleManageBilling}
                  icon={<ExternalLink className="w-4 h-4" />}
                >
                  {t('manage_billing')} {/* MODIFIED */}
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">{t('download_latest_invoice')}</h4> {/* MODIFIED */}
                  <p className="text-sm text-gray-500">{t('get_copy_invoice')}</p> {/* MODIFIED */}
                </div>
                <Button
                  variant="outline"
                  onClick={handleDownloadInvoice}
                  icon={<Download className="w-4 h-4" />}
                >
                  {t('download')} {/* MODIFIED */}
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Usage Statistics */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-medium text-gray-900">{t('usage_this_month')}</h3> {/* MODIFIED */}
        </CardHeader>
        <CardBody>
          {loadingContracts ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900 mx-auto"></div>
              <p className="text-gray-500 mt-2">{t('loading_usage_data')}</p> {/* MODIFIED */}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-900">{contractsAnalyzedCount}</p>
                <p className="text-sm text-gray-600">{t('contracts_analyzed')}</p> {/* MODIFIED */}
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-900">{findingsIdentifiedCount}</p>
                <p className="text-sm text-gray-600">{t('findings_identified')}</p> {/* MODIFIED */}
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-900">{reportsGeneratedCount}</p>
                <p className="text-sm text-gray-600">{t('reports_generated')}</p> {/* MODIFIED */}
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default BillingSettings;