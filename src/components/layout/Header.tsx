import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Scale, Upload, Search, Bell, Menu, X, LogOut, HelpCircle, LayoutDashboard } from 'lucide-react';
import Button from '../ui/Button';
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { useNotifications } from '../../hooks/useNotifications';

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
      navigate('/admin');
    } else {
      navigate('/dashboard');
    }
  };

  const showAuthButtons = !session?.user && location.pathname !== '/auth/email-sent';

  console.log('Header.tsx: Render - unreadCount:', unreadCount); // Changed existing log for clarity

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${headerClass}`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Scale className="h-8 w-8 text-BlueLogo mr-2" />
            <span className="text-xl font-semibold text-BlueLogo">ContractAnalyser</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {session?.user ? (
              <>
                <Link to="/dashboard" className="text-blue-500 hover:text-blue-900 transition-colors font-medium">Dashboard</Link>
                <Link to="/contracts" className="text-blue-500 hover:text-blue-900 transition-colors font-medium">Contracts</Link>
                <Link to="/reports" className="text-blue-500 hover:text-blue-900 transition-colors font-medium">Reports</Link>
                <Link to="/settings" className="text-blue-500 hover:text-blue-900 transition-colors font-medium">Settings</Link>
                <Link to="/pricing" className="text-blue-500 hover:text-blue-900 transition-colors font-medium">Pricing</Link>
                <Link to="/upload">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Upload className="w-4 h-4" />}
                  >
                    Upload Contract
                  </Button>
                </Link>
              </>
            ) : (
              showAuthButtons && (
                <>
                  <Link to="/login" className="text-blue-500 hover:text-blue-900 transition-colors font-medium">Login</Link>
                  <Link to="/signup" className="text-blue-500 hover:text-blue-900 transition-colors font-medium">Sign Up</Link>
                </>
              )
            )}
          </nav>

          <div className="hidden md:flex items-center space-x-4">
            {session?.user ? (
              <>
                {!loadingAdminStatus && isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<LayoutDashboard className="w-4 h-4" />}
                    onClick={handleDashboardSwitch}
                  >
                    {location.pathname.startsWith('/admin') ? 'User Dashboard' : 'Admin Dashboard'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Search className="w-4 h-4" />}
                  onClick={handleSearchClick}
                >
                  Search
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
              {session?.user ? (
                <>
                  <Link to="/dashboard" className="text-blue-500 hover:text-blue-900 transition-colors font-medium py-2" onClick={toggleMobileMenu}>Dashboard</Link>
                  <Link to="/contracts" className="text-blue-500 hover:text-blue-900 transition-colors font-medium py-2" onClick={toggleMobileMenu}>Contracts</Link>
                  <Link to="/reports" className="text-blue-500 hover:text-blue-900 transition-colors font-medium py-2" onClick={toggleMobileMenu}>Reports</Link>
                  <Link to="/settings" className="text-blue-500 hover:text-blue-900 transition-colors font-medium py-2" onClick={toggleMobileMenu}>Settings</Link>
                  <Link to="/pricing" className="text-blue-500 hover:text-blue-900 transition-colors font-medium py-2" onClick={toggleMobileMenu}>Pricing</Link>
                  <div className="pt-2 border-t border-gray-200">
                    {!loadingAdminStatus && isAdmin && (
                      <Button
                        variant="outline"
                        size="md"
                        className="w-full mt-2"
                        icon={<LayoutDashboard className="w-4 h-4" />}
                        onClick={() => { handleDashboardSwitch(); toggleMobileMenu(); }}
                      >
                        {location.pathname.startsWith('/admin') ? 'User Dashboard' : 'Admin Dashboard'}
                      </Button>
                    )}
                    <Link to="/upload" onClick={toggleMobileMenu}>
                      <Button
                        variant="primary"
                        size="md"
                        className="w-full mt-2"
                        icon={<Upload className="w-4 h-4" />}
                      >
                        Upload Contract
                      </Button>
                    </Link>
                    <Button
                      variant="text"
                      size="md"
                      className="w-full mt-2"
                      icon={<HelpCircle className="w-4 h-4" />}
                      onClick={() => { onOpenHelpModal(); toggleMobileMenu(); }}
                    >
                      Help
                    </Button>
                    <Button
                      variant="text"
                      size="md"
                      className="w-full mt-2"
                      icon={<LogOut className="w-4 h-4" />}
                      onClick={() => { handleLogout(); toggleMobileMenu(); }}
                    >
                      Log Out
                    </Button>
                  </div>
                </>
              ) : (
                showAuthButtons && (
                  <>
                    <Link to="/login" className="text-blue-500 hover:text-blue-900 transition-colors font-medium py-2" onClick={toggleMobileMenu}>Login</Link>
                    <Link to="/signup" className="text-blue-500 hover:text-blue-900 transition-colors font-medium py-2" onClick={toggleMobileMenu}>Sign Up</Link>
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