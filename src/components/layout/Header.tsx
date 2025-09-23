import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Scale, Upload, Search, Bell, Menu, X, LogOut, HelpCircle, LayoutDashboard } from 'lucide-react';
import Button from '../ui/Button';
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { useNotifications } from '../../hooks/useNotifications';
import { useTranslation } from 'react-i18next'; // ADDED: Import useTranslation
import LanguageSelector from '../ui/LanguageSelector'; // ADDED: Import LanguageSelector

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
  const { unreadCount } = useNotifications(); // REMOVED 'notifications' and 'markAsRead'
  const { t, i18n } = useTranslation(); // ADDED: useTranslation hook

  // ADDED: useEffect to log unreadCount changes
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
    // Simply navigate to the notifications page
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

  console.log('Header.tsx: Render - unreadCount:', unreadCount); // Changed existing log for clarity

  // ADDED: Language change handler
  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    // Update dir attribute on html element for RTL support
    if (lng === 'ar') { // Add other RTL languages here if needed
      document.documentElement.setAttribute('dir', 'rtl');
    } else {
      document.documentElement.setAttribute('dir', 'ltr');
    }
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${headerClass}`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Scale className="h-8 w-8 text-BlueLogo mr-2" />
            <span className="text-xl font-semibold text-BlueLogo">{t('app_name')}</span> {/* MODIFIED */}
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {session?.user ? (
              <>
                <Link to="/dashboard" className="text-blue-500 hover:text-blue-900 transition-colors font-medium">{t('dashboard')}</Link> {/* MODIFIED */}
                <Link to="/contracts" className="text-blue-500 hover:text-blue-900 transition-colors font-medium">{t('contracts')}</Link> {/* MODIFIED */}
                <Link to="/reports" className="text-blue-500 hover:text-blue-900 transition-colors font-medium">{t('reports')}</Link> {/* MODIFIED */}
                <Link to="/settings" className="text-blue-500 hover:text-blue-900 transition-colors font-medium">{t('settings')}</Link> {/* MODIFIED */}
                <Link to="/pricing" className="text-blue-500 hover:text-blue-900 transition-colors font-medium">{t('pricing')}</Link> {/* MODIFIED */}
                <Link to="/upload">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Upload className="w-4 h-4" />}
                  >
                    {t('upload_contract')} {/* MODIFIED */}
                  </Button>
                </Link>
              </>
            ) : (
              showAuthButtons && (
                <>
                  <Link to="/login" className="text-blue-500 hover:text-blue-900 transition-colors font-medium">{t('login')}</Link> {/* MODIFIED */}
                  <Link to="/signup" className="text-blue-500 hover:text-blue-900 transition-colors font-medium">{t('signup')}</Link> {/* MODIFIED */}
                </>
              )
            )}
          </nav>

          <div className="hidden md:flex items-center space-x-4">
            {/* ADDED: Language Selector */}
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

            {session?.user ? (
              <>
                {!loadingAdminStatus && isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<LayoutDashboard className="w-4 h-4" />}
                    onClick={handleDashboardSwitch}
                  >
                    {location.pathname.startsWith('/admin') ? t('dashboard') : t('admin_dashboard')} {/* MODIFIED */}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Search className="w-4 h-4" />}
                  onClick={handleSearchClick}
                >
                  {t('search')} {/* MODIFIED */}
                </Button>
                <Button
                  variant="text"
                  size="sm"
                  className="p-1 relative"
                  onClick={handleNotificationsClick}
                >
                  <Bell className="w-5 h-5 text-blue-500" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 block h-2 w-2 rounded-full ring-2 ring-white bg-red-500" />
                  )}
                </Button>
                <Button
                  variant="text"
                  size="sm"
                  className="p-1"
                  onClick={onOpenHelpModal}
                >
                  <HelpCircle className="w-5 h-5 text-blue-500" />
                </Button>
                <Button
                  variant="text"
                  size="sm"
                  className="p-1"
                  onClick={handleLogout}
                >
                  <LogOut className="w-5 h-5 text-blue-500" />
                </Button>
              </>
            ) : (
              null
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
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

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200 shadow-lg animate-slideDown">
          <div className="container mx-auto px-4 py-4">
            <nav className="flex flex-col space-y-4">
              {/* ADDED: Language Selector for mobile */}
              <div className="mb-4">
                <LanguageSelector />
              </div>
              {session?.user ? (
                <>
                  <Link to="/dashboard" className="text-blue-500 hover:text-blue-900 transition-colors font-medium py-2" onClick={toggleMobileMenu}>{t('dashboard')}</Link> {/* MODIFIED */}
                  <Link to="/contracts" className="text-blue-500 hover:text-blue-900 transition-colors font-medium py-2" onClick={toggleMobileMenu}>{t('contracts')}</Link> {/* MODIFIED */}
                  <Link to="/reports" className="text-blue-500 hover:text-blue-900 transition-colors font-medium py-2" onClick={toggleMobileMenu}>{t('reports')}</Link> {/* MODIFIED */}
                  <Link to="/settings" className="text-blue-500 hover:text-blue-900 transition-colors font-medium py-2" onClick={toggleMobileMenu}>{t('settings')}</Link> {/* MODIFIED */}
                  <Link to="/pricing" className="text-blue-500 hover:text-blue-900 transition-colors font-medium py-2" onClick={toggleMobileMenu}>{t('pricing')}</Link> {/* MODIFIED */}
                  <div className="pt-2 border-t border-gray-200">
                    {!loadingAdminStatus && isAdmin && (
                      <Button
                        variant="outline"
                        size="md"
                        className="w-full mt-2"
                        icon={<LayoutDashboard className="w-4 h-4" />}
                        onClick={() => { handleDashboardSwitch(); toggleMobileMenu(); }}
                      >
                        {location.pathname.startsWith('/admin') ? t('dashboard') : t('admin_dashboard')} {/* MODIFIED */}
                      </Button>
                    )}
                    <Link to="/upload" onClick={toggleMobileMenu}>
                      <Button
                        variant="primary"
                        size="md"
                        className="w-full mt-2"
                        icon={<Upload className="w-4 h-4" />}
                      >
                        {t('upload_contract')} {/* MODIFIED */}
                      </Button>
                    </Link>
                    <Button
                      variant="text"
                      size="md"
                      className="w-full mt-2"
                      icon={<HelpCircle className="w-4 h-4" />}
                      onClick={() => { onOpenHelpModal(); toggleMobileMenu(); }}
                    >
                      {t('help')} {/* MODIFIED */}
                    </Button>
                    <Button
                      variant="text"
                      size="md"
                      className="w-full mt-2"
                      icon={<LogOut className="w-4 h-4" />}
                      onClick={() => { handleLogout(); toggleMobileMenu(); }}
                    >
                      {t('logout')} {/* MODIFIED */}
                    </Button>
                  </div>
                </>
              ) : (
                showAuthButtons && (
                  <>
                    <Link to="/login" className="text-blue-500 hover:text-blue-900 transition-colors font-medium py-2" onClick={toggleMobileMenu}>{t('login')}</Link> {/* MODIFIED */}
                    <Link to="/signup" className="text-blue-500 hover:text-blue-900 transition-colors font-medium py-2" onClick={toggleMobileMenu}>{t('signup')}</Link> {/* MODIFIED */}
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