import React from 'react';
import { CreditCard, Download, ExternalLink } from 'lucide-react';
import Button from '../ui/Button';
import Card, { CardBody, CardHeader } from '../ui/Card';
import { useSubscription } from '../../hooks/useSubscription';
import { stripeProducts, StripeProduct } from '../../stripe-config'; // MODIFIED: Ensure StripeProduct is imported
import { useContracts } from '../../context/ContractContext';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';

// ADDED: Define a type for the combined plan information
interface CurrentPlanInfo {
  product: StripeProduct;
  pricingOption: { priceId: string; price: number; interval: 'month' | 'year' | 'one_time' };
}

const BillingSettings: React.FC = () => {
  const { subscription, loading } = useSubscription();
  const { contracts, loadingContracts } = useContracts();
  const supabase = useSupabaseClient();
  const session = useSession();

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
      alert('You must be logged in to manage billing.');
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
          alert('You do not have an associated billing account yet. Please make a purchase first.');
        } else if (error.message.includes('Forbidden: Only administrators can manage other users\' billing.')) {
          alert('You do not have permission to manage other users\' billing.');
        }
        else {
          alert(`Failed to open billing portal: ${error.message}`);
        }
        console.error('Error invoking create-customer-portal:', error);
        return; // Stop execution here
      }

      if (data && data.url) {
        window.location.href = data.url;
      } else {
        alert('Failed to get billing portal URL.');
      }
    } catch (error: any) {
      console.error('Unexpected error managing billing:', error);
      alert(`An unexpected error occurred: ${error.message}`);
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
            <p className="text-gray-500 mt-2">Loading billing information...</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center">
            <CreditCard className="h-5 w-5 text-blue-900 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Current Plan</h3>
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
                  Active
                </span>
              </div>

              {subscription && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                  <div>
                    <p className="text-sm text-gray-500">Current Period</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(subscription.current_period_start!)} - {formatDate(subscription.current_period_end!)}
                    </p>
                  </div>
                  
                  {subscription.payment_method_brand && subscription.payment_method_last4 && (
                    <div>
                      <p className="text-sm text-gray-500">Payment Method</p>
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
                    Your subscription will be cancelled at the end of the current billing period.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-600 mb-4">You don't have an active subscription.</p>
              <Button variant="primary" onClick={() => window.location.href = '/pricing'}>
                View Plans
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Billing Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center">
            <Download className="h-5 w-5 text-blue-900 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Billing Management</h3>
          </div>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Manage Billing</h4>
                <p className="text-sm text-gray-500">Update payment methods, view invoices, and manage your subscription</p>
              </div>
              <Button
                variant="outline"
                onClick={handleManageBilling}
                icon={<ExternalLink className="w-4 h-4" />}
              >
                Manage Billing
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Download Latest Invoice</h4>
                <p className="text-sm text-gray-500">Get a copy of your most recent billing statement</p>
              </div>
              <Button
                variant="outline"
                onClick={handleDownloadInvoice}
                icon={<Download className="w-4 h-4" />}
              >
                Download
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Usage Statistics */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-medium text-gray-900">Usage This Month</h3>
        </CardHeader>
        <CardBody>
          {loadingContracts ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading usage data...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-900">{contractsAnalyzedCount}</p>
                <p className="text-sm text-gray-600">Contracts Analyzed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-900">{findingsIdentifiedCount}</p>
                <p className="text-sm text-gray-600">Findings Identified</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-900">{reportsGeneratedCount}</p>
                <p className="text-sm text-gray-600">Reports Generated</p>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default BillingSettings;