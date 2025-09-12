import React, { useState } from 'react';
import { stripeProducts } from '../../../supabase/functions/_shared/stripe_products_data';
import PricingCard from './PricingCard';
import { useSession } from '@supabase/auth-helpers-react';
import { useSubscription } from '../../hooks/useSubscription';
import { Loader2 } from 'lucide-react';

const PricingSection: React.FC = () => {
  console.log('PricingSection component rendered');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const { session, isLoading: isSessionLoading } = useSession();
  const { subscription, membership, loading: loadingSubscription } = useSubscription();

  const publicProducts = stripeProducts.filter(product => 
    product.mode === 'payment' || product.mode === 'subscription'
  );

  // Determine if the user is logged in and their ID is available
  const isLoggedInAndIdAvailable = session && session.user && session.user.id;

  // Handle loading state:
  // 1. If session or subscription data is still loading.
  // 2. If session is loaded but user is logged in (session is not null) AND user.id is not yet available.
  if (isSessionLoading || loadingSubscription || (session && !isLoggedInAndIdAvailable)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
        <p className="text-gray-500 mt-4">Loading pricing information...</p>
      </div>
    );
  }

  return (
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
              // Pass the user ID only if it's available, otherwise null
              currentSessionUserId={isLoggedInAndIdAvailable ? session.user.id : null}
              userSubscription={subscription}
              userMembership={membership}
              isDataLoading={isSessionLoading || loadingSubscription}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default PricingSection;