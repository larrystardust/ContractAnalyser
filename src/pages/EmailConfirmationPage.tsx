import React from 'react';
import { Link } from 'react-router-dom';
import Card, { CardBody } from '../components/ui/Card';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next'; // ADDED

const EmailConfirmationPage: React.FC = () => {
  const { t } = useTranslation(); // ADDED

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <Card className="max-w-md w-full">
        <CardBody className="text-center">
          <Info className="h-12 w-12 text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('information')}</h2> {/* MODIFIED */}
          <p className="text-gray-600 mb-6">
            {t('page_no_longer_used')} {/* MODIFIED */}
          </p>
          <Link to="/login">
            <button className="inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 bg-blue-900 text-white hover:bg-blue-800 focus:ring-blue-500 text-base px-6 py-3 w-full">
              {t('go_to_login')} {/* MODIFIED */}
            </button>
          </Link>
        </CardBody>
      </Card>
    </div>
  );
};

export default EmailConfirmationPage;