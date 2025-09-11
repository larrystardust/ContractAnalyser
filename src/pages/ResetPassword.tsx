import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Scale, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSessionContext } from '@supabase/auth-helpers-react';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  const { session, isLoading: isSessionLoading } = useSessionContext();
  const [searchParams] = useSearchParams();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [sessionTimer, setSessionTimer] = useState<NodeJS.Timeout | null>(null);

  // Auto-redirect to login after 15 minutes of inactivity on reset-password page
  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('ResetPassword: 15-minute session timeout reached, redirecting to login');
      supabase.auth.signOut().catch(console.error);
      navigate('/login', { replace: true });
    }, 15 * 60 * 1000); // 15 minutes

    setSessionTimer(timer);

    return () => {
      if (sessionTimer) {
        clearTimeout(sessionTimer);
      }
    };
  }, [navigate]);

  // Block browser navigation during password reset
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!success) {
        e.preventDefault();
        e.returnValue = 'Are you sure you want to leave? Your password reset progress will be lost.';
        return e.returnValue;
      }
    };

    const handlePopState = (e: PopStateEvent) => {
      if (!success) {
        // Prevent going back during password reset
        window.history.pushState(null, '', window.location.pathname);
        setError('Please complete the password reset process or use the Back to Login button');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    window.history.pushState(null, '', window.location.pathname);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      if (sessionTimer) {
        clearTimeout(sessionTimer);
      }
    };
  }, [success, sessionTimer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      await resetPassword(newPassword);
      setSuccess('Password successfully reset! Redirecting to login...');
      
      // Clear session timer on success
      if (sessionTimer) {
        clearTimeout(sessionTimer);
      }

      // Sign out the user after successful password reset
      await supabase.auth.signOut();

      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 1500);
    } catch (error: any) {
      setError(error instanceof Error ? error.message : 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = async () => {
    try {
      if (sessionTimer) {
        clearTimeout(sessionTimer);
      }
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error during logout on back to login:", error);
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

          <h1 className="text-xl font-bold text-gray-900 mb-6">Reset Your Password</h1>

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
                New Password
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
                Password must be at least 6 characters long
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
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
                'Reset Password'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={handleBackToLogin}
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;