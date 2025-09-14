import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Scale, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useTranslation } from 'react-i18next'; // ADDED

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  const { session } = useSessionContext();
  const location = useLocation();
  const { t } = useTranslation(); // ADDED

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [sessionTimer, setSessionTimer] = useState<NodeJS.Timeout | null>(null);

  // Set global password reset flow state and block modals
  useEffect(() => {
    localStorage.setItem('passwordResetFlowActive', 'true');
    localStorage.setItem('passwordResetFlowStartTime', Date.now().toString());
    localStorage.setItem('blockModalsDuringReset', 'true');

    return () => {
      if (!success) {
        localStorage.removeItem('passwordResetFlowActive');
        localStorage.removeItem('passwordResetFlowStartTime');
        localStorage.removeItem('blockModalsDuringReset');
      }
    };
  }, [success]);

  // Block modal opening attempts
  useEffect(() => {
    const blockModals = () => {
      // Prevent any modal from opening during password reset
      const modalBlockers = [
        // Common modal selectors
        '[data-modal]',
        '[data-help]',
        '.modal-trigger',
        '.help-button',
        '.help-icon',
        '#help-button',
        '#dashboard-help',
        // Add any specific selectors for DashboardHelpModal
        '[onclick*="help"]',
        '[onclick*="modal"]',
        '[href*="help"]',
        '[href*="modal"]'
      ];

      modalBlockers.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          element.addEventListener('click', (e) => {
            if (!success) {
              e.preventDefault();
              e.stopPropagation();
              setError(t('help_unavailable_during_reset_modal')); // MODIFIED
              // Force focus back to password fields
              document.getElementById('newPassword')?.focus();
            }
          }, true);
        });
      });
    };

    // Run after a short delay to ensure DOM is loaded
    const timer = setTimeout(blockModals, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [success, t]); // MODIFIED: Added t to dependency array

  // Auto-redirect to login after 15 minutes
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.removeItem('passwordResetFlowActive');
      localStorage.removeItem('passwordResetFlowStartTime');
      localStorage.removeItem('blockModalsDuringReset');
      
      if (!success) {
        supabase.auth.signOut().catch(console.error);
      }
      navigate('/login', { replace: true });
    }, 15 * 60 * 1000);

    setSessionTimer(timer);

    return () => {
      if (sessionTimer) {
        clearTimeout(sessionTimer);
      }
    };
  }, [navigate, success, sessionTimer]); // MODIFIED: Added sessionTimer to dependency array

  // Block navigation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!success) {
        e.preventDefault();
        e.returnValue = t('password_reset_progress_lost'); // MODIFIED
        return e.returnValue;
      }
    };

    const handlePopState = (e: PopStateEvent) => {
      if (!success) {
        window.history.pushState(null, '', window.location.pathname + window.location.hash);
        setError(t('navigation_disabled_reset_password')); // MODIFIED
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    
    window.history.pushState(null, '', window.location.pathname + window.location.hash);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      if (sessionTimer) {
        clearTimeout(sessionTimer);
      }
    };
  }, [success, sessionTimer, location.hash, t]); // MODIFIED: Added t to dependency array

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError(t('password_must_be_6_chars')); // MODIFIED
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('passwords_do_not_match')); // MODIFIED
      return;
    }

    setIsLoading(true);

    try {
      await resetPassword(newPassword);
      setSuccess(t('password_reset_success')); // MODIFIED
      
      if (sessionTimer) {
        clearTimeout(sessionTimer);
      }
      
      localStorage.setItem('passwordResetCompleted', 'true');
      localStorage.removeItem('blockModalsDuringReset');
      
      await supabase.auth.signOut();

      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 1500);
    } catch (error: any) {
      setError(error instanceof Error ? error.message : t('failed_to_reset_password')); // MODIFIED
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = async () => {
    try {
      if (sessionTimer) {
        clearTimeout(sessionTimer);
      }
      localStorage.removeItem('passwordResetFlowActive');
      localStorage.removeItem('passwordResetFlowStartTime');
      localStorage.removeItem('blockModalsDuringReset');
      
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error during logout:", error);
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-center mb-8">
            <Scale className="h-8 w-8 text-blue-900 mr-2" />
            <span className="text-2xl font-bold text-blue-900">
              ContractAnalyser
            </span>
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-6">{t('reset_your_password')}</h1> {/* MODIFIED */}

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-100 border border-green-400 rounded-lg text-green-700">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                {t('new_password')} {/* MODIFIED */}
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                  minLength={6}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {t('password_must_be_6_chars')} {/* MODIFIED */}
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                {t('confirm_password')} {/* MODIFIED */}
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-900 text-white py-2 rounded-md font-semibold hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></span>
              ) : (
                t('reset_password') // MODIFIED
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={handleBackToLogin}
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              {t('back_to_login')} {/* MODIFIED */}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;