import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useIsAdmin } from '../hooks/useIsAdmin'; // Import useIsAdmin
import { useSupabaseClient } from '@supabase/auth-helpers-react'; // Import useSupabaseClient

const MaintenancePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin(); // Use the isAdmin hook
  const supabase = useSupabaseClient(); // Use Supabase client for logout

  const handleBackToLogin = async () => {
    // Log the user out before navigating to the landing page
    // This prevents the redirect loop when an authenticated user
    // tries to go back to the landing page
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error during logout from maintenance page:', error);
    }
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 text-gray-800 p-4">
      <div className="max-w-2xl text-center">
        <img
          src="https://images.pexels.com/photos/159306/construction-site-build-construction-work-159306.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"
          alt={t('maintenance_hero_title')}
          className="w-full h-auto rounded-lg shadow-lg mb-8"
        />
        <h1 className="text-4xl md:text-5xl font-bold text-blue-800 mb-4">
          {t('maintenance_hero_title')}
        </h1>
        <p className="text-lg md:text-xl text-gray-700 mb-6">
          {t('maintenance_hero_description')}
        </p>
        <p className="text-sm text-gray-500">
          {t('maintenance_check_back_later')}
        </p>
      </div>
      
      <div className="mt-8">
        {isAdmin && (
          <div className="mb-6">
            <p className="text-sm text-purple-600 font-semibold mb-2">{t('maintenance_admin_access')}</p>
            <div className="flex justify-center space-x-3">
              <button
                onClick={() => navigate('/admin')}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
              >
                {t('maintenance_admin_dashboard_button')}
              </button>              
            </div>
          </div>
        )}
        
        <button
          onClick={handleBackToLogin}
          className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('maintenance_back_to_login_button')}
        </button>
      </div>
    </div>
  );
};

export default MaintenancePage;