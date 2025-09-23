import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Scale, Upload, Search, Bell, Menu, X, LogOut, HelpCircle, LayoutDashboard } from 'lucide-react';
import Button from '../ui/Button';
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { useNotifications } from '../../hooks/useNotifications';
import { useTranslation } from 'react-i18next'; // ADDED: Import useTranslation
// REMOVED: import LanguageSelector from '../ui/LanguageSelector'; // REMOVED: LanguageSelector import

interface HeaderProps {
  onOpenHelpModal: () => void;
}

const Header: React.FC<HeaderProps> = ({ onOpenHelpModal }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { session } = useSessionContext();
  const supabase = useSupabaseClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, loadingAdminStatus } = useIsAdmin();
  const { unreadCount } = useNotifications();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    console.log('Header.tsx: useEffect - unreadCount changed to:', unreadCount);
  }, [unreadCount]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const headerClass = isScrolled
    ? 'bg-white shadow-md'
    : 'bg-transparent';

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleLogout = async () => {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData.session) {
        console.info('No active session found, skipping signOut call');
      } else {
        await supabase.auth.signOut({ scope: 'local' });
      }
      localStorage.removeItem('mfa_passed');
    } catch (error) {
      console.warn('Logout error:', error);
    }
    navigate('/', { replace: true });
  };

  const handleSearchClick = () => {
    navigate('/search');
  };

  const handleNotificationsClick = () => {
    navigate('/notifications');
  };

  const handleDashboardSwitch = () => {
    if (location.pathname.startsWith('/admin')) {
      navigate('/dashboard');
    } else {
      navigate('/admin');
    }
  };

  const showAuthButtons = !session?.user && location.pathname !== '/auth/email-sent';

  console.log('Header.tsx: Render - unreadCount:', unreadCount);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    if (lng === 'ar') {
      document.documentElement.setAttribute('dir', 'rtl');
    } else {
      document.documentElement.setAttribute('dir', 'ltr');
    }
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${headerClass}`}>
      <div className="container mx-auto px-2 sm:px-4"> {/* MODIFIED: Reduced padding for small screens */}
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Scale className="h-8 w-8 text-BlueLogo mr-2" />
            <span className="text-xl font-semibold text-BlueLogo">{t('app_name')}</span>
          </div>

          {/* Desktop Navigation and Actions (visible on desktop) */}
          <nav className="hidden md:flex items-center space-x-4">
            {session?.user ? (
              <>
                <Link to="/dashboard" className="text-blue-500 hover:text-blue-900 transition-colors font-medium">{t('dashboard')}</Link>
                <Link to="/contracts" className="text-blue-500 hover:text-blue-900 transition-colors font-medium">{t('contracts')}</Link>
                <Link to="/reports" className="text-blue-500 hover:text-blue-900 transition-colors font-medium">{t('reports')}</Link>
                <Link to="/settings" className="text-blue-500 hover:text-blue-900 transition-colors font-medium">{t('settings')}</Link>
                <Link to="/pricing" className="text-blue-500 hover:text-blue-900 transition-colors font-medium">{t('pricing')}</Link>
                <Link to="/upload">
                  <Button variant="primary" size="sm" icon={<Upload className="w-4 h-4" />}>
                    {t('upload_contract')}
                  </Button>
                </Link>
                {!loadingAdminStatus && isAdmin && (
                  <Button variant="outline" size="sm" icon={<LayoutDashboard className="w-4 h-4" />} onClick={handleDashboardSwitch}>
                    {location.pathname.startsWith('/admin') ? t('dashboard') : t('admin_dashboard')}
                  </Button>
                )}
                <Button variant="outline" size="sm" icon={<Search className="w-4 h-4" />} onClick={handleSearchClick}>
                  {t('search')}
                </Button>
                <Button variant="text" size="sm" className="p-1 relative" onClick={handleNotificationsClick}>
                  <Bell className="w-5 h-5 text-blue-500" />
                  {unreadCount > 0 && (<span className="absolute top-0 right-0 block h-2 w-2 rounded-full ring-2 ring-white bg-red-500" />)}
                </Button>
                <Button variant="text" size="sm" className="p-1" onClick={onOpenHelpModal}>
                  <HelpCircle className="w-5 h-5 text-blue-500" />
                </Button>
                <Button variant="text" size="sm" className="p-1" onClick={handleLogout}>
                  <LogOut className="w-5 h-5 text-blue-500" />
                </Button>
              </>
            ) : (
              showAuthButtons && (
                <>
                  <Link to="/login" className="text-blue-500 hover:text-blue-900 transition-colors font-medium">{t('login')}</Link>
                  <Link to="/signup" className="text-blue-500 hover:text-blue-900 transition-colors font-medium">{t('signup')}</Link>
                </>
              )
            )}
            {/* Language Selector for Desktop */}
            <select
              onChange={(e) => changeLanguage(e.target.value)}
              value={i18n.language}
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-1.5"
            >
              <option value="en">ENGLISH</option>
              <option value="fr">FRANCAIS</option>
              <option value="es">ESPANOL</option>
              <option value="ar">العربية</option>
            </select>
          </nav>

          {/* Mobile Actions: Language Selector and Menu Button (visible on mobile) */}
          <div className="md:hidden flex items-center space-x-2">
            {/* Language Selector for mobile */}
            <select
              onChange={(e) => changeLanguage(e.target.value)}
              value={i18n.language}
              className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block px-2 py-1 w-20" 
            >
              <option value="en">ENGLISH</option>
              <option value="fr">FRANCAIS</option>
              <option value="es">ESPANOL</option>
              <option value="ar">العربية</option>
            </select>

            {/* Mobile Menu Button */}
            <button
              onClick={toggleMobileMenu}
              className="text-blue-500 hover:text-blue-900 focus:outline-none"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu (conditionally rendered) */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200 shadow-lg animate-slideDown">
          <div className="container mx-auto px-4 py-4">
            <nav className="flex flex-col space-y-4">
              {session?.user ? (
                <>
                  <Link to="/dashboard" className="text-blue-500 hover:text-blue-900 transition-colors font-medium py-2" onClick={toggleMobileMenu}>{t('dashboard')}</Link>
                  <Link to="/contracts" className="text-blue-500 hover:text-blue-900 transition-colors font-medium py-2" onClick={toggleMobileMenu}>{t('contracts')}</Link>
                  <Link to="/reports" className="text-blue-500 hover:text-blue-900 transition-colors font-medium py-2" onClick={toggleMobileMenu}>{t('reports')}</Link>
                  <Link to="/settings" className="text-blue-500 hover:text-blue-900 transition-colors font-medium py-2" onClick={toggleMobileMenu}>{t('settings')}</Link>
                  <Link to="/pricing" className="text-blue-500 hover:text-blue-900 transition-colors font-medium py-2" onClick={toggleMobileMenu}>{t('pricing')}</Link>
                  <div className="pt-2 border-t border-gray-200">
                    {!loadingAdminStatus && isAdmin && (
                      <Button
                        variant="outline"
                        size="md"
                        className="w-full mt-2"
                        icon={<LayoutDashboard className="w-4 h-4" />}
                        onClick={() => { handleDashboardSwitch(); toggleMobileMenu(); }}
                      >
                        {location.pathname.startsWith('/admin') ? t('dashboard') : t('admin_dashboard')}
                      </Button>
                    )}
                    <Link to="/upload" onClick={toggleMobileMenu}>
                      <Button
                        variant="primary"
                        size="md"
                        className="w-full mt-2"
                        icon={<Upload className="w-4 h-4" />}
                      >
                        {t('upload_contract')}
                      </Button>
                    </Link>
                    <Button
                      variant="text"
                      size="md"
                      className="w-full mt-2"
                      icon={<HelpCircle className="w-4 h-4" />}
                      onClick={() => { onOpenHelpModal(); toggleMobileMenu(); }}
                    >
                      {t('help')}
                    </Button>
                    <Button
                      variant="text"
                      size="md"
                      className="w-full mt-2"
                      icon={<LogOut className="w-4 h-4" />}
                      onClick={() => { handleLogout(); toggleMobileMenu(); }}
                    >
                      {t('logout')}
                    </Button>
                  </div>
                </>
              ) : (
                showAuthButtons && (
                  <>
                    <Link to="/login" className="text-blue-500 hover:text-blue-900 transition-colors font-medium py-2" onClick={toggleMobileMenu}>{t('login')}</Link>
                    <Link to="/signup" className="text-blue-500 hover:text-blue-900 transition-colors font-medium py-2" onClick={toggleMobileMenu}>{t('signup')}</Link>
                  </>
                )
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;