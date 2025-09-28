import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSupabaseClient, useSessionContext } from '@supabase/auth-helpers-react';
import Button from '../components/ui/Button';
import Card, { CardBody, CardHeader } from '../components/ui/Card';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Database } from '../types/supabase';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/ui/LanguageSelector';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  
  const supabase = useSupabaseClient<Database>();
  const navigate = useNavigate();
  const { session, isLoading: isSessionLoading } = useSessionContext();
  const [searchParams] = useSearchParams();
  const { sendPasswordResetEmail } = useAuth();
  const { t } = useTranslation();

  const redirectToDashboard = async (user_id: string) => {
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user_id)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching admin status:', profileError);
      navigate('/dashboard');
    } else if (data?.is_admin) {
      navigate('/admin');
    } else {
      navigate('/dashboard');
    }
  };

  useEffect(() => {
    if (!isSessionLoading && !session) {
      // If there's no session and we're not loading, clear any stale MFA flag
      localStorage.removeItem('mfa_passed');
    }

    if (!isSessionLoading && session?.user) {
      // Check if password reset flow is active in localStorage
      const isPasswordResetFlowActive = localStorage.getItem('passwordResetFlowActive') === 'true';
      if (isPasswordResetFlowActive) {
        console.log('LoginPage: Password reset flow is active, not redirecting to dashboard yet.');
        // Do not redirect to dashboard if a password reset flow is active.
        // AuthGuard will handle the redirect to /reset-password.
        return;
      }

      // CRITICAL FIX: Clear password reset flags on successful login
      localStorage.removeItem('passwordResetFlowActive');
      localStorage.removeItem('blockModalsDuringReset');

      if (session.aal === 'aal2') {
        redirectToDashboard(session.user.id);
      } else {
        const checkMfaFactors = async () => {
          const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
          if (factorsError) {
            console.error('Error listing MFA factors:', factorsError);
            redirectToDashboard(session.user.id);
            return;
          }

          if (factors.totp.length > 0) {
            const redirectPath = searchParams.get('redirect') || '/dashboard';
            navigate(`/mfa-challenge?redirect=${encodeURIComponent(redirectPath)}`);
          } else {
            redirectToDashboard(session.user.id);
          }
        };
        checkMfaFactors();
      }
    }
  }, [location, session, navigate, isSessionLoading, supabase, searchParams]); // Added location to dependencies

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      // MODIFIED: Use translation string for specific error message
      if (signInError.message === "Invalid login credentials") {
        setError(t('invalid_login_credentials'));
      } else {
        setError(signInError.message);
      }
    } else {
      if (authData.user) { 
        try {
          await supabase
            .from('profiles')
            .update({ login_at: new Date().toISOString() })
            .eq('id', authData.user.id);
          console.log('LoginPage: login_at updated for user:', authData.user.id);

          // CRITICAL FIX: Explicitly refresh session after successful login
          // This helps ensure the AAL (Authentication Assurance Level) is correctly updated to aal2
          // and any lingering recovery flags are cleared from the session object.
          const { data: refreshedSessionData, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.error('LoginPage: Error refreshing session after login:', refreshError);
          } else {
            console.log('LoginPage: Session refreshed. New AAL:', refreshedSessionData?.session?.aal);
            // The useEffect above will now handle the redirection based on the refreshed session.
          }

        } catch (updateLoginError) {
          console.error('LoginPage: Error updating login_at:', updateLoginError);
          // Even if updating login_at fails, proceed with redirection
          redirectToDashboard(authData.user.id); // Fallback if refresh fails or doesn't trigger useEffect
        }
      }
    }
    setLoading(false);
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (!email) {
      setError(t('please_enter_email'));
      setLoading(false);
      return;
    }

    try {
      await sendPasswordResetEmail(email); 
      setMessage(t('password_reset_email_sent'));
      setShowForgotPassword(false);
      setEmail('');
    } catch (err: any) {
      setError(err.message || t('failed_to_send_password_reset'));
    } finally {
      setLoading(false);
    }
  };

  if (isSessionLoading) {
    return null;
  }

  const redirectParam = searchParams.get('redirect');
  const signupLink = redirectParam ? `/signup?redirect=${encodeURIComponent(redirectParam)}` : '/signup';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-0">
        <LanguageSelector />
      </div>
      <Card className="max-w-md w-full mt-0">
        <CardHeader className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            {showForgotPassword ? t('reset_your_password') : t('login_to_app')}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {showForgotPassword ? t('enter_email_reset_instructions') : t('welcome_back')}
          </p>
        </CardHeader>
        <CardBody>
          {error && (
            <p className="text-sm text-red-600 text-center mb-4">{error}</p>
          )}
          {message && (
            <p className="text-sm text-green-600 text-center mb-4">{message}</p>
          )}

          {showForgotPassword ? (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="sr-only">{t('email_address')}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder={t('email_address')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t('send_reset_instructions')}
                </Button>
              </div>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="font-medium text-blue-600 hover:text-blue-500 text-sm"
                >
                  {t('back_to_login')}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label htmlFor="email" className="sr-only">{t('email_address')}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder={t('email_address')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="sr-only">{t('password')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder={t('password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? t('logging_in') : t('login')}
                </Button>
              </div>
            </form>
          )}

          <div className="mt-6 text-center">
            {!showForgotPassword && (
              <p className="mt-2 text-sm text-gray-600">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="font-medium text-blue-600 hover:text-blue-500 text-sm"
                >
                  {t('forgot_password')}
                </button>
              </p>
            )}
            <p className="text-sm text-gray-600 mt-2">
              {t('dont_have_account')}{' '}
              <Link to={signupLink} className="font-medium text-blue-600 hover:text-blue-500">
                {t('signup')}
              </Link>
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default LoginPage;