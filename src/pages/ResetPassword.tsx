import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Correct import for useAuth
import { Scale, Eye, EyeOff } from 'lucide-react'; // Changed Sparkles to Scale for branding
import { supabase } from '../lib/supabase'; // Keep this import for verifyOtp and signOut

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { resetPassword } = useAuth(); // Only import resetPassword from useAuth
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      console.log('Verification token found:', token);
      handleVerification(token);
    }
  }, [searchParams]);

  const handleVerification = async (token: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Verifying password reset token...');
      // CRITICAL: Use direct supabase import for verifyOtp with type "recovery"
      const { error: verifyError } = await supabase.auth.verifyOtp({
        type: "recovery",
        token_hash: token,
      });

      if (verifyError) {
        throw verifyError;
      }

      setSuccess('Token verified. Please set your new password.');
      // Do not redirect immediately, wait for user to set new password
    } catch (error: any) {
      console.error('Password reset token verification failed:', error);
      setError(error instanceof Error ? error.message : 'Invalid or expired password reset link');
    } finally {
      setIsLoading(false);
    }
  };

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
      await resetPassword(newPassword); // Use resetPassword from useAuth
      setSuccess('Password successfully reset! Redirecting to dashboard...');
      setTimeout(() => {
        navigate('/dashboard', { replace: true }); // Changed from /login to /dashboard
      }, 1500);
    } catch (error: any) {
      setError(error instanceof Error ? error.message : 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = async () => {
    try {
      await supabase.auth.signOut(); // Directly sign out using supabase
    } catch (error) {
      console.error("Error during logout on back to login:", error);
    } finally {
      navigate('/login', { replace: true }); // Redirect to login page
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4"> {/* Adjusted background color */}
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-md p-6"> {/* Adjusted card styling */}
          <div className="flex items-center justify-center mb-8">
            <Scale className="h-8 w-8 text-blue-900 mr-2" /> {/* Changed icon and color for branding */}
            <span className="text-2xl font-bold text-blue-900"> {/* Adjusted text color */}
              ContractAnalyser
            </span>
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-6">Reset Your Password</h1> {/* Adjusted text color */}

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 rounded-lg text-red-700"> {/* Adjusted error styling */}
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-100 border border-green-400 rounded-lg text-green-700"> {/* Adjusted success styling */}
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1"> {/* Adjusted label color */}
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
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-500"> {/* Adjusted text color */}
                Password must be at least 6 characters long
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1"> {/* Adjusted label color */}
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