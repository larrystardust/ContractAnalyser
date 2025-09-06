import React, { useState, useEffect } from 'react';
import { useSupabaseClient, useSessionContext } from '@supabase/auth-helpers-react';
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
  const { session: currentAuthSession } = useSessionContext();
  const navigate = useNavigate();
  const location = useLocation();

  const [isSessionValidForUpdate, setIsSessionValidForUpdate] = useState(false);
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);

  useEffect(() => {
    // ✅ Persist hash into sessionStorage for refresh survival
    if (window.location.hash) {
      sessionStorage.setItem('supabaseRecoveryHash', window.location.hash);
    } else {
      const storedHash = sessionStorage.getItem('supabaseRecoveryHash');
      if (storedHash) {
        console.log('UpdatePasswordPage: Restoring hash from sessionStorage.');
        window.location.hash = storedHash;
      }
    }

    const processAuthCallback = async () => {
      console.log('UpdatePasswordPage: Initial check started.');
      console.log('UpdatePasswordPage: Current URL hash:', window.location.hash);

      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type'); // Should be 'recovery'

      if (accessToken && refreshToken && type === 'recovery') {
        console.log('UpdatePasswordPage: Found tokens in hash. Setting session...');
        try {
          const { data: { session: newSession }, error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (setSessionError) {
            console.error('UpdatePasswordPage: Error setting session:', setSessionError);
            setError('Failed to verify reset link. Please request a new password reset.');
            setIsSessionValidForUpdate(false);
          } else if (newSession) {
            console.log('UpdatePasswordPage: Session successfully set.');
            await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
            setIsSessionValidForUpdate(true);

            // ✅ Keep the full hash in the URL and persist
            navigate(`${location.pathname}${window.location.hash}`, { replace: true });
            sessionStorage.setItem('supabaseRecoveryHash', window.location.hash);
          }
        } catch (err: any) {
          console.error('UpdatePasswordPage: Unexpected error:', err);
          setError('An unexpected error occurred. Please request a new password reset.');
          setIsSessionValidForUpdate(false);
        }
      } else {
        console.log('UpdatePasswordPage: No tokens in hash. Checking current session.');
        const { data: { session: currentSession }, error: getSessionError } = await supabase.auth.getSession();
        if (getSessionError || !currentSession) {
          setError('Invalid or expired password reset link. Please request a new one.');
          setIsSessionValidForUpdate(false);
        } else {
          setIsSessionValidForUpdate(true);
        }
      }
      setInitialCheckComplete(true);
    };

    processAuthCallback();
  }, [supabase, navigate, location.pathname]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

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

    let sessionToUse = null;

    if (currentAuthSession) {
      sessionToUse = currentAuthSession;
    } else {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        const storedHash = sessionStorage.getItem('supabaseRecoveryHash') || location.hash;
        const hashParams = new URLSearchParams(storedHash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        if (accessToken && refreshToken) {
          const { data: { session: reSetSession } } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (reSetSession) sessionToUse = reSetSession;
        }
      } else if (refreshData?.session) {
        sessionToUse = refreshData.session;
      }
    }

    if (!sessionToUse) {
      const { data: currentSessionData } = await supabase.auth.getSession();
      sessionToUse = currentSessionData?.session;
    }

    if (!sessionToUse) {
      setError('No active session found. Please log in or request a new reset.');
      setLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(updateError.message || 'Failed to update password. Please try again.');
      } else {
        setMessage('Password updated successfully! Redirecting to login...');
        await supabase.auth.signOut();
        sessionStorage.removeItem('supabaseRecoveryHash'); // ✅ cleanup after success
        setTimeout(() => navigate('/login'), 2000);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating your password');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid =
    password.length >= 6 &&
    confirmPassword.length >= 6 &&
    password === confirmPassword;

  if (!initialCheckComplete) {
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
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">Invalid Reset Link</h2>
          </CardHeader>
          <CardBody className="text-center">
            <p className="text-sm text-red-600 mb-4">{error || 'Your session has expired. Please request a new reset link.'}</p>
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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Set New Password</h2>
          <p className="mt-2 text-sm text-gray-600">Please enter your new password below.</p>
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

            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            {message && <p className="text-sm text-green-600 text-center">{message}</p>}

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