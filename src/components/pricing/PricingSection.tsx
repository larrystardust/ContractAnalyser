import React, { useState } from 'react';
import { stripeProducts } from '../../../supabase/functions/_shared/stripe_products_data';
import PricingCard from './PricingCard';
import { useSession } from '@supabase/auth-helpers-react';
import { useSubscription } from '../../hooks/useSubscription';
import StructuredData from '../StructuredData';
import { useTranslation } from 'react-i18next';

const PricingSection: React.FC = () => {
  // console.log('PricingSection component rendered'); // REMOVED
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const { t } = useTranslation();

  const { session, isLoading: isSessionLoading } = useSession();
  const { subscription, membership, loading: loadingSubscription } = useSubscription();

  const publicProducts = stripeProducts.filter(product => 
    product.mode === 'payment' || product.mode === 'subscription'
  );

  // Generate Product schema for each public product
  const productSchema = publicProducts.map(product => {
    const offers: any[] = [];
    if (product.pricing.monthly) {
      offers.push({
        "@type": "Offer",
        "priceCurrency": "USD",
        "price": product.pricing.monthly.price.toFixed(2),
        "itemCondition": "https://schema.org/NewCondition",
        "availability": "https://schema.org/InStock",
        "url": "https://contractanalyser.com/pricing",
        "name": `${t(product.name)} (${t('monthly')})` // MODIFIED: Translate product name
      });
    }
    if (product.pricing.yearly) {
      offers.push({
        "@type": "Offer",
        "priceCurrency": "USD",
        "price": product.pricing.yearly.price.toFixed(2),
        "itemCondition": "https://schema.org/NewCondition",
        "availability": "https://schema.org/InStock",
        "url": "https://contractanalyser.com/pricing",
        "name": `${t(product.name)} (${t('yearly')})` // MODIFIED: Translate product name
      });
    }
    if (product.pricing.one_time) {
      offers.push({
        "@type": "Offer",
        "priceCurrency": "USD",
        "price": product.pricing.one_time.price.toFixed(2),
        "itemCondition": "https://schema.org/NewCondition",
        "availability": "https://schema.org/InStock",
        // MODIFIED: Update name to reflect credits
        "name": `${t(product.name)} (${t('for_credits', { count: product.credits })})`
      });
    }

    return {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": t(product.name), // MODIFIED: Translate product name
      "description": t(product.description), // MODIFIED: Translate product description
      "brand": {
        "@type": "Brand",
        "name": "ContractAnalyser"
      },
      "offers": offers.length > 1 ? offers : offers
    };
  });

  // Block rendering until both session and subscription are fully loaded
  if (isSessionLoading || loadingSubscription) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
        <p className="text-gray-500 mt-4">{t('loading_pricing_information')}...</p>
      </div>
    );
  }

  // If session exists but user.id is not hydrated yet, keep loading
  if (session && !session.user?.id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
        <p className="text-gray-500 mt-4">{t('loading_user_data')}...</p>
      </div>
    );
  }

  return (
    <>
      {productSchema.map((schema, index) => (
        <StructuredData key={index} schema={schema} />
      ))}
      <div className="py-12 bg-gray-50 mt-16 dark:bg-gray-700 dark:text-gray-200"> {/* MODIFIED: Added dark mode styles */} 
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl"> {/* MODIFIED */}
              {t('simple_transparent_pricing')}
            </h2>
            <p className="mt-4 text-xl text-gray-600 dark:text-gray-300"> {/* MODIFIED */}
              {t('choose_best_plan')}
            </p>
          </div>
          
          <div className="flex justify-center mt-8 mb-12">
            <div className="inline-flex rounded-md shadow-sm" role="group">
              {/* MODIFIED: Text for dark mode */}
              <button
                type="button"
                onClick={() => setBillingPeriod('monthly')}
                className={`px-4 py-2 text-sm font-medium rounded-l-md focus:z-10 focus:outline-none focus:ring-2 focus:ring-blue-500
                  ${billingPeriod === 'monthly' ? 'bg-blue-900 text-white' : 'bg-white text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'}`} 
              >
                {t('monthly_billing')}
              </button>
              <button
                type="button"
                onClick={() => setBillingPeriod('yearly')}
                className={`px-4 py-2 text-sm font-medium rounded-r-md focus:z-10 focus:outline-none focus:ring-2 focus:ring-blue-500
                  ${billingPeriod === 'yearly' ? 'bg-blue-900 text-white' : 'bg-white text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'}`} 
              >
                {t('yearly_billing')}
              </button>
            </div>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            {publicProducts.map((product) => (
              <PricingCard
                key={product.id}
                product={product}
                billingPeriod={billingPeriod}
                currentSessionUserId={session?.user?.id || null}
                userSubscription={subscription}
                userMembership={membership}
                isDataLoading={false} 
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default PricingSection;