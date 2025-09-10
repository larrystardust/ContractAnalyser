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
  const isAnyAdminAssignedPlanActive = isUsersCurrentPlanAdminAssigned; // This flag is already correct

  const isCurrentPlan = subscription?.price_id === currentPricingOption.priceId;

  const isDowngradeOption = usersCurrentProduct &&
                            product.mode === 'subscription' &&
                            usersCurrentProduct.mode === 'subscription' &&
                            product.tier < usersCurrentProduct.tier;

  const isDisabledForSubscribers = product.mode === 'payment' &&
                                   (subscription && (subscription.status === 'active' || subscription.status === 'trialing'));

  // The core logic for disabling all other buttons when on an admin-assigned plan
  // is already captured by `(isAnyAdminAssignedPlanActive && !isCurrentPlan)`.
  // If `isAnyAdminAssignedPlanActive` is true, and the current card is NOT the `isCurrentPlan`,
  // then this part will be true, disabling the button.
  const finalDisabledState = loadingSubscription || isCurrentPlan || isDisabledForSubscribers || (isAnyAdminAssignedPlanActive && !isCurrentPlan);

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

  console.log(`--- Pricing Card: ${product.name} (${currentPricingOption.interval}) ---`);
  console.log(`  product.id: ${product.id}`);
  console.log(`  product.tier: ${product.tier}`);
  console.log(`  currentPricingOption.priceId: ${currentPricingOption.priceId}`);
  console.log(`  subscription?.price_id: ${subscription?.price_id}`);
  console.log(`  usersCurrentProduct?.name: ${usersCurrentProduct?.name}`);
  console.log(`  usersCurrentProduct?.mode: ${usersCurrentProduct?.mode}`);
  console.log(`  usersCurrentProduct?.tier: ${usersCurrentProduct?.tier}`);
  console.log(`  isUsersCurrentPlanAdminAssigned: ${isUsersCurrentPlanAdminAssigned}`);
  console.log(`  isAnyAdminAssignedPlanActive: ${isAnyAdminAssignedPlanActive}`);
  console.log(`  isCurrentPlan: ${isCurrentPlan}`);
  console.log(`  isDisabledForSubscribers: ${isDisabledForSubscribers}`);
  console.log(`  (isAnyAdminAssignedPlanActive && !isCurrentPlan): ${isAnyAdminAssignedPlanActive && !isCurrentPlan}`);
  console.log(`  finalDisabledState: ${finalDisabledState}`);
  console.log(`  buttonText: ${buttonText}`);
  console.log('---------------------------------------------------');

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
      {isAnyAdminAssignedPlanActive && !isCurrentPlan && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          This payment is included with your current assigned subscription.
        </p>
      )}
    </div>
  );
};

export default PricingCard;