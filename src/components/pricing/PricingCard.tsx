import React from 'react';
import { stripeProducts } from '../../../supabase/functions/_shared/stripe_products_data';
import { StripeProduct } from '../../../supabase/functions/_shared/stripe_product_types';
import Button from '../ui/Button';
import { useStripe } from '../../hooks/useStripe';
import { useSubscription } from '../../hooks/useSubscription';

interface PricingCardProps {
  product: StripeProduct;
  billingPeriod: 'monthly' | 'yearly';
}

const PricingCard: React.FC<PricingCardProps> = ({ product, billingPeriod }) => {
  const { createCheckoutSession, createCustomerPortalSession } = useStripe();
  const { subscription, loading: loadingSubscription } = useSubscription();

  const currentPricingOption = product.mode === 'payment'
    ? product.pricing.one_time
    : product.pricing[billingPeriod];

  if (!currentPricingOption) {
    return null;
  }

  const usersCurrentProduct = subscription
    ? stripeProducts.find(p =>
        p.pricing.monthly?.priceId === subscription.price_id ||
        p.pricing.yearly?.priceId === subscription.price_id ||
        p.pricing.one_time?.priceId === subscription.price_id
      )
    : null;

  const isUsersCurrentPlanAdminAssigned = usersCurrentProduct?.mode === 'admin_assigned';
  const isAnyAdminAssignedPlanActive = isUsersCurrentPlanAdminAssigned;

  const isCurrentPlan = subscription?.price_id === currentPricingOption.priceId;

  const isDowngradeOption = usersCurrentProduct &&
                            product.mode === 'subscription' &&
                            usersCurrentProduct.mode === 'subscription' &&
                            product.tier < usersCurrentProduct.tier;

  const isDisabledForSubscribers = product.mode === 'payment' &&
                                   (subscription && (subscription.status === 'active' || subscription.status === 'trialing'));

  // Check if user is the owner - using the most common ways to store role information
  // Adjust this based on your actual user data structure
  const isSubscriptionOwner = () => {
    // Check if we can access user data from localStorage or sessionStorage
    try {
      const userData = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        return user?.role === 'owner' || user?.user_metadata?.role === 'owner' || user?.app_metadata?.role === 'owner';
      }
    } catch (e) {
      console.warn('Could not access user data from storage');
    }
    
    // Fallback: check subscription data
    return subscription?.role === 'owner';
  };

  const isEnterprisePlan = product.name.toLowerCase().includes('enterprise');
  const disableEnterpriseDowngrade = isEnterprisePlan && isDowngradeOption && !isSubscriptionOwner();

  const finalDisabledState = loadingSubscription || 
                            isCurrentPlan || 
                            isDisabledForSubscribers || 
                            (isAnyAdminAssignedPlanActive && !isCurrentPlan) ||
                            disableEnterpriseDowngrade;

  let buttonText: string;
  if (isCurrentPlan) {
    buttonText = 'Current Plan';
  } else if (isAnyAdminAssignedPlanActive) {
    buttonText = 'Zero Payment';
  } else if (isDowngradeOption) {
    buttonText = 'Downgrade';
  } else {
    buttonText = 'Purchase';
  }

  console.log('User is subscription owner:', isSubscriptionOwner());
  console.log('Disable enterprise downgrade:', disableEnterpriseDowngrade);

  const handlePurchase = async () => {
    try {
      if (isDowngradeOption) {
        await createCustomerPortalSession();
      } else {
        await createCheckoutSession(currentPricingOption.priceId, product.mode);
      }
    } catch (error: any) {
      console.error('Purchase error:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <h3 className="text-2xl font-bold text-gray-900 mb-4">{product.name}</h3>
      <p className="text-gray-600 mb-6">{product.description}</p>
      
      <div className="mb-6">
        <span className="text-4xl font-extrabold text-gray-900">
          ${currentPricingOption.price.toFixed(2)}
        </span>
        {currentPricingOption.interval === 'month' && <span className="text-gray-600">/month</span>}
        {currentPricingOption.interval === 'year' && <span className="text-gray-600">/year</span>}
        {currentPricingOption.interval === 'one_time' && <span className="text-gray-600"> one-time</span>}
      </div>

      {product.fileRetentionPolicy && (
        <p className="text-sm text-gray-500 mb-6">
          <span className="font-semibold">Data Retention:</span> {product.fileRetentionPolicy}
          {product.maxFiles && (
            <>
              <br />
              <span className="font-semibold">File Limit:</span> Up to {product.maxFiles} files at any given time.
            </>
          )}
        </p>
      )}

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={handlePurchase}
        disabled={finalDisabledState}
      >
        {buttonText}
      </Button>
      {isDisabledForSubscribers && product.mode === 'payment' && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          Already covered by your active subscription.
        </p>
      )}
      {isAnyAdminAssignedPlanActive && !isCurrentPlan && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          No payment needed with your current assigned subscription.
        </p>
      )}
      {disableEnterpriseDowngrade && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          Only the subscription owner can downgrade the Enterprise plan.
        </p>
      )}
    </div>
  );
};

export default PricingCard;