import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import StructuredData from '../components/StructuredData';
import { useTranslation } from 'react-i18next'; // ADDED
import { Helmet } from 'react-helmet-async'; // ADDED: Import Helmet

const DisclaimerPage: React.FC = () => {
  const { t } = useTranslation(); // ADDED

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": t('disclaimer_title'), // MODIFIED
    "url": "https://www.contractanalyser.com/disclaimer",
    "description": t('disclaimer_description'), // MODIFIED
    "publisher": {
      "@type": "Organization",
      "name": "ContractAnalyser",
      "url": "https://www.contractanalyser.com/"
    }
  };

  return (
    <>
      <Helmet> {/* ADDED: Helmet for meta description */}
        <meta name="description" content={t('disclaimer_page_meta_description')} />
      </Helmet>
      <StructuredData schema={webPageSchema} />
      <div className="container mx-auto px-4 py-6 mt-16">
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('back_to_landing_page')} {/* MODIFIED */}
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-6">{t('disclaimer_section')}</h1> {/* MODIFIED */}
        <p className="text-sm text-gray-500 mb-8">{t('last_updated')}: August 12, 2025</p> {/* MODIFIED */}

        <p className="text-gray-700 mb-4">
          {t('disclaimer_p1')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 mb-6">
          {t('disclaimer_p2')} {/* MODIFIED */}
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('professional_disclaimer')}</h2> {/* MODIFIED */}
        <p className="text-gray-700 mb-4">
          {t('professional_disclaimer_p1')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 mb-6">
          {t('professional_disclaimer_p2')} {/* MODIFIED */}
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('external_links_disclaimer')}</h2> {/* MODIFIED */}
        <p className="text-gray-700 mb-4">
          {t('external_links_disclaimer_p1')} {/* MODIFIED */}
        </p>
        <p className="text-gray-700 mb-6">
          {t('external_links_disclaimer_p2')} {/* MODIFIED */}
        </p>
      </div>
    </>
  );
};

export default DisclaimerPage;