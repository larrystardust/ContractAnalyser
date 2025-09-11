import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'; // ADDED useSearchParams
import { useAuth } from '../context/AuthContext';
import { Scale, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase'; // Import supabase client directly
import { useSessionContext } from '@supabase/auth-helpers-react'; // Import useSessionContext

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  const { session, isLoading: isSessionLoading } = useSessionContext();
  const [searchParams] = useSearchParams(); // ADDED

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isTokenVerified, setIsTokenVerified] = useState(false); // NEW STATE

  // REMOVED: The useEffect that called supabase.auth.signOut() on load.
  // This session must remain active for updateUser() to work.

  // ADDED: Token verification logic
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      console.log('Verification token found:', token);
      handleVerification(token);
    } else {
      // If no token is found, it means the user didn't come from a valid reset link
      setError('No password reset token found in the URL. Please use the link from your email.');
    }
  }, [searchParams]);

  // ADDED: handleVerification function
  const handleVerification = async (token: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Verifying password reset token...');
      // CRITICAL FIX: Change type from "signup" to "recovery"
      const { error: verifyError } = await supabase.auth.verifyOtp({
        type: "recovery",
        token_hash: token,
      });

      if (verifyError) {
        throw verifyError;
      }

      setSuccess('Token verified. Please set your new password.');
      setIsTokenVerified(true); // Enable the form
      // Do not redirect immediately, wait for user to set new password
    } catch (error: any) {
      console.error('Password reset token verification failed:', error);
      setError(error instanceof Error ? error.message : 'Invalid or expired password reset link');
      setIsTokenVerified(false); // Keep the form disabled on failure
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isTokenVerified) { // Ensure token is verified before proceeding
      setError('Please verify the reset token first.');
      return;
    }

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
      // This will use the access_token from the URL hash, which is now available
      // because we are NOT signing out on load.
      await resetPassword(newPassword);
      setSuccess('Password successfully reset! Redirecting to login...'); // Redirect to login after reset
      
      // CRITICAL: Sign out the user after successful password reset
      // This terminates the recovery session, forcing a fresh login.
      await supabase.auth.signOut();

      setTimeout(() => {
        navigate('/login', { replace: true }); // User must explicitly log in with new password
      }, 1500);
    } catch (error: any) {
      setError(error instanceof Error ? error.message : 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = async () => {
    try {
      // Ensure any lingering session is cleared before going to login
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
                  disabled={!isTokenVerified || isLoading} // DISABLED until token is verified
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('new')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  disabled={!isTokenVerified || isLoading} // DISABLED until token is verified
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
                  disabled={!isTokenVerified || isLoading} // DISABLED until token is verified
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={!isTokenVerified || isLoading} // DISABLED until token is verified
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={!isTokenVerified || isLoading} // DISABLED until token is verified
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