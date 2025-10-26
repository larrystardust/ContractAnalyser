import React from 'react';
import { stripeProducts } from '../../../supabase/functions/_shared/stripe_products_data';
import { StripeProduct } from '../../../supabase/functions/_shared/stripe_product_types';
import Button from '../ui/Button';
import { useStripe } from '../../hooks/useStripe';
import { Subscription, SubscriptionMembership } from '../../hooks/useSubscription';
import { useTranslation } from 'react-i18next';

interface PricingCardProps {
  product: StripeProduct;
  billingPeriod: 'monthly' | 'yearly';
  currentSessionUserId?: string | null;
  userSubscription?: Subscription | null;
  userMembership?: SubscriptionMembership | null;
  isDataLoading?: boolean;
  unauthenticatedRedirectPath?: string;
}

const PricingCard: React.FC<PricingCardProps> = ({
  product,
  billingPeriod,
  currentSessionUserId,
  userSubscription,
  userMembership,
  isDataLoading = false,
  unauthenticatedRedirectPath,
}) => {
  const { createCheckoutSession, createCustomerPortalSession } = useStripe();
  const { t } = useTranslation();

  const currentPricingOption = product.mode === 'payment'
    ? product.pricing.one_time
    : product.pricing[billingPeriod];

  if (!currentPricingOption) {
    return null;
  }

  // Helper function to get a comparable "level" for each tier
  // This defines the desired upgrade hierarchy:
  // Single Use (1) < Professional Basic (2) < Professional Advanced (4) < Enterprise Basic (3) < Enterprise Advanced (5)
  const getPlanLevel = (tier: number | undefined | null): number => {
    if (tier === 1) return 1; // Single Use
    if (tier === 2) return 2; // Professional Basic
    if (tier === 4) return 3; // Professional Advanced
    if (tier === 3) return 4; // Enterprise Basic
    if (tier === 5) return 5; // Enterprise Advanced
    return 0; // Unknown or no tier
  };

  // Helper flags and values
  const isCurrentPlan = userSubscription?.price_id === currentPricingOption.priceId;
  const isUserOnSubscription = !!userSubscription;
  const isUserOwner = userMembership?.role === 'owner';
  const isUserMember = userMembership?.role === 'member' || userMembership?.status === 'invited';
  
  const usersCurrentTier = userSubscription?.tier;
  const productTier = product.tier;

  const usersCurrentPlanLevel = getPlanLevel(usersCurrentTier);
  const productPlanLevel = getPlanLevel(productTier);

  // This refers to plans that include single-use credits (Tier 4 and 5)
  const isUsersCurrentPlanAdvancedFeatureSet = userSubscription && (userSubscription.tier === 4 || userSubscription.tier === 5);

  let shouldBeDisabled = isDataLoading;
  let buttonText: string;
  let infoMessage: string | null = null;

  // --- Determine button state and text ---

  if (!currentSessionUserId) { // User is not logged in
    buttonText = t('purchase_button');
    shouldBeDisabled = false;
  } else if (isCurrentPlan) {
    shouldBeDisabled = true;
    buttonText = t('current_plan_button');
  } else if (product.mode === 'payment') { // Single-use credits (Tier 1)
    if (isUsersCurrentPlanAdvancedFeatureSet) { // Advanced plans (Tier 4 or 5) include single-use
      shouldBeDisabled = true;
      buttonText = t('included_in_your_plan');
      infoMessage = t('included_in_your_advanced_plan');
    } else {
      shouldBeDisabled = false;
      buttonText = t('purchase_button');
    }
  } else if (product.mode === 'subscription') { // Subscription plans (Tiers 2, 3, 4, 5)
    if (!isUserOnSubscription) { // User has no current subscription
      shouldBeDisabled = false;
      buttonText = t('purchase_button');
    } else if (isUserMember) { // User is a member, not an owner
      shouldBeDisabled = true;
      buttonText = t('owner_only_button');
      infoMessage = t('only_owner_can_manage_subscription');
    } else if (isUserOwner) { // User is an owner and wants to change their subscription
      if (productPlanLevel > usersCurrentPlanLevel) {
        shouldBeDisabled = false;
        buttonText = t('upgrade_button');
      } else if (productPlanLevel < usersCurrentPlanLevel) {
        shouldBeDisabled = false;
        buttonText = t('downgrade_button');
      } else { // Same plan level, but different billing period (e.g., monthly to yearly of same plan)
        shouldBeDisabled = false;
        buttonText = t('change_plan_button');
      }
    }
  } else if (product.mode === 'admin_assigned') { // Admin assigned plans
    shouldBeDisabled = true;
    buttonText = t('zero_payment');
    infoMessage = t('admin_assigned_plan_info');
  }

  const handlePurchase = () => {
    if (!currentPricingOption) return;

    if (!currentSessionUserId) { // Not logged in, redirect to signup/login
      createCheckoutSession(currentPricingOption.priceId, product.mode, unauthenticatedRedirectPath);
      return;
    }

    if (isCurrentPlan) {
      if (product.mode === 'subscription') {
        createCustomerPortalSession(); // Manage billing period for current plan
      }
      return;
    }

    // For owners changing subscription plans
    if (isUserOwner && product.mode === 'subscription') {
      if (productPlanLevel < usersCurrentPlanLevel) { // Downgrade
        createCustomerPortalSession(); // Downgrades are handled via portal
      } else { // Upgrade or same level different billing period
        createCheckoutSession(currentPricingOption.priceId, 'subscription', unauthenticatedRedirectPath);
      }
    } else if (product.mode === 'payment') { // One-time purchase
      createCheckoutSession(currentPricingOption.priceId, 'payment', unauthenticatedRedirectPath);
    } else if (product.mode === 'subscription') { // First-time subscription purchase
      createCheckoutSession(currentPricingOption.priceId, 'subscription', unauthenticatedRedirectPath);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 dark:text-gray-200">
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{t(product.name)}</h3>
      <p className="text-gray-600 dark:text-gray-300 mb-6">{t(product.description)}</p>
      
      <div className="mb-6">
        <span className="text-4xl font-extrabold text-gray-900 dark:text-white">
          ${currentPricingOption.price.toFixed(2)}
        </span>
        {currentPricingOption.interval === 'month' && <span className="text-gray-600 dark:text-gray-300">/{t('month')}</span>}
        {currentPricingOption.interval === 'year' && <span className="text-gray-600 dark:text-gray-300">/{t('year')}</span>}
        {currentPricingOption.interval === 'one_time' && product.credits && <span className="text-gray-600 dark:text-gray-300">/{t('for_credits', { count: product.credits })}</span>}
      </div>

      {product.fileRetentionPolicy && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          <span className="font-semibold">{t('data_retention')}:</span> {t(product.fileRetentionPolicy)}
          {product.maxFiles && (
            <>
              <br />
              <span className="font-semibold">{t('file_limit')}:</span> {t('up_to')} {product.maxFiles} {t('files_collectively')}.
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
      {infoMessage && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
          {infoMessage}
        </p>
      )}
    </div>
  );
};

export default PricingCard;