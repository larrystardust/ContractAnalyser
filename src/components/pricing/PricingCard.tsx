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
}

const PricingCard: React.FC<PricingCardProps> = ({
  product,
  billingPeriod,
  currentSessionUserId,
  userSubscription,
  userMembership,
  isDataLoading = false,
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
  const isAnyAdminAssignedPlanActive = isUsersCurrentPlanAdminAssigned;

  const isCurrentPlan = userSubscription?.price_id === currentPricingOption.priceId;

  const isDowngradeOption = usersCurrentProduct &&
                            product.mode === 'subscription' &&
                            usersCurrentProduct.mode === 'subscription' &&
                            product.tier < usersCurrentProduct.tier;

  const isDisabledForSubscribers = product.mode === 'payment' &&
                                   (userSubscription && (userSubscription.status === 'active' || userSubscription.status === 'trialing'));

  let shouldBeDisabled = isDataLoading; 

  if (!shouldBeDisabled) { 
    if (isCurrentPlan) {
      shouldBeDisabled = true;
    } else if (isDisabledForSubscribers) {
      shouldBeDisabled = true;
    } else if (isAnyAdminAssignedPlanActive && !isCurrentPlan) {
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
  } else if (isAnyAdminAssignedPlanActive && !isCurrentPlan) {
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
    } else if (product.name === 'product_name_enterprise_use' && (userMembership?.role === 'member' || userMembership?.status === 'invited')) {
      // 🚫 Block member from purchasing Enterprise Use
      return;
    } else if (product.name === 'product_name_professional_use' && billingPeriod === 'yearly' && (userMembership?.role === 'member' || userMembership?.status === 'invited')) { // ADDED: Block Professional Use yearly for members
      return;
    } else if (billingPeriod === 'yearly' && userMembership?.status === 'invited') { // MODIFIED: Block invited members from purchasing yearly
      return;
    } else if (product.mode === 'payment') {
      createCheckoutSession(currentPricingOption.priceId, 'payment');
    } else if (product.mode === 'subscription') {
      createCheckoutSession(currentPricingOption.priceId, 'subscription');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <h3 className="text-2xl font-bold text-gray-900 mb-4">{t(product.name)}</h3>
      <p className="text-gray-600 mb-6">{t(product.description)}</p>
      
      <div className="mb-6">
        <span className="text-4xl font-extrabold text-gray-900">
          ${currentPricingOption.price.toFixed(2)}
        </span>
        {currentPricingOption.interval === 'month' && <span className="text-gray-600">/{t('month')}</span>}
        {currentPricingOption.interval === 'year' && <span className="text-gray-600">/{t('year')}</span>}
        {currentPricingOption.interval === 'one_time' && product.credits && <span className="text-gray-600"> {t('for_credits', { count: product.credits })}</span>}
      </div>

      {product.fileRetentionPolicy && (
        <p className="text-sm text-gray-500 mb-6">
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
      {isDisabledForSubscribers && product.mode === 'payment' && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          {t('already_covered_by_subscription')}
        </p>
      )}
      {isAnyAdminAssignedPlanActive && !isCurrentPlan && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          {t('no_payment_needed_admin_assigned')}
        </p>
      )}
      {isDowngradeOption && (userMembership?.role === 'member' || userMembership?.status === 'invited') && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          {t('only_owner_manage_downgrades')}
        </p>
      )}
      {product.name === 'product_name_enterprise_use' && (userMembership?.role === 'member' || userMembership?.status === 'invited') && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          {t('only_owner_upgrade_enterprise')}
        </p>
      )}
      {product.name === 'product_name_professional_use' && billingPeriod === 'yearly' && (userMembership?.role === 'member' || userMembership?.status === 'invited') && ( // ADDED: Specific message for Professional Use yearly
        <p className="text-xs text-gray-500 mt-2 text-center">
          {t('invited_members_cannot_purchase_yearly_message')}
        </p>
      )}
      {billingPeriod === 'yearly' && userMembership?.status === 'invited' && ( // MODIFIED
        <p className="text-xs text-gray-500 mt-2 text-center">
          {t('invited_members_cannot_purchase_yearly_message')}
        </p>
      )}
    </div>
  );
};

export default PricingCard;