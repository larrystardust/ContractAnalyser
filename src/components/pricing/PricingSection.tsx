import React, { useState } from 'react';
import { stripeProducts } from '../../../supabase/functions/_shared/stripe_products_data';
import PricingCard from './PricingCard';
import { useSession } from '@supabase/auth-helpers-react';
import { useSubscription } from '../../hooks/useSubscription';
import StructuredData from '../StructuredData'; // ADDED: Import StructuredData

const PricingSection: React.FC = () => {
  console.log('PricingSection component rendered');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

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
        // "priceValidUntil": "2025-12-31", // REMOVED: priceValidUntil
        "itemCondition": "https://schema.org/NewCondition",
        "availability": "https://schema.org/InStock",
        "url": "https://www.contractanalyser.com/pricing",
        "name": `${product.name} (Monthly)`
      });
    }
    if (product.pricing.yearly) {
      offers.push({
        "@type": "Offer",
        "priceCurrency": "USD",
        "price": product.pricing.yearly.price.toFixed(2),
        // "priceValidUntil": "2025-12-31", // REMOVED: priceValidUntil
        "itemCondition": "https://schema.org/NewCondition",
        "availability": "https://schema.org/InStock",
        "url": "https://www.contractanalyser.com/pricing",
        "name": `${product.name} (Yearly)`
      });
    }
    if (product.pricing.one_time) {
      offers.push({
        "@type": "Offer",
        "priceCurrency": "USD",
        "price": product.pricing.one_time.price.toFixed(2),
        // "priceValidUntil": "2025-12-31", // REMOVED: priceValidUntil
        "itemCondition": "https://schema.org/NewCondition",
        "availability": "https://schema.org/InStock",
        "url": "https://www.contractanalyser.com/pricing",
        "name": `${product.name} (One-Time)`
      });
    }

    return {
      "@context": "https://schema.org",
      "@type": "Product", // Or Service, depending on how you categorize
      "name": product.name,
      "description": product.description,
      "brand": {
        "@type": "Brand",
        "name": "ContractAnalyser"
      },
      "offers": offers.length > 1 ? offers : offers[0] // If multiple offers, use array, else single object
    };
  });

  // --- START OF CRITICAL FIX ---
  // Block rendering until both session and subscription are fully loaded
  if (isSessionLoading || loadingSubscription) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
        <p className="text-gray-500 mt-4">Loading pricing information...</p>
      </div>
    );
  }

  // If session exists but user.id is not hydrated yet, keep loading
  if (session && !session.user?.id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
        <p className="text-gray-500 mt-4">Loading user data...</p>
      </div>
    );
  }
  // --- END OF CRITICAL FIX ---

  return (
    <>
      {productSchema.map((schema, index) => (
        <StructuredData key={index} schema={schema} />
      ))} {/* ADDED: Structured Data for each product */}
      <div className="py-12 bg-gray-50 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-xl text-gray-600">
              Choose the plan that best fits your needs
            </p>
          </div>
          
          <div className="flex justify-center mt-8 mb-12">
            <div className="inline-flex rounded-md shadow-sm" role="group">
              <button
                type="button"
                onClick={() => setBillingPeriod('monthly')}
                className={`px-4 py-2 text-sm font-medium rounded-l-md focus:z-10 focus:outline-none focus:ring-2 focus:ring-blue-500
                  ${billingPeriod === 'monthly' ? 'bg-blue-900 text-white' : 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-300'}`}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => setBillingPeriod('yearly')}
                className={`px-4 py-2 text-sm font-medium rounded-r-md focus:z-10 focus:outline-none focus:ring-2 focus:ring-blue-500
                  ${billingPeriod === 'yearly' ? 'bg-blue-900 text-white' : 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-300'}`}
              >
                Yearly Billing
              </button>
            </div>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            {publicProducts.map((product) => (
              <PricingCard
                key={product.id}
                product={product}
                billingPeriod={billingPeriod}
                // session.user.id is guaranteed if session exists
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