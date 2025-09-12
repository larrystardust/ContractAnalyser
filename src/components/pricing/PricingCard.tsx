import React from 'react';
import { stripeProducts } from '../../../supabase/functions/_shared/stripe_products_data';
import { StripeProduct } from '../../../supabase/functions/_shared/stripe_product_types';
import Button from '../ui/Button';
import { useStripe } from '../../hooks/useStripe';
import { useSubscription } from '../../hooks/useSubscription';
import { useSession } from '@supabase/auth-helpers-react';

interface PricingCardProps {
  product: StripeProduct;
  billingPeriod: 'monthly' | 'yearly';
}

const PricingCard: React.FC<PricingCardProps> = ({ product, billingPeriod }) => {
  const { createCheckoutSession, createCustomerPortalSession } = useStripe();
  const { subscription, membership, loading: loadingSubscription } = useSubscription();
  const { session } = useSession();

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

  // Check if user is an invited member (not owner)
  const isMemberNotOwner = membership && 
                          membership.user_id === session?.user?.id && 
                          membership.role === 'member' && 
                          membership.status === 'active';

  // Debug logging to verify the conditions
  console.log('Downgrade analysis:', {
    productName: product.name,
    isDowngradeOption,
    isMemberNotOwner,
    membership,
    userHasMembership: !!membership,
    userIdMatches: membership?.user_id === session?.user?.id,
    isMemberRole: membership?.role === 'member',
    isActiveStatus: membership?.status === 'active'
  });

  // --- Refined disabled logic with proper downgrade handling ---
  let shouldBeDisabled = loadingSubscription;

  if (!shouldBeDisabled) {
    if (isCurrentPlan) {
      shouldBeDisabled = true;
    } else if (isDisabledForSubscribers) {
      shouldBeDisabled = true;
    } else if (isAnyAdminAssignedPlanActive && !isCurrentPlan) {
      shouldBeDisabled = true;
    } 
    // Explicitly check for downgrade option for members
    else if (isDowngradeOption && isMemberNotOwner) {
      shouldBeDisabled = true;
    }
  }

  let buttonText: string;
  if (isCurrentPlan) {
    buttonText = 'Current Plan';
  } else if (isAnyAdminAssignedPlanActive) {
    buttonText = 'Zero Payment';
  } else if (isDowngradeOption) {
    if (isMemberNotOwner) {
      buttonText = 'Owner Only';
    } else {
      buttonText = 'Downgrade';
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

    // Prevent members from attempting to downgrade
    if (isDowngradeOption && isMemberNotOwner) {
      return; // Do nothing for members trying to downgrade
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