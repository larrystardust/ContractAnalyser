import React from 'react';
import { stripeProducts } from '../../../supabase/functions/_shared/stripe_products_data'; // MODIFIED PATH
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

  // Determine the current pricing option based on product mode and selected billing period
  const currentPricingOption = product.mode === 'payment'
    ? product.pricing.one_time
    : product.pricing[billingPeriod];

  // If there's no pricing option for the selected period (e.g., single-use doesn't have monthly/yearly)
  if (!currentPricingOption) {
    return null; // Or render a message indicating unavailability
  }

  // Find the user's current product based on their subscription
  const usersCurrentProduct = subscription
    ? stripeProducts.find(p =>
        p.pricing.monthly?.priceId === subscription.price_id ||
        p.pricing.yearly?.priceId === subscription.price_id ||
        p.pricing.one_time?.priceId === subscription.price_id
      )
    : null;

  // Determine if the user's current plan is admin-assigned
  const isUsersCurrentPlanAdminAssigned = usersCurrentProduct?.mode === 'admin_assigned';
  // NEW: Flag to indicate if *any* admin-assigned plan is active for the user
  const isAnyAdminAssignedPlanActive = isUsersCurrentPlanAdminAssigned;

  // Determine if this card's product is the user's current active subscription plan
  const isCurrentPlan = subscription?.price_id === currentPricingOption.priceId;

  // Determine if this card's product is a downgrade option
  const isDowngradeOption = usersCurrentProduct &&
                            product.mode === 'subscription' &&
                            usersCurrentProduct.mode === 'subscription' &&
                            product.tier < usersCurrentProduct.tier;

  // Determine if the button should be disabled (e.g., single-use for active subscribers)
  const isDisabledForSubscribers = product.mode === 'payment' &&
                                   (subscription && (subscription.status === 'active' || subscription.status === 'trialing'));

  // MODIFIED: Final disabled state logic
  const finalDisabledState = loadingSubscription || isCurrentPlan || isDisabledForSubscribers || (isAnyAdminAssignedPlanActive && !isCurrentPlan);

  let buttonText: string;
  if (isCurrentPlan) {
    buttonText = 'Current Plan';
  } else if (isAnyAdminAssignedPlanActive) { // MODIFIED: Use new flag
    buttonText = 'Included with Your Plan';
  } else if (isDowngradeOption) {
    buttonText = 'Downgrade';
  } else {
    buttonText = 'Purchase';
  }

  const handlePurchase = async () => {
    try {
      if (isDowngradeOption) {
        await createCustomerPortalSession();
      } else {
        await createCheckoutSession(currentPricingOption.priceId, product.mode);
      }
    } catch (error: any) {
      console.error('Purchase error:', error);
      // You might want to display a user-friendly message here, e.g., using a toast notification
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
      {isAnyAdminAssignedPlanActive && !isCurrentPlan && ( // MODIFIED: Use new flag
        <p className="text-xs text-gray-500 mt-2 text-center">
          This plan is included with your current assigned subscription.
        </p>
      )}
    </div>
  );
};

export default PricingCard;