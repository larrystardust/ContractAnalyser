import React, { useState, useEffect } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react'; // Removed useSessionContext
import { useNavigate, useLocation } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card, { CardBody, CardHeader } from '../components/ui/Card';
import { Lock } from 'lucide-react';

const UpdatePasswordPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false); // For form submission loading
  const [error, setError] = useState<string | null>(null); // For form submission errors
  const [message, setMessage] = useState<string | null>(null); // For form submission success messages
  const supabase = useSupabaseClient();
  // Removed useSessionContext - no longer needed
  const navigate = useNavigate();
  const location = useLocation();

  const [isSessionValidForUpdate, setIsSessionValidForUpdate] = useState(false);
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);

  useEffect(() => {
    const processAuthCallback = async () => {
      console.log('UpdatePasswordPage: Initial check started.');
      console.log('UpdatePasswordPage: Current URL hash:', window.location.hash);

      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type'); // Should be 'recovery' for password reset

      if (accessToken && refreshToken && type === 'recovery') {
        console.log('UpdatePasswordPage: Detected password recovery tokens in URL hash. Attempting to set session.');
        try {
          const { data: { session: newSession }, error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (setSessionError) {
            console.error('UpdatePasswordPage: Error setting session from URL hash:', setSessionError);
            setError('Failed to verify reset link. Please request a new password reset.');
            setIsSessionValidForUpdate(false);
          } else if (newSession) {
            console.log('UpdatePasswordPage: Session successfully set from URL hash. Setting isSessionValidForUpdate to true.');
            setIsSessionValidForUpdate(true);
            // Clear the URL hash to prevent re-processing and clean up the URL
            navigate(location.pathname, { replace: true });
          }
        } catch (err: any) {
          console.error('UpdatePasswordPage: Unexpected error during session setting from hash:', err);
          setError('An unexpected error occurred. Please request a new password reset.');
          setIsSessionValidForUpdate(false);
        }
      } else {
        console.log('UpdatePasswordPage: No password recovery tokens in hash or not recovery type. Checking current session directly.');
        // If no tokens in hash, check if there's an existing session (e.g., user navigated here directly while logged in)
        const { data: { session: currentSession }, error: getSessionError } = await supabase.auth.getSession();
        if (getSessionError || !currentSession) {
          console.log('UpdatePasswordPage: No valid session found after checking hash and direct session.');
          setError('Invalid or expired password reset link. Please request a new password reset.');
          setIsSessionValidForUpdate(false);
        } else {
          console.log('UpdatePasswordPage: Valid session found directly. Setting isSessionValidForUpdate to true.');
          setIsSessionValidForUpdate(true);
        }
      }
      setInitialCheckComplete(true); // Mark initial check as complete
    };

    processAuthCallback();
  }, [supabase, navigate, location.pathname]); // Dependencies for this effect

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null); // Clear previous success messages on new attempt

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

    // CRITICAL: Fetch the latest session right before attempting to update
    // This is the authoritative check for an active session at the point of submission.
    const { data: currentSessionData, error: getSessionError } = await supabase.auth.getSession();
    const currentSession = currentSessionData?.session;

    if (getSessionError || !currentSession) {
      console.error('UpdatePasswordPage: Failed to get current session before update:', getSessionError);
      setError('No active session found. Please log in or request a new password reset.');
      setLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        console.error('UpdatePasswordPage: Error updating password:', updateError);
        setError(updateError.message || 'Failed to update password. Please try again.');
      } else {
        setMessage('Password updated successfully! Redirecting to login...');
        // Sign out after password update to force re-login with new password
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

  const isFormValid = password.length >= 6 &&
                     confirmPassword.length >= 6 &&
                     password === confirmPassword;

  if (!initialCheckComplete) {
    console.log('UpdatePasswordPage: Initial check not complete. Displaying loading state.');
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

  if (!isSessionValidForUpdate) {
    console.log('UpdatePasswordPage: Initial check complete, but session is not valid for update. Displaying error state.');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">Invalid Reset Link</h2>
          </CardHeader>
          <CardBody className="text-center">
            <p className="text-sm text-red-600 mb-4">{error || 'Your session has expired. Please request a new password reset.'}</p>
            <Button onClick={() => navigate('/password-reset')} variant="primary" className="w-full mb-2">
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

  console.log('UpdatePasswordPage: Session valid for update. Displaying password update form.');
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