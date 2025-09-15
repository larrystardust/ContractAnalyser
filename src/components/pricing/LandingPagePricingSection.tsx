import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { stripeProducts } from '../../../supabase/functions/_shared/stripe_products_data';
import PricingCard from './PricingCard';
import StructuredData from '../StructuredData';
import { useTranslation } from 'react-i18next'; // ADDED

const LandingPagePricingSection: React.FC = () => {
  console.log('LandingPagePricingSection component rendered');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const { t } = useTranslation(); // ADDED

  // Filter out products that are for admin assignment only
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
        "url": "https://www.contractanalyser.com/landing-pricing",
        "name": `${product.name} (${t('monthly')})` // MODIFIED
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
        "url": "https://www.contractanalyser.com/landing-pricing",
        "name": `${product.name} (${t('yearly')})` // MODIFIED
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
        "url": "https://www.contractanalyser.com/landing-pricing",
        "name": `${product.name} (${t('one_time')})` // MODIFIED
      });
    }

    return {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": product.name,
      "description": product.description,
      "brand": {
        "@type": "Brand",
        "name": "ContractAnalyser"
      },
      "offers": offers.length > 1 ? offers : offers
    };
  });

  return (
    <>
      {productSchema.map((schema, index) => (
        <StructuredData key={index} schema={schema} />
      ))}
      <div className="py-12 bg-gray-50 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <Link to="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('back_to_landing_page_button')} {/* MODIFIED */}
            </Link>
          </div>

          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
              {t('simple_transparent_pricing_landing')} {/* MODIFIED */}
            </h2>
            <p className="mt-4 text-xl text-gray-600">
              {t('choose_best_plan_landing')} {/* MODIFIED */}
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
                {t('monthly_billing_landing')} {/* MODIFIED */}
              </button>
              <button
                type="button"
                onClick={() => setBillingPeriod('yearly')}
                className={`px-4 py-2 text-sm font-medium rounded-r-md focus:z-10 focus:outline-none focus:ring-2 focus:ring-blue-500
                  ${billingPeriod === 'yearly' ? 'bg-blue-900 text-white' : 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-300'}`}
              >
                {t('yearly_billing_landing')} {/* MODIFIED */}
              </button>
            </div>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            {publicProducts.map((product) => (
              <PricingCard key={product.id} product={product} billingPeriod={billingPeriod} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default LandingPagePricingSection;