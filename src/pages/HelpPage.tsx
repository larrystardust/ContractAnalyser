import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ContactForm from '../components/forms/ContactForm';
import { ArrowLeft } from 'lucide-react';
import StructuredData from '../components/StructuredData';
import { useTranslation } from 'react-i18next';

const HelpPage: React.FC = () => {
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const { t } = useTranslation();

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": t('what_is_contractanalyser_q'),
        "acceptedAnswer": {
          "@type": "Answer",
          "text": t('what_is_contractanalyser_a')
        }
      },
      {
        "@type": "Question",
        "name": t('how_do_i_sign_up_q'),
        "acceptedAnswer": {
          "@type": "Answer",
          "text": t('how_do_i_sign_up_a')
        }
      },
      {
        "@type": "Question",
        "name": t('what_file_types_q'),
        "acceptedAnswer": {
          "@type": "Answer",
          "text": t('what_file_types_a')
        }
      },
      {
        "@type": "Question",
        "name": t('how_long_retained_q'),
        "acceptedAnswer": {
          "@type": "Answer",
          "text": t('how_long_retained_a')
        }
      }
    ]
  };

  const contactPointSchema = {
    "@context": "https://schema.org",
    "@type": "ContactPoint",
    // "telephone": "+44-7405016688",
    "contactType": "customer service",
    // "email": "support@contractanalyser.com",
    "url": "https://www.contractanalyser.com/help"
  };

  return (
    <>
      <StructuredData schema={faqSchema} />
      <StructuredData schema={contactPointSchema} />
      <div className="container mx-auto px-4 py-6 mt-16">
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('back_to_landing_page')}
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-6">{t('help_center')}</h1>
        <p className="text-sm text-gray-500 mb-8">{t('last_updated')}: August 12, 2025</p>

        <p className="text-gray-700 mb-6">
          {t('welcome_help_center')}
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('getting_started')}</h2>
        <ul className="list-disc list-inside text-gray-700 mb-6 space-y-2">
          <li>
            <strong>{t('what_is_contractanalyser_q')}</strong>
            <p className="ml-4">{t('what_is_contractanalyser_a')}</p>
          </li>
          <li>
            <strong>{t('how_do_i_sign_up_q')}</strong>
            <p className="ml-4">{t('how_do_i_sign_up_a')}</p>
          </li>
          <li>
            <strong>{t('what_file_types_q')}</strong>
            <p className="ml-4">{t('what_file_types_a')}</p>
          </li>
        </ul>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('uploading_contracts')}</h2>
        <ul className="list-disc list-inside text-gray-700 mb-6 space-y-2">
          <li>
            <strong>{t('how_to_upload_contract_q')}</strong>
            <p className="ml-4">{t('how_to_upload_contract_a')}</p>
          </li>
          <li>
            <strong>{t('what_jurisdictions_q')}</strong>
            <p className="ml-4">{t('what_jurisdictions_a')}</p>
          </li>
          <li>
            <strong>{t('how_long_analysis_q')}</strong>
            <p className="ml-4">{t('how_long_analysis_a')}</p>
          </li>
        </ul>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('understanding_analysis_results')}</h2>
        <ul className="list-disc list-inside text-gray-700 mb-6 space-y-2">
          <li>
            <strong>{t('what_is_executive_summary_q')}</strong>
            <p className="ml-4">{t('what_is_executive_summary_a')}</p>
          </li>
          <li>
            <strong>{t('what_are_findings_q')}</strong>
            <p className="ml-4">{t('what_are_findings_a')}</p>
          </li>
          <li>
            <strong>{t('what_risk_levels_mean_q')}</strong>
            <p className="ml-4">{t('what_risk_levels_mean_a')}</p>
            <ul className="list-circle list-inside text-gray-700 ml-8 mt-1">
              <li><strong>{t('high_risk_label')}:</strong> {t('high_risk_desc')}.</li>
              <li><strong>{t('medium_risk_label')}:</strong> {t('medium_risk_desc')}.</li>
              <li><strong>{t('low_risk_label')}:</strong> {t('low_risk_desc')}.</li>
              <li><strong>{t('no_risk_label')}:</strong> {t('no_risk_desc')}.</li>
            </ul>
          </li>
          <li>
            <strong>{t('what_is_compliance_score_q')}</strong>
            <p className="ml-4">{t('what_is_compliance_score_a')}</p>
          </li>
          <li>
            <strong>{t('what_is_data_protection_impact_q')}</strong>
            <p className="ml-4">{t('what_is_data_protection_impact_a')}</p>
          </li>
        </ul>

        {/* MODIFIED: Data Retention Policy Section */}
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('data_retention_policy_title')}</h2>
        <ul className="list-disc list-inside text-gray-700 mb-6 space-y-2">
          <li>
            <strong>{t('how_long_retained_q')}</strong>
            <p className="ml-4">
              {t('retention_period_depends')}
            </p>
            <ul className="list-circle list-inside text-gray-700 ml-8 mt-1">
              <li>
                {/* MODIFIED: Updated description for single-use purchases */}
                <strong>{t('single_use_purchases_label')}:</strong> {t('single_use_purchases_desc_credits')}
              </li>
              <li>
                <strong>{t('active_subscription_plans_label')}:</strong> {t('active_subscription_plans_desc')}
              </li>
            </ul>
          </li>
          <li>
            <strong>{t('why_data_retention_policy_q')}</strong>
            <p className="ml-4">
              {t('why_data_retention_policy_a')}
            </p>
          </li>
        </ul>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('account_billing')}</h2>
        <ul className="list-disc list-inside text-gray-700 mb-6 space-y-2">
          <li>
            <strong>{t('update_profile_q')}</strong>
            <p className="ml-4">{t('update_profile_a')}</p>
          </li>
          <li>
            <strong>{t('change_password_q')}</strong>
            <p className="ml-4">{t('change_password_a')}</p>
          </li>
          <li>
            <strong>{t('manage_subscription_q')}</strong>
            <p className="ml-4">{t('manage_subscription_a')}</p>
          </li>
          <li>
            <strong>{t('payment_methods_q')}</strong>
            <p className="ml-4">{t('payment_methods_a')}</p>
          </li>
        </ul>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('troubleshooting')}</h2>
        <ul className="list-disc list-inside text-gray-700 mb-6 space-y-2">
          <li>
            <strong>{t('upload_failed_q')}</strong>
            <p className="ml-4">{t('upload_failed_a')}</p>
          </li>
          <li>
            <strong>{t('contract_stuck_q')}</strong>
            <p className="ml-4">{t('contract_stuck_a')}</p>
          </li>
          <li>
            <strong>{t('analysis_failed_q')}</strong>
            <p className="ml-4">{t('analysis_failed_a')}</p>
          </li>
          <li>
            <strong>{t('forgot_password_q_troubleshoot')}</strong>
            <p className="ml-4">{t('forgot_password_a_troubleshoot')}</p>
          </li>
        </ul>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('contact_support')}</h2>
        <p className="text-gray-700 mb-4">
          {t('cant_find_answer')}
        </p>
        <ul className="list-disc list-inside text-gray-700 mb-6 space-y-2">
          <li><strong>{t('click_contact_us')}:</strong> {t('contact_us_below')}</li>
        </ul>
        <p className="text-gray-700 mb-6">
          {t('support_team_hours')}
        </p>

        <div className="mt-8 text-center">
          <Button variant="primary" onClick={() => setIsContactModalOpen(true)}>
            {t('contact_us')}
          </Button>
        </div>

        <Modal
          isOpen={isContactModalOpen}
          onClose={() => setIsContactModalOpen(false)}
          title={t('contact_us')}
        >
          <ContactForm />
        </Modal>
      </div>
    </>
  );
};

export default HelpPage;