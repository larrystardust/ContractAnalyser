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
  unauthenticatedRedirectPath?: string; // ADDED: New prop
}

const PricingCard: React.FC<PricingCardProps> = ({
  product,
  billingPeriod,
  currentSessionUserId,
  userSubscription,
  userMembership,
  isDataLoading = false,
  unauthenticatedRedirectPath, // ADDED: Destructure new prop
}) => {
  const { createCheckoutSession, createCustomerPortalSession } = useStripe();
  const { t } = useTranslation();

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
  const isUsersCurrentPlanAdvanced = userSubscription && (userSubscription.tier === 4 || userSubscription.tier === 5); // ADDED
  const isUsersCurrentPlanBasic = userSubscription && (userSubscription.tier === 2 || userSubscription.tier === 3); // ADDED

  const isCurrentPlan = userSubscription?.price_id === currentPricingOption.priceId;

  const isDowngradeOption = usersCurrentProduct &&
                            product.mode === 'subscription' &&
                            usersCurrentProduct.mode === 'subscription' &&
                            product.tier < usersCurrentProduct.tier;

  // MODIFIED: isDisabledForSubscribers logic
  let isDisabledForSubscribers = false;
  if (product.mode === 'payment') { // Single-use credits
    if (isUsersCurrentPlanAdvanced) { // Advanced plan users don't need single-use credits
      isDisabledForSubscribers = true;
    }
  } else if (product.mode === 'subscription') { // Subscription plans
    if (isUsersCurrentPlanAdvanced && (product.tier === 4 || product.tier === 5)) { // Already on an advanced plan
      isDisabledForSubscribers = true;
    } else if (isUsersCurrentPlanBasic && (product.tier === 2 || product.tier === 3) && isCurrentPlan) { // Already on this basic plan
      isDisabledForSubscribers = true;
    }
  }


  let shouldBeDisabled = isDataLoading; 

  if (!shouldBeDisabled) { 
    if (isCurrentPlan) {
      shouldBeDisabled = true;
    } else if (isDisabledForSubscribers) { // MODIFIED: Use the new isDisabledForSubscribers
      shouldBeDisabled = true;
    } else if (isUsersCurrentPlanAdminAssigned && !isCurrentPlan && product.mode === 'payment') { // Admin assigned users can buy single use credits
      shouldBeDisabled = false;
    } else if (isUsersCurrentPlanAdminAssigned && !isCurrentPlan && (product.tier === 4 || product.tier === 5)) { // Admin assigned users can upgrade to advanced
      shouldBeDisabled = false;
    } else if (isUsersCurrentPlanAdminAssigned && !isCurrentPlan) { // Admin assigned users cannot buy other basic plans
      shouldBeDisabled = true;
    } else if (isDowngradeOption && (userMembership?.role === 'member' || userMembership?.status === 'invited')) {
      shouldBeDisabled = true;
    } else if (product.name === 'product_name_enterprise_use' && (userMembership?.role === 'member' || userMembership?.status === 'invited')) {
      shouldBeDisabled = true;
    } else if (product.name === 'product_name_professional_use' && billingPeriod === 'yearly' && (userMembership?.role === 'member' || userMembership?.status === 'invited')) { // ADDED: Specific condition for Professional Use yearly
      shouldBeDisabled = true;
    } else if (billingPeriod === 'yearly' && userMembership?.status === 'invited') { // MODIFIED: This condition is now redundant if the above covers all non-owner members for yearly plans. Keeping it for now, but the new one is more specific.
      shouldBeDisabled = true;
    }
  }

  let buttonText: string;
  if (isCurrentPlan) {
    buttonText = t('current_plan_button');
  } else if (product.mode === 'payment' && isUsersCurrentPlanAdvanced) { // MODIFIED: Advanced plan users cannot purchase single-use
    buttonText = t('included_in_your_plan');
  } else if (isUsersCurrentPlanAdminAssigned && !isCurrentPlan && product.mode === 'payment') { // Admin assigned users can buy single use credits
    buttonText = t('purchase_button');
  } else if (isUsersCurrentPlanAdminAssigned && !isCurrentPlan && (product.tier === 4 || product.tier === 5)) { // Admin assigned users can upgrade to advanced
    buttonText = t('upgrade_button');
  } else if (isUsersCurrentPlanAdminAssigned && !isCurrentPlan) { // Admin assigned users cannot buy other basic plans
    buttonText = t('zero_payment');
  } else if (isDowngradeOption) {
    buttonText = t('downgrade_button');
    if (userMembership?.role === 'member' || userMembership?.status === 'invited') {
      buttonText = t('owner_only_button');
    }
  } else if (product.name === 'product_name_enterprise_use') {
    buttonText = (userMembership?.role === 'member' || userMembership?.status === 'invited') ? t('owner_only_upgrade_enterprise_button') : t('upgrade_button');
  } else if (product.name === 'product_name_professional_use' && billingPeriod === 'yearly' && (userMembership?.role === 'member' || userMembership?.status === 'invited')) { // ADDED: Specific button text for Professional Use yearly
    buttonText = t('invited_members_cannot_purchase_yearly');
  } else if (billingPeriod === 'yearly' && userMembership?.status === 'invited') { // MODIFIED: This condition is now redundant if the above covers all non-owner members for yearly plans. Keeping it for now, but the new one is more specific.
    buttonText = t('invited_members_cannot_purchase_yearly'); // MODIFIED
  } else {
    buttonText = t('purchase_button');
  }

  const handlePurchase = () => {
    if (!currentPricingOption) return;

    if (isCurrentPlan) {
      if (product.mode === 'subscription') {
        createCustomerPortalSession();
      }
      return;
    }

    // If it's a downgrade option, direct to customer portal
    if (isDowngradeOption) {
      createCustomerPortalSession();
    } else if (product.mode === 'payment' && isUsersCurrentPlanAdvanced) { // MODIFIED: Advanced plan users cannot purchase single-use
      return;
    } else if (product.name === 'product_name_enterprise_use' && (userMembership?.role === 'member' || userMembership?.status === 'invited')) {
      // 🚫 Block member from purchasing Enterprise Use
      return;
    } else if (product.name === 'product_name_professional_use' && billingPeriod === 'yearly' && (userMembership?.role === 'member' || userMembership?.status === 'invited')) { // ADDED: Block Professional Use yearly for members
      return;
    } else if (billingPeriod === 'yearly' && userMembership?.status === 'invited') { // MODIFIED: Block invited members from purchasing yearly
      return;
    } else if (product.mode === 'payment') {
      createCheckoutSession(currentPricingOption.priceId, 'payment', unauthenticatedRedirectPath); // MODIFIED: Pass unauthenticatedRedirectPath
    } else if (product.mode === 'subscription') {
      createCheckoutSession(currentPricingOption.priceId, 'subscription', unauthenticatedRedirectPath); // MODIFIED: Pass unauthenticatedRedirectPath
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
              <span className="font-semibold">{t('file_limit')}:</span> {t('up_to')} {product.maxFiles} {t('files_collectively')}. {/* MODIFIED: Clarify collective limit */}
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
      {isDisabledForSubscribers && product.mode === 'payment' && ( // MODIFIED: Use new isDisabledForSubscribers
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
          {t('included_in_your_advanced_plan')} {/* MODIFIED: New translation key */}
        </p>
      )}
      {isUsersCurrentPlanAdminAssigned && !isCurrentPlan && (product.tier === 2 || product.tier === 3) && ( // MODIFIED: Admin assigned users cannot buy other basic plans
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
          {t('no_payment_needed_admin_assigned')}
        </p>
      )}
      {isDowngradeOption && (userMembership?.role === 'member' || userMembership?.status === 'invited') && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
          {t('only_owner_manage_downgrades')}
        </p>
      )}
      {product.name === 'product_name_enterprise_use' && (userMembership?.role === 'member' || userMembership?.status === 'invited') && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
          {t('only_owner_upgrade_enterprise')}
        </p>
      )}
      {product.name === 'product_name_professional_use' && billingPeriod === 'yearly' && (userMembership?.role === 'member' || userMembership?.status === 'invited') && ( // ADDED: Specific message for Professional Use yearly
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
          {t('invited_members_cannot_purchase_yearly_message')}
        </p>
      )}
      {billingPeriod === 'yearly' && userMembership?.status === 'invited' && ( // MODIFIED
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
          {t('invited_members_cannot_purchase_yearly_message')}
        </p>
      )}
    </div>
  );
};

export default PricingCard;