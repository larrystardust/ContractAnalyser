import React from 'react';
import { stripeProducts } from '../../../supabase/functions/_shared/stripe_products_data';
import { StripeProduct } from '../../../supabase/functions/_shared/stripe_product_types';
import Button from '../ui/Button';
import { useStripe } from '../../hooks/useStripe';
import { Subscription, SubscriptionMembership } from '../../hooks/useSubscription';

interface PricingCardProps {
  product: StripeProduct;
  billingPeriod: 'monthly' | 'yearly';
  currentSessionUserId: string | null;
  userSubscription: Subscription | null;
  userMembership: SubscriptionMembership | null;
  isDataLoading: boolean;
}

const PricingCard: React.FC<PricingCardProps> = ({
  product,
  billingPeriod,
  currentSessionUserId,
  userSubscription,
  userMembership,
  isDataLoading,
}) => {
  const { createCheckoutSession, createCustomerPortalSession } = useStripe();

  const currentPricingOption = product.mode === 'payment'
    ? product.pricing.one_time
    : product.pricing[billingPeriod];

  if (!currentPricingOption) {
    return null;
  }

  const usersCurrentProduct = userSubscription
    ? stripeProducts.find(p =>
        p.pricing.monthly?.priceId === userSubscription.price_id ||
        p.pricing.yearly?.priceId === userSubscription.price_id ||
        p.pricing.one_time?.priceId === userSubscription.price_id
      )
    : null;

  const isUsersCurrentPlanAdminAssigned = usersCurrentProduct?.mode === 'admin_assigned';
  const isAnyAdminAssignedPlanActive = isUsersCurrentPlanAdminAssigned;

  const isCurrentPlan = userSubscription?.price_id === currentPricingOption.priceId;

  const isDowngradeOption = usersCurrentProduct &&
                            product.mode === 'subscription' &&
                            usersCurrentProduct.mode === 'subscription' &&
                            product.tier < usersCurrentProduct.tier;

  const isDisabledForSubscribers = product.mode === 'payment' &&
                                   (userSubscription && (userSubscription.status === 'active' || userSubscription.status === 'trialing'));

  // ✅ Safety Guard: members are treated as "not owners" unless their user_id matches
  const isMemberNotOwner =
    !!userMembership &&
    userMembership.role === 'member' &&
    userMembership.status === 'active' &&
    userMembership.user_id !== currentSessionUserId;

  // --- DEBUG LOGS START ---
  console.log(`PricingCard: ${product.name} (${billingPeriod})`);
  console.log(`  currentSessionUserId: ${currentSessionUserId}`);
  console.log(`  userMembership:`, userMembership);
  console.log(`  isMemberNotOwner: ${isMemberNotOwner}`);
  console.log(`  usersCurrentProduct:`, usersCurrentProduct);
  console.log(`  product.tier: ${product.tier}, usersCurrentProduct.tier: ${usersCurrentProduct?.tier}`);
  console.log(`  isDowngradeOption: ${isDowngradeOption}`);
  // --- DEBUG LOGS END ---

  let shouldBeDisabled = isDataLoading; 

  if (!shouldBeDisabled) { 
    if (isCurrentPlan) {
      shouldBeDisabled = true;
    } else if (isDisabledForSubscribers) {
      shouldBeDisabled = true;
    } else if (isAnyAdminAssignedPlanActive && !isCurrentPlan) {
      shouldBeDisabled = true;
    } else if (isDowngradeOption && isMemberNotOwner) {
      // 🚫 Disable downgrade for invited members
      shouldBeDisabled = true;
    }
  }
  console.log(`  Final shouldBeDisabled for ${product.name}: ${shouldBeDisabled}`);

  let buttonText: string;
  if (isCurrentPlan) {
    buttonText = 'Current Plan';
  } else if (isAnyAdminAssignedPlanActive && !isCurrentPlan) {
    buttonText = 'Zero Payment';
  } else if (isDowngradeOption) {
    buttonText = 'Downgrade';
    if (isMemberNotOwner) {
      buttonText = 'Owner Only';
    }
  } else {
    buttonText = 'Purchase';
  }

  const handlePurchase = () => {
    if (!currentPricingOption) return;

    if (isCurrentPlan) {
      if (product.mode === 'subscription') {
        createCustomerPortalSession();
      }
      return;
    }

    if (product.mode === 'payment') {
      createCheckoutSession(currentPricingOption.priceId, 'payment');
    } else if (product.mode === 'subscription') {
      createCheckoutSession(currentPricingOption.priceId, 'subscription');
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
        disabled={shouldBeDisabled}
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
      {isDowngradeOption && isMemberNotOwner && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          Only the subscription owner can manage downgrades.
        </p>
      )}
    </div>
  );
};

export default PricingCard;