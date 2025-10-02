// src/pages/ResetPassword.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Scale, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useTranslation } from 'react-i18next';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  const { session } = useSessionContext();
  const location = useLocation();
  const { t } = useTranslation();

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

    // CRITICAL FIX: Immediately sign out the user when landing on the reset page via email link.
    // This prevents the user from being "logged in" to the app before setting a new password.
    // The access_token in the URL hash will still be available for supabase.auth.updateUser.
    const hashParams = new URLSearchParams(location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');

    if (accessToken && type === 'recovery') {
      // console.log('ResetPassword: Detected recovery access token in URL hash. Signing out current session.'); // REMOVED
      supabase.auth.signOut().catch(console.error);
    }

    // MODIFIED: Set persistent error message immediately on load if reset flow is active
    if (localStorage.getItem('passwordResetFlowActive') === 'true' && !success) {
      setError(t('navigation_disabled_reset_password'));
    }

    // CRITICAL FIX: Always clear these flags when the component unmounts
    // This ensures that even if the user navigates away or closes the tab,
    // the recovery state is cleared, preventing lingering issues.
    return () => {
      // console.log('ResetPassword: useEffect cleanup - Clearing localStorage flags.'); // REMOVED
      localStorage.removeItem('passwordResetFlowActive');
      localStorage.removeItem('passwordResetFlowStartTime');
      localStorage.removeItem('blockModalsDuringReset');
      if (sessionTimer) {
        clearTimeout(sessionTimer);
      }
    };
  }, [location.hash, sessionTimer, success, t]); // MODIFIED: Added success and t to dependencies

  // Auto-redirect to login after 15 minutes
  useEffect(() => {
    const timer = setTimeout(() => {
      // These flags are now cleared by the component's unmount effect,
      // but we can explicitly clear them here too for immediate effect if the timer fires.
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
  }, [navigate, success]); // Removed sessionTimer from dependencies to avoid re-creating timer

  // Block navigation
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (!success) {
        e.preventDefault(); // Prevent the browser from navigating back
        // The AuthGuard will handle the actual redirection if the user tries to navigate away.
        setError(t('navigation_disabled_reset_password'));
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [success, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError(t('password_must_be_6_chars'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('passwords_do_not_match'));
      return;
    }

    setIsLoading(true);

    try {
      await resetPassword(newPassword);
      setSuccess(t('password_reset_success'));
      
      if (sessionTimer) {
        clearTimeout(sessionTimer);
      }
      
      // CRITICAL: Clear the active flow flags directly here upon success
      // console.log('ResetPassword: handleSubmit - Clearing localStorage flags before navigation.'); // REMOVED
      localStorage.removeItem('passwordResetFlowActive');
      localStorage.removeItem('passwordResetFlowStartTime');
      localStorage.removeItem('blockModalsDuringReset');
      // console.log('ResetPassword: handleSubmit - passwordResetFlowActive after clearing:', localStorage.getItem('passwordResetFlowActive')); // REMOVED


      // Clear the URL hash immediately
      window.history.replaceState({}, document.title, window.location.pathname);

      await supabase.auth.signOut();

      // Navigate immediately.
      navigate('/login', { replace: true });

      // Defensive clearing after navigation, in case of race conditions
      setTimeout(() => {
        // console.log('ResetPassword: handleSubmit - Clearing localStorage flags again after navigation delay.'); // REMOVED
        localStorage.removeItem('passwordResetFlowActive');
        localStorage.removeItem('passwordResetFlowStartTime');
        localStorage.removeItem('blockModalsDuringReset');
        // console.log('ResetPassword: handleSubmit - passwordResetFlowActive after delayed clearing:', localStorage.getItem('passwordResetFlowActive')); // REMOVED
      }, 100);


    } catch (error: any) {
      console.error("Reset password error:", error); // Log the full error for debugging
      // MODIFIED: Check for specific Supabase error message for "password too similar"
      if (error.message && error.message.includes("New password should be different from the old password.")) {
        setError(t('new_password_must_be_different'));
      } else if (error.message && error.message.includes("Password is too similar to previous password")) {
        setError(t('new_password_must_be_different')); // Map a common Supabase error to your translation
      }
      else {
        setError(error instanceof Error ? error.message : t('failed_to_reset_password'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = async () => {
    try {
      if (sessionTimer) {
        clearTimeout(sessionTimer);
      }
      // Ensure all relevant flags are cleared when manually going back to login
      // console.log('ResetPassword: handleBackToLogin - Clearing localStorage flags.'); // REMOVED
      localStorage.removeItem('passwordResetFlowActive');
      localStorage.removeItem('passwordResetFlowStartTime');
      localStorage.removeItem('blockModalsDuringReset');
      // console.log('ResetPassword: handleBackToLogin - passwordResetFlowActive after clearing:', localStorage.getItem('passwordResetFlowActive')); // REMOVED
      
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

          <h1 className="text-xl font-bold text-gray-900 mb-6">{t('reset_your_password')}</h1>

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
                {t('new_password')}
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
                {t('password_must_be_6_chars')}
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                {t('confirm_password')}
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
                t('reset_password')
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={handleBackToLogin}
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              {t('back_to_login')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;