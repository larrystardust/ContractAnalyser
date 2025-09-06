import React, { useState, useEffect } from 'react';
import { useSupabaseClient, useSessionContext } from '@supabase/auth-helpers-react';
import { useNavigate, useLocation } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card, { CardBody, CardHeader } from '../components/ui/Card';
import { Lock } from 'lucide-react';

const RECOVERY_TOKENS_KEY = "RECOVERY_TOKENS";

const UpdatePasswordPage: React.FC = () => {
  const supabase = useSupabaseClient();
  const { session: currentAuthSession } = useSessionContext();
  const navigate = useNavigate();
  const location = useLocation();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSessionValid, setIsSessionValid] = useState(false);
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // Refresh debug info for live panel
  const refreshDebugInfo = async () => {
    const stored = sessionStorage.getItem(RECOVERY_TOKENS_KEY);
    const tokens = stored ? JSON.parse(stored) : null;
    const { data: sessionData } = await supabase.auth.getSession();
    setDebugInfo({
      url: window.location.href,
      tokens: tokens
        ? {
            access_token: tokens.access_token.substring(0, 6) + "...",
            refresh_token: tokens.refresh_token.substring(0, 6) + "...",
          }
        : null,
      session: sessionData?.session || null,
    });
  };

  // Process URL hash and set Supabase session
  useEffect(() => {
    const processAuthCallback = async () => {
      console.log('=== processAuthCallback START ===');
      console.log('[URL DEBUG] Initial page load:', window.location.href);

      let access_token: string | null = null;
      let refresh_token: string | null = null;

      // 1️⃣ Try hash first
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.replace(/^#/, ''));
        access_token = params.get('access_token');
        refresh_token = params.get('refresh_token');
        if (access_token && refresh_token) {
          sessionStorage.setItem(RECOVERY_TOKENS_KEY, JSON.stringify({ access_token, refresh_token }));
        }
      }

      // 2️⃣ Try sessionStorage fallback
      if (!access_token || !refresh_token) {
        const stored = sessionStorage.getItem(RECOVERY_TOKENS_KEY);
        if (stored) {
          const tokens = JSON.parse(stored);
          access_token = tokens.access_token;
          refresh_token = tokens.refresh_token;
        }
      }

      // 3️⃣ Attempt to set Supabase session
      if (access_token && refresh_token) {
        try {
          console.log('Attempting supabase.auth.setSession with token...');
          const { data, error: setSessionError } = await supabase.auth.setSession({ access_token, refresh_token });
          if (setSessionError) {
            console.error('Supabase setSession error:', setSessionError.message);
            setError('Failed to set session. Token may be expired.');
          } else {
            // Wait for Supabase to persist session
            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData?.session) {
              console.log('Session confirmed active.');
              setIsSessionValid(true);
              // ✅ Now safe to clean hash
              window.history.replaceState(null, '', location.pathname + '#');
            } else {
              console.warn('Session not active after setSession. Token may be invalid/expired.');
              setError('Invalid or expired password reset link. Please request a new reset.');
            }
          }
        } catch (err) {
          console.error('Exception during setSession:', err);
          setError('Unexpected error while setting session.');
        }
      } else {
        console.warn('No token found in hash or sessionStorage.');
        setError('No token found. Please request a new password reset.');
      }

      setInitialCheckComplete(true);
      await refreshDebugInfo();
      console.log('=== processAuthCallback END ===');
    };

    processAuthCallback();
  }, [supabase, location.pathname]);

  // Handle password update
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

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        setError('No active session found. Please request a new reset link.');
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setMessage('Password updated successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
      await refreshDebugInfo();
    }
  };

  if (!initialCheckComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Verifying your reset link...</p>
      </div>
    );
  }

  if (!isSessionValid) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardHeader><h2>Invalid Reset Link</h2></CardHeader>
          <CardBody>
            <p>{error}</p>
            <Button onClick={() => navigate('/password-reset')}>Request New Reset Link</Button>
            <Button onClick={() => navigate('/login')} variant="outline">Back to Login</Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <h2 className="text-2xl font-bold">Set New Password</h2>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleUpdatePassword} className="space-y-6">
            <div>
              <label htmlFor="password" className="sr-only">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="New Password"
                  className="w-full pl-10 pr-3 py-2 border rounded"
                />
              </div>
            </div>
            <div>
              <label htmlFor="confirmPassword" className="sr-only">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm Password"
                  className="w-full pl-10 pr-3 py-2 border rounded"
                />
              </div>
            </div>
            {error && <p className="text-red-600 text-center">{error}</p>}
            {message && <p className="text-green-600 text-center">{message}</p>}
            <Button type="submit" disabled={loading || password.length < 6 || password !== confirmPassword}>
              {loading ? 'Updating...' : 'Update Password'}
            </Button>
          </form>

          {/* Debug panel */}
          <div className="mt-6 p-4 border rounded bg-gray-50 text-xs">
            <h2 className="font-bold mb-2">Debug Info (Live)</h2>
            <pre className="whitespace-pre-wrap">{JSON.stringify(debugInfo, null, 2)}</pre>
            <Button onClick={refreshDebugInfo}>Refresh Debug Info</Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default UpdatePasswordPage;