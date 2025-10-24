import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { stripeProducts } from '../../../supabase/functions/_shared/stripe_products_data';
import PricingCard from './PricingCard';
import StructuredData from '../StructuredData';
import { useTranslation } from 'react-i18next';
import { StripeProduct } from '../../../supabase/functions/_shared/stripe_product_types'; // ADDED

// ADDED: Interface for grouping products into sections
interface PricingSectionGroup {
  type: 'single' | 'professional' | 'enterprise';
  products: StripeProduct[];
  wrapperClasses?: string;
}

const LandingPagePricingSection: React.FC = () => {
  // console.log('LandingPagePricingSection component rendered'); // REMOVED
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const { t } = useTranslation();

  // Filter out products that are for admin assignment only
  const publicProducts = stripeProducts.filter(product => 
    product.mode === 'payment' || product.mode === 'subscription'
  );

  // MODIFIED: Group products into sections with specific styling
  const pricingSections: PricingSectionGroup[] = [];

  // Single Use Product
  const singleUseProduct = publicProducts.find(p => p.id === 'prod_T2cDZNI5VjVdp5');
  if (singleUseProduct) {
    pricingSections.push({ type: 'single', products: [singleUseProduct] });
  }

  // Professional Group
  const professionalBase = publicProducts.find(p => p.id === 'prod_T2cJ7cQzgeS3Ku');
  const professionalAdvanced = publicProducts.find(p => p.id === 'prod_AdvancedProfessional');
  if (professionalBase) {
    const professionalGroup: StripeProduct[] = [professionalBase];
    if (professionalAdvanced) professionalGroup.push(professionalAdvanced);
    pricingSections.push({
      type: 'professional',
      products: professionalGroup,
      wrapperClasses: "border-4 border-yellow-500 p-4 rounded-lg"
    });
  }

  // Enterprise Group
  const enterpriseBase = publicProducts.find(p => p.id === 'prod_T2cLOwJZatHP03');
  const enterpriseAdvanced = publicProducts.find(p => p.id === 'prod_AdvancedEnterprise');
  if (enterpriseBase) {
    const enterpriseGroup: StripeProduct[] = [enterpriseBase];
    if (enterpriseAdvanced) enterpriseGroup.push(enterpriseAdvanced);
    pricingSections.push({
      type: 'enterprise',
      products: enterpriseGroup,
      wrapperClasses: "border-4 border-blue-500 p-4 rounded-lg"
    });
  }

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
        "url": "https://contractanalyser.com/landing-pricing",
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
        "url": "https://contractanalyser.com/landing-pricing",
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

  return (
    <>
      {productSchema.map((schema, index) => (
        <StructuredData key={index} schema={schema} />
      ))}
      <div className="py-12 bg-gray-50 mt-16 dark:bg-gray-700 dark:text-gray-200"> {/* MODIFIED: Added dark mode styles */} 
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <Link to="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('back_to_landing_page_button')}
            </Link>
          </div>

          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl"> {/* MODIFIED */}
              {t('simple_transparent_pricing_landing')}
            </h2>
            <p className="mt-4 text-xl text-gray-600 dark:text-gray-300"> {/* MODIFIED */}
              {t('choose_best_plan_landing')}
            </p>
          </div>
          
          <div className="flex justify-center mt-8 mb-12">
            <div className="inline-flex rounded-md shadow-sm" role="group">
              <button
                type="button"
                onClick={() => setBillingPeriod('monthly')}
                className={`px-4 py-2 text-sm font-medium rounded-l-md focus:z-10 focus:outline-none focus:ring-2 focus:ring-blue-500
                  ${billingPeriod === 'monthly' ? 'bg-blue-900 text-white' : 'bg-white text-gray-900 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'}`} /* MODIFIED */ 
              >
                {t('monthly_billing_landing')}
              </button>
              <button
                type="button"
                onClick={() => setBillingPeriod('yearly')}
                className={`px-4 py-2 text-sm font-medium rounded-r-md focus:z-10 focus:outline-none focus:ring-2 focus:ring-blue-500
                  ${billingPeriod === 'yearly' ? 'bg-blue-900 text-white' : 'bg-white text-gray-900 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'}`} /* MODIFIED */ 
              >
                {t('yearly_billing_landing')}
              </button>
            </div>
          </div>

          {/* MODIFIED: Render pricing sections */}
          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            {pricingSections.map((section, sectionIndex) => (
              <React.Fragment key={section.type}>
                {section.type === 'single' ? (
                  <PricingCard
                    product={section.products[0]}
                    billingPeriod={billingPeriod}
                    unauthenticatedRedirectPath="/signup" // MODIFIED: Pass unauthenticatedRedirectPath
                  />
                ) : (
                  <div className={`lg:col-span-2 ${section.wrapperClasses || ''}`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {section.products.map(product => (
                        <PricingCard
                          key={product.id}
                          product={product}
                          billingPeriod={billingPeriod}
                          unauthenticatedRedirectPath="/signup" // MODIFIED: Pass unauthenticatedRedirectPath
                        />
                      ))}
                    </div>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default LandingPagePricingSection;