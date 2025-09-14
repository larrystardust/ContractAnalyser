import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next'; // ADDED

const CheckoutSuccess: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation(); // ADDED

  useEffect(() => {
    // Redirect to the upload page after 3 seconds
    const timer = setTimeout(() => {
      navigate('/upload');
    }, 3000);

    // Cleanup the timer if the component unmounts before the redirect
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
          <CheckCircle className="h-6 w-6 text-green-600" />
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {t('payment_successful')} {/* MODIFIED */}
        </h2>
        
        <p className="text-gray-600 mb-6">
          {t('payment_successful_message')} {/* MODIFIED */}
        </p>
      </div>
    </div>
  );
};

export default CheckoutSuccess;