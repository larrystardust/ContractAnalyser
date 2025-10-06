import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import StructuredData from '../components/StructuredData';
import { useTranslation } from 'react-i18next'; // ADDED
import { Helmet } from 'react-helmet-async'; // ADDED: Import Helmet

const PrivacyPolicyPage: React.FC = () => {
  const { t, i18n } = useTranslation(); // MODIFIED: Destructure i18n

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": t('privacy_policy_title'), // MODIFIED
    "url": "https://www.contractanalyser.com/privacy-policy",
    "description": t('privacy_policy_description'), // MODIFIED
    "publisher": {
      "@type": "Organization",
      "name": "ContractAnalyser",
      "url": "https://www.contractanalyser.com/"
    }
  };

  return (
    <>
      <Helmet> {/* ADDED: Helmet for meta description */}
        <html lang={i18n.language} /> {/* ADDED: lang attribute */}
        <title>{t('privacy_policy_title')}</title> {/* ADDED: Dynamic title */}
        <meta name="description" content={t('privacy_policy_page_meta_description')} />
      </Helmet>
      <StructuredData schema={webPageSchema} />
      <div className="container mx-auto px-4 py-6 mt-16">
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('back_to_landing_page')} {/* MODIFIED */}
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-6">{t('privacy_policy')}</h1> {/* MODIFIED */}
        <p className="text-sm text-gray-500 mb-8">{t('last_updated')}: August 12, 2025</p> {/* MODIFIED */}

        <p className="text-gray-700 mb-4">
          {t('privacy_policy_intro_p1')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 mb-4">
          {t('privacy_policy_intro_p2')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 mb-6">
          {t('privacy_policy_intro_p3')} {/* MODIFIED */}
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('information_collection_use')}</h2> {/* MODIFIED */}
        <p className="text-gray-700 mb-6">
          {t('information_collection_use_desc')} {/* MODIFIED */}
        </p>

        <h3 className="text-xl font-semibold text-gray-900 mb-4">{t('types_of_data_collected')}</h3> {/* MODIFIED */}
        <h4 className="text-lg font-semibold text-gray-900 mb-2">{t('personal_data')}</h4> {/* MODIFIED */}
        <p className="text-gray-700 mb-4">
          {t('personal_data_desc')} {/* MODIFIED */}
        </p>
        <ul className="list-disc list-inside text-gray-700 mb-4">
          <li>{t('email_address')}</li> {/* MODIFIED */}
          <li>{t('first_name_last_name')}</li> {/* MODIFIED */}
          <li>{t('phone_number')}</li> {/* MODIFIED */}
          <li>{t('address_city_etc')}</li> {/* MODIFIED */}
          <li>{t('cookies_usage_data')}</li> {/* MODIFIED */}
        </ul>

        <h4 className="text-lg font-semibold text-gray-900 mb-2">{t('usage_data')}</h4> {/* MODIFIED */}
        <p className="text-gray-700 mb-4">
          {t('usage_data_p1')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 mb-4">
          {t('usage_data_p2')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 mb-6">
          {t('usage_data_p3')} {/* MODIFIED */}
        </p>

        <h4 className="text-lg font-semibold text-gray-900 mb-2">{t('tracking_cookies_data')}</h4> {/* MODIFIED */}
        <p className="text-gray-700 mb-4">
          {t('tracking_cookies_data_p1')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 mb-4">
          {t('tracking_cookies_data_p2')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 mb-4">
          {t('tracking_cookies_data_p3')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 mb-2">{t('examples_of_cookies')}:</p> {/* MODIFIED */}
        <ul className="list-disc list-inside text-gray-700 mb-6">
          <li><strong>{t('session_cookies')}.</strong> {t('session_cookies_desc')}.</li> {/* MODIFIED */}
          <li><strong>{t('preference_cookies')}.</strong> {t('preference_cookies_desc')}.</li> {/* MODIFIED */}
          <li><strong>{t('security_cookies')}.</strong> {t('security_cookies_desc')}.</li> {/* MODIFIED */}
        </ul>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('use_of_data')}</h2> {/* MODIFIED */}
        <p className="text-gray-700 mb-4">
          {t('use_of_data_desc')} {/* MODIFIED */}
        </p>
        <ul className="list-disc list-inside text-gray-700 mb-6">
          <li>{t('to_provide_maintain_service')}</li> {/* MODIFIED */}
          <li>{t('to_notify_changes')}</li> {/* MODIFIED */}
          <li>{t('to_allow_interactive_features')}</li> {/* MODIFIED */}
          <li>{t('to_provide_customer_support')}</li> {/* MODIFIED */}
          <li>{t('to_gather_analysis')}</li> {/* MODIFIED */}
          <li>{t('to_monitor_usage')}</li> {/* MODIFIED */}
          <li>{t('to_detect_prevent_address_technical_issues')}</li> {/* MODIFIED */}
          <li>{t('to_provide_offers_info')}</li> {/* MODIFIED */}
        </ul>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('transfer_of_data')}</h2> {/* MODIFIED */}
        <p className="text-gray-700 mb-4">
          {t('transfer_of_data_p1')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 mb-4">
          {t('transfer_of_data_p2')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 mb-6">
          {t('transfer_of_data_p3')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 mb-6">
          {t('transfer_of_data_p4')} {/* MODIFIED */}
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('disclosure_of_data')}</h2> {/* MODIFIED */}
        <h3 className="text-xl font-semibold text-gray-900 mb-4">{t('legal_requirements')}</h3> {/* MODIFIED */}
        <p className="text-gray-700 mb-4">
          {t('legal_requirements_desc')} {/* MODIFIED */}
        </p>
        <ul className="list-disc list-inside text-gray-700 mb-6">
          <li>{t('to_comply_legal_obligation')}</li> {/* MODIFIED */}
          <li>{t('to_protect_defend_rights')}</li> {/* MODIFIED */}
          <li>{t('to_prevent_investigate_wrongdoing')}</li> {/* MODIFIED */}
          <li>{t('to_protect_personal_safety')}</li> {/* MODIFIED */}
          <li>{t('to_protect_against_legal_liability')}</li> {/* MODIFIED */}
        </ul>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('security_of_data')}</h2> {/* MODIFIED */}
        <p className="text-gray-700 mb-6">
          {t('security_of_data_desc')} {/* MODIFIED */}
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('service_providers')}</h2> {/* MODIFIED */}
        <p className="text-gray-700 mb-4">
          {t('service_providers_p1')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 mb-6">
          {t('service_providers_p2')} {/* MODIFIED */}
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('links_to_other_sites')}</h2> {/* MODIFIED */}
        <p className="text-gray-700 mb-4">
          {t('links_to_other_sites_p1')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 mb-6">
          {t('links_to_other_sites_p2')} {/* MODIFIED */}
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('childrens_privacy')}</h2> {/* MODIFIED */}
        <p className="text-gray-700 mb-4">
          {t('childrens_privacy_p1')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 mb-4">
          {t('childrens_privacy_p2')} {/* MODIFIED */}
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('changes_to_privacy_policy')}</h2> {/* MODIFIED */}
        <p className="text-gray-700 mb-4">
          {t('changes_to_privacy_policy_p1')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 mb-4">
          {t('changes_to_privacy_policy_p2')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 mb-6">
          {t('changes_to_privacy_policy_p3')} {/* MODIFIED */}
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('contact_us')}</h2> {/* MODIFIED */}
        <p className="text-gray-700 mb-6">
          {t('contact_us_privacy_desc')} {/* MODIFIED */}
        </p>
      </div>
    </>
  );
};

export default PrivacyPolicyPage;