import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import StructuredData from '../components/StructuredData';
import { useTranslation } from 'react-i18next'; // ADDED
import { Helmet } from 'react-helmet-async'; // ADDED: Import Helmet

const TermsPage: React.FC = () => {
  const { t, i18n } = useTranslation(); // MODIFIED: Destructure i18n

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": t('terms_of_service_title'), // MODIFIED
    "url": "https://contractanalyser.com/terms",
    "description": t('terms_of_service_description'), // MODIFIED
    "publisher": {
      "@type": "Organization",
      "name": "ContractAnalyser",
      "url": "https://contractanalyser.com/"
    }
  };

  return (
    <>
      <Helmet> {/* ADDED: Helmet for meta description */}
        <html lang={i18n.language} /> {/* ADDED: lang attribute */}
        <title>{t('terms_of_service_title')}</title> {/* ADDED: Dynamic title */}
        <meta name="description" content={t('terms_page_meta_description')} />
      </Helmet>
      <StructuredData schema={webPageSchema} />
      <div className="container mx-auto px-4 py-6 mt-16 dark:bg-gray-800 dark:text-gray-200"> {/* MODIFIED: Added dark mode styles */}
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('back_to_landing_page')} {/* MODIFIED */}
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">{t('terms_of_service')}</h1> {/* MODIFIED */}
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">{t('last_updated')}: August 12, 2025</p> {/* MODIFIED */}

        <p className="text-gray-700 dark:text-gray-200 mb-4">
          {t('terms_intro_p1')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 dark:text-gray-200 mb-4">
          {t('terms_intro_p2')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 dark:text-gray-200 mb-6">
          {t('terms_intro_p3')} {/* MODIFIED */}
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('accounts')}</h2> {/* MODIFIED */}
        <p className="text-gray-700 dark:text-gray-200 mb-4">
          {t('accounts_p1')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 dark:text-gray-200 mb-4">
          {t('accounts_p2')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 dark:text-gray-200 mb-6">
          {t('accounts_p3')} {/* MODIFIED */}
        </p>

        {/* MODIFIED: Data Retention Policy Section */}
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('data_retention_policy_title')}</h2> {/* MODIFIED */}
        <p className="text-gray-700 dark:text-gray-200 mb-4">
          {t('data_retention_policy_intro')} {/* MODIFIED */}
        </p>
        <ul className="list-disc list-inside text-gray-700 dark:text-gray-200 mb-6 space-y-2">
          <li>
            {/* MODIFIED: Updated description for single-use purchases */}
            <strong>{t('single_use_purchases_label')}:</strong> {t('single_use_purchases_terms_desc_credits')}
          </li>
          <li>
            <strong>{t('active_subscription_plans_label')}:</strong> {t('active_subscription_plans_terms_desc')} {/* MODIFIED */}
          </li>
          <li>
            <strong>{t('purpose_of_policy')}:</strong> {t('purpose_of_policy_desc')} {/* MODIFIED */}
          </li>
        </ul>

        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('intellectual_property')}</h2> {/* MODIFIED */}
        <p className="text-gray-700 dark:text-gray-200 mb-6">
          {t('intellectual_property_desc')} {/* MODIFIED */}
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('links_to_other_websites')}</h2> {/* MODIFIED */}
        <p className="text-gray-700 dark:text-gray-200 mb-4">
          {t('links_to_other_websites_p1')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 dark:text-gray-200 mb-4">
          {t('links_to_other_websites_p2')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 dark:text-gray-200 mb-6">
          {t('links_to_other_websites_p3')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 dark:text-gray-200 mb-6">
          {t('links_to_other_websites_p4')} {/* MODIFIED */}
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('termination')}</h2> {/* MODIFIED */}
        <p className="text-gray-700 dark:text-gray-200 mb-4">
          {t('termination_p1')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 dark:text-gray-200 mb-4">
          {t('termination_p2')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 dark:text-gray-200 mb-6">
          {t('termination_p3')} {/* MODIFIED */}
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('indemnification')}</h2> {/* MODIFIED */}
        <p className="text-gray-700 dark:text-gray-200 mb-6">
          {t('indemnification_desc')} {/* MODIFIED */}
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('limitation_of_liability')}</h2> {/* MODIFIED */}
        <p className="text-gray-700 dark:text-gray-200 mb-6">
          {t('limitation_of_liability_desc')} {/* MODIFIED */}
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('disclaimer_section')}</h2> {/* MODIFIED */}
        <p className="text-gray-700 dark:text-gray-200 mb-4">
          {t('disclaimer_section_p1')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 dark:text-gray-200 mb-6">
          {t('disclaimer_section_p2')} {/* MODIFIED */}
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('governing_law')}</h2> {/* MODIFIED */}
        <p className="text-gray-700 dark:text-gray-200 mb-4">
          {t('governing_law_p1')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 dark:text-gray-200 mb-6">
          {t('governing_law_p2')} {/* MODIFIED */}
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('changes')}</h2> {/* MODIFIED */}
        <p className="text-gray-700 dark:text-gray-200 mb-4">
          {t('changes_p1')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 dark:text-gray-200 mb-4">
          {t('changes_p2')} {/* MODIFIED */}
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('contact_us')}</h2> {/* MODIFIED */}
        <p className="text-gray-700 dark:text-gray-200 mb-6">
          {t('contact_us_terms_desc')} {/* MODIFIED */}
        </p>
      </div>
    </>
  );
};

export default TermsPage;