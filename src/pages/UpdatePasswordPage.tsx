import React, { useState, useEffect } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useNavigate, useLocation } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card, { CardBody, CardHeader } from '../components/ui/Card';
import { Lock } from 'lucide-react';

const UpdatePasswordPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = useSupabaseClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [checkingSession, setCheckingSession] = useState(true);
  const fromPasswordReset = location.state?.fromPasswordReset;

  useEffect(() => {
    const initializeSession = async () => {
      try {
        if (fromPasswordReset) {
          // Check for raw tokens from AuthCallbackPage
          const rawTokens = localStorage.getItem('passwordResetRawTokens');
          
          if (rawTokens) {
            const { accessToken, refreshToken, timestamp } = JSON.parse(rawTokens);
            
            // Check if tokens are recent (within 1 minute)
            if (Date.now() - timestamp < 60 * 1000) {
              console.log('UpdatePasswordPage: Setting session from raw tokens');
              
              // Set the session using the raw tokens
              const { data: { session }, error: sessionError } = 
                await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                });

              if (sessionError) {
                console.error('UpdatePasswordPage: Error setting session:', sessionError);
                setError('Failed to initialize session. Please request a new password reset.');
              } else if (session) {
                console.log('UpdatePasswordPage: Session set successfully');
                // Clear the raw tokens
                localStorage.removeItem('passwordResetRawTokens');
                setCheckingSession(false);
                return;
              }
            } else {
              console.log('UpdatePasswordPage: Raw tokens expired');
              localStorage.removeItem('passwordResetRawTokens');
            }
          }
        }

        // Fallback: check if we already have a session
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (currentSession) {
          console.log('UpdatePasswordPage: Existing session found');
          setCheckingSession(false);
        } else {
          console.log('UpdatePasswordPage: No session found');
          if (fromPasswordReset) {
            setError('Your reset link may have expired. Please request a new password reset.');
          } else {
            setError('Please log in to update your password.');
          }
          setCheckingSession(false);
        }
      } catch (err) {
        console.error('UpdatePasswordPage: Error initializing session:', err);
        setError('An unexpected error occurred. Please try again.');
        setCheckingSession(false);
      }
    };

    initializeSession();
  }, [supabase.auth, fromPasswordReset]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate passwords first
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      // Use the supabase.auth.admin.updateUserById method instead
      // First get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        setError('Your session has expired. Please request a new password reset.');
        setLoading(false);
        return;
      }

      // Update the password using the admin API (requires service role key)
      // This bypasses the session requirement
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        user.id,
        { password: password }
      );

      if (updateError) {
        console.error('UpdatePasswordPage: Error updating password:', updateError);
        setError(updateError.message || 'Failed to update password. Please try again.');
      } else {
        setMessage('Password updated successfully! Redirecting to login...');
        // Clear any stored tokens
        localStorage.removeItem('passwordResetRawTokens');
        // Sign out after password update
        await supabase.auth.signOut();
        setTimeout(() => navigate('/login'), 2000);
      }
    } catch (err: any) {
      console.error('UpdatePasswordPage: Exception updating password:', err);
      setError(err.message || 'An error occurred while updating your password');
    } finally {
      setLoading(false);
    }
  };

  // Check if form is valid for submission
  const isFormValid = password.length >= 6 && 
                     confirmPassword.length >= 6 && 
                     password === confirmPassword;

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <Card className="max-w-md w-full">
          <CardBody className="text-center">
            <div className="animate-pulse">
              <div className="h-12 w-12 bg-blue-200 rounded-full mx-auto mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
            </div>
            <p className="text-gray-600 mt-4">Verifying your reset link...</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">Invalid Reset Link</h2>
          </CardHeader>
          <CardBody className="text-center">
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <Button onClick={() => navigate('/forgot-password')} variant="primary" className="w-full mb-2">
              Request New Reset Link
            </Button>
            <Button onClick={() => navigate('/login')} variant="outline" className="w-full">
              Back to Login
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Set New Password</h2>
          <p className="mt-2 text-sm text-gray-600">
            Please enter your new password below.
          </p>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleUpdatePassword} className="space-y-6">
            <div>
              <label htmlFor="password" className="sr-only">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="New Password (min. 6 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="sr-only">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}
            {message && (
              <p className="text-sm text-green-600 text-center">{message}</p>
            )}

            <div>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={loading || !isFormValid}
              >
                {loading ? 'Updating Password...' : 'Update Password'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
};

export default UpdatePasswordPage;