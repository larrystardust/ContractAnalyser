import React, { useState, useEffect } from 'react';
import { useSupabaseClient, useSessionContext } from '@supabase/auth-helpers-react';
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
  const { session, isLoading: isSessionLoading } = useSessionContext(); // Use isLoading from context
  const navigate = useNavigate();
  const location = useLocation();

  // New state to track if the session has been explicitly checked/set from the URL hash
  const [sessionCheckedFromHash, setSessionCheckedFromHash] = useState(false);

  useEffect(() => {
    const handlePasswordResetCallback = async () => {
      console.log('UpdatePasswordPage: useEffect triggered for session handling.');
      console.log('UpdatePasswordPage: Current URL hash:', window.location.hash);

      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type'); // Should be 'recovery' for password reset

      if (accessToken && refreshToken && type === 'recovery') {
        console.log('UpdatePasswordPage: Detected password recovery tokens in URL hash. Attempting to set session.');
        try {
          // Proactively set the session using the tokens from the URL hash
          const { data: { session: newSession }, error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (setSessionError) {
            console.error('UpdatePasswordPage: Error setting session from URL hash:', setSessionError);
            setError('Failed to verify reset link. Please request a new password reset.');
            setSessionCheckedFromHash(true); // Mark as checked, even if error
          } else if (newSession) {
            console.log('UpdatePasswordPage: Session successfully set from URL hash.');
            // Clear the URL hash to prevent re-processing and clean up the URL
            navigate(location.pathname, { replace: true });
            // Do NOT set sessionCheckedFromHash to true immediately here.
            // We need to wait for `useSessionContext` to update its `session` state.
          }
        } catch (err: any) {
          console.error('UpdatePasswordPage: Unexpected error during session setting from hash:', err);
          setError('An unexpected error occurred. Please request a new password reset.');
          setSessionCheckedFromHash(true); // Mark as checked, even if error
        }
      } else {
        console.log('UpdatePasswordPage: No password recovery tokens in hash or not recovery type. Relying on useSessionContext.');
        setSessionCheckedFromHash(true); // No hash to process, so consider it checked
      }
    };

    // Run this effect only once on mount to process the URL hash
    handlePasswordResetCallback();
  }, [supabase, navigate, location.pathname]); // Dependencies to ensure it runs correctly

  // This useEffect watches for changes in session and isLoading from useSessionContext
  // and updates sessionCheckedFromHash once the session state is stable.
  useEffect(() => {
    if (sessionCheckedFromHash) {
      // If we've already processed the hash and determined the session status,
      // no further action needed from this effect.
      return;
    }

    if (!isSessionLoading) { // Once useSessionContext has finished its initial loading
      if (session) {
        console.log('UpdatePasswordPage: useSessionContext reports session is now available. Marking sessionCheckedFromHash true.');
        setSessionCheckedFromHash(true); // Confirm session is ready
      } else {
        // If useSessionContext finishes loading and session is null,
        // and we haven't confirmed session from hash, then it's truly expired.
        console.log('UpdatePasswordPage: useSessionContext reports no session after loading. Marking sessionCheckedFromHash true and setting error.');
        setError('Your session has expired. Please request a new password reset.');
        setSessionCheckedFromHash(true); // Mark as checked, as no session was found
      }
    }
  }, [session, isSessionLoading, sessionCheckedFromHash]);


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

    // Ensure there's an active session before attempting to update
    // This check is primarily a safeguard; the UI should prevent this if session is null
    if (!session) {
      setError('No active session found. Please log in or request a new password reset.');
      setLoading(false);
      return;
    }

    try {
      // Use supabase.auth.updateUser() for client-side password updates
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

  // Check if form is valid for submission
  const isFormValid = password.length >= 6 && 
                     confirmPassword.length >= 6 && 
                     password === confirmPassword;

  // Render loading state while session is being determined by auth-helpers-react
  // OR if our local hash processing is not yet done.
  if (isSessionLoading || !sessionCheckedFromHash) {
    console.log(`UpdatePasswordPage: Displaying loading state. isSessionLoading: ${isSessionLoading}, sessionCheckedFromHash: ${sessionCheckedFromHash}`);
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

  // If not loading and no session is found, display the "Invalid Reset Link" error
  // This condition is now simplified because sessionCheckedFromHash will be true if we've finished processing.
  if (!session) {
    console.log('UpdatePasswordPage: No session found after all checks. Displaying error state.');
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

  // If not loading and a session is present, display the password update form
  console.log('UpdatePasswordPage: Session found. Displaying password update form.');
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