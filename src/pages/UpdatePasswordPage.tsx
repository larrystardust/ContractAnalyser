import React, { useState, useEffect } from 'react';
import { useSupabaseClient, useSessionContext } from '@supabase/auth-helpers-react';
import { useNavigate, useLocation } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card, { CardBody, CardHeader } from '../components/ui/Card';
import { Lock } from 'lucide-react';

const RECOVERY_HASH_KEY = 'supabase_recovery_hash';

const UpdatePasswordPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSessionValidForUpdate, setIsSessionValidForUpdate] = useState(false);
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);

  // Debug state
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const supabase = useSupabaseClient();
  const { session: currentAuthSession } = useSessionContext();
  const navigate = useNavigate();
  const location = useLocation();

  // Helper: log current URL
  const logUrlContext = (label: string) => {
    console.log(`[URL DEBUG] ${label}:`, window.location.href);
  };

  useEffect(() => {
    const processAuthCallback = async () => {
      console.log('=== processAuthCallback START ===');
      logUrlContext('Initial page load');

      const storedHash = sessionStorage.getItem(RECOVERY_HASH_KEY);

      if (!window.location.hash && storedHash) {
        console.log('Restoring stored hash from sessionStorage');
        window.location.hash = storedHash;
        window.history.replaceState(null, '', `${location.pathname}${window.location.hash}`);
        logUrlContext('After restoring stored hash');
      } else if (window.location.hash) {
        console.log('Saving hash to sessionStorage');
        sessionStorage.setItem(RECOVERY_HASH_KEY, window.location.hash);
        logUrlContext('After saving current hash');
      }

      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');

      console.log('Parsed hash tokens:', {
        accessToken: accessToken ? `${accessToken.substring(0, 6)}...` : null,
        refreshToken: refreshToken ? `${refreshToken.substring(0, 6)}...` : null,
        type,
      });

      if (accessToken && refreshToken && type === 'recovery') {
        console.log('Setting Supabase session with tokens');
        const { data: { session: newSession }, error: setSessionError } =
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

        if (setSessionError) {
          console.error('Error setting session:', setSessionError);
          setError('Failed to verify reset link. Please request a new one.');
          setIsSessionValidForUpdate(false);
        } else if (newSession) {
          console.log('Session successfully set from hash.');
          logUrlContext('After supabase.auth.setSession');
          setIsSessionValidForUpdate(true);
        }
      } else {
        console.log('No valid tokens in hash. Checking current Supabase session.');
        const { data: { session: currentSession }, error: getSessionError } = await supabase.auth.getSession();
        if (getSessionError || !currentSession) {
          console.log('No valid session found.');
          setError('Invalid or expired password reset link.');
          setIsSessionValidForUpdate(false);
        } else {
          console.log('Valid Supabase session found.');
          setIsSessionValidForUpdate(true);
        }
      }

      // Always fetch and update debug info
      const { data: debugSession } = await supabase.auth.getSession();
      setDebugInfo({
        accessToken: accessToken ? `${accessToken.substring(0, 6)}...` : null,
        refreshToken: refreshToken ? `${refreshToken.substring(0, 6)}...` : null,
        type,
        supabaseSession: debugSession,
      });

      setInitialCheckComplete(true);
      console.log('=== processAuthCallback END ===');
    };

    processAuthCallback();
  }, [supabase, location.pathname]);

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

    let sessionToUse = currentAuthSession;

    if (!sessionToUse) {
      console.log('No session in context. Attempting refresh.');
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.error('Error refreshing session:', refreshError);
      } else {
        sessionToUse = refreshData.session;
      }
    }

    if (!sessionToUse) {
      console.error('No active session found before password update.');
      setError('No active session found. Please log in again.');
      setLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        console.error('Error updating password:', updateError);
        setError(updateError.message || 'Failed to update password');
      } else {
        setMessage('Password updated successfully! Redirecting to login...');
        await supabase.auth.signOut();
        setTimeout(() => {
          navigate('/login');
          logUrlContext('After navigate to /login');
        }, 1500);
      }
    } catch (err: any) {
      console.error('Exception updating password:', err);
      setError(err.message || 'Error updating password');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = password.length >= 6 && confirmPassword.length >= 6 && password === confirmPassword;

  if (!initialCheckComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Verifying reset link...</p>
      </div>
    );
  }

  if (!isSessionValidForUpdate) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <h2 className="text-2xl font-bold">Invalid Reset Link</h2>
          </CardHeader>
          <CardBody className="text-center">
            <p className="text-sm text-red-600 mb-4">{error || 'Your session has expired.'}</p>
            <Button onClick={() => navigate('/password-reset')} variant="primary" className="w-full mb-2">
              Request New Reset Link
            </Button>
            <Button onClick={() => navigate('/login')} variant="outline" className="w-full">
              Back to Login
            </Button>
          </CardBody>
        </Card>
        {/* Debug Panel */}
        {debugInfo && (
          <div className="fixed bottom-2 right-2 bg-gray-100 border p-3 text-xs max-w-xs overflow-auto shadow">
            <h4 className="font-bold mb-1">[DEBUG INFO]</h4>
            <pre className="whitespace-pre-wrap text-left">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
            <Button
              size="sm"
              onClick={async () => {
                const { data } = await supabase.auth.getSession();
                setDebugInfo((prev: any) => ({ ...prev, supabaseSession: data }));
                logUrlContext('Manual debug refresh');
              }}
            >
              Refresh Debug
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <h2 className="text-2xl font-bold">Set New Password</h2>
          <p className="mt-2 text-sm text-gray-600">Please enter your new password below.</p>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleUpdatePassword} className="space-y-6">
            <div>
              <label htmlFor="password" className="sr-only">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  className="w-full pl-10 pr-3 py-2 border rounded-md"
                  placeholder="New Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="sr-only">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  minLength={6}
                  className="w-full pl-10 pr-3 py-2 border rounded-md"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            {message && <p className="text-sm text-green-600 text-center">{message}</p>}

            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading || !isFormValid}>
              {loading ? 'Updating Password...' : 'Update Password'}
            </Button>
          </form>
        </CardBody>
      </Card>

      {/* Debug Panel */}
      {debugInfo && (
        <div className="fixed bottom-2 right-2 bg-gray-100 border p-3 text-xs max-w-xs overflow-auto shadow">
          <h4 className="font-bold mb-1">[DEBUG INFO]</h4>
          <pre className="whitespace-pre-wrap text-left">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
          <Button
            size="sm"
            onClick={async () => {
              const { data } = await supabase.auth.getSession();
              setDebugInfo((prev: any) => ({ ...prev, supabaseSession: data }));
              logUrlContext('Manual debug refresh');
            }}
          >
            Refresh Debug
          </Button>
        </div>
      )}
    </div>
  );
};

export default UpdatePasswordPage;