import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom'; // ADDED useLocation
import { Scale, Upload, Search, Bell, Menu, X, LogOut, HelpCircle, LayoutDashboard } from 'lucide-react'; // ADDED LayoutDashboard
import Button from '../ui/Button';
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react';
import { useIsAdmin } from '../../hooks/useIsAdmin'; // ADDED: Import useIsAdmin

interface HeaderProps {
  onOpenHelpModal: () => void;
}

const Header: React.FC<HeaderProps> = ({ onOpenHelpModal }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { session } = useSessionContext();
  const supabase = useSupabaseClient();
  const navigate = useNavigate();
  const location = useLocation(); // ADDED: Get current location
  const { isAdmin, loadingAdminStatus } = useIsAdmin(); // ADDED: Use useIsAdmin hook

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
      // Check current session status before attempting logout
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData.session) {
        // No active session found, user is already logged out
        console.info('No active session found, skipping signOut call');
      } else {
        // Active session exists, proceed with logout
        await supabase.auth.signOut({ scope: 'local' });
      }
      localStorage.removeItem('mfa_passed'); // ADDED: Clear the flag on logout
    } catch (error) {
      // Log any unexpected errors but don't prevent navigation
      console.warn('Logout error:', error);
    }
    // Always navigate to home page regardless of logout success/failure
    navigate('/', { replace: true }); // MODIFIED: Use replace: true for back button behavior
  };

  const handleSearchClick = () => {
    navigate('/search');
  };

  const handleNotificationsClick = () => {
    navigate('/notifications');
  };

  // ADDED: Handle dashboard switch
  const handleDashboardSwitch = () => {
    if (location.pathname.startsWith('/admin')) {
      navigate('/dashboard');
    } else {
      navigate('/admin');
    }
  };

  // ADDED: Determine if login/signup buttons should be shown
  const showAuthButtons = !session?.user && location.pathname !== '/auth/email-sent';

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
                {/* ADDED: Upload Contract button for desktop */}
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
              // MODIFIED: Conditionally render login/signup links
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
                {/* ADDED: Dashboard Switch Button */}
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
                  className="p-1"
                  onClick={handleNotificationsClick}
                >
                  <Bell className="w-5 h-5 text-gray-600" />
                </Button>
                {/* ADDED Help Button */}
                <Button
                  variant="text"
                  size="sm"
                  className="p-1"
                  onClick={onOpenHelpModal}
                >
                  <HelpCircle className="w-5 h-5 text-gray-600" />
                </Button>
                <Button
                  variant="text"
                  size="sm"
                  className="p-1"
                  onClick={handleLogout}
                >
                  <LogOut className="w-5 h-5 text-gray-600" />
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
                    {/* ADDED: Dashboard Switch Button for mobile */}
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
                    {/* ADDED Help Button to mobile menu */}
                    <Button
                      variant="outline"
                      size="md"
                      className="w-full mt-2"
                      icon={<HelpCircle className="w-4 h-4" />}
                      onClick={() => { onOpenHelpModal(); toggleMobileMenu(); }}
                    >
                      Help
                    </Button>
                    <Button
                      variant="outline"
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
                // MODIFIED: Conditionally render login/signup links for mobile
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