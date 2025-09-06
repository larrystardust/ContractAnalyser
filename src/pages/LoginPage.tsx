import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSupabaseClient, useSessionContext } from '@supabase/auth-helpers-react';
import Button from '../components/ui/Button';
import Card, { CardBody, CardHeader } from '../components/ui/Card';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'; // ADDED Loader2
import { Database } from '../types/supabase';
import { useAuth } from '../context/AuthContext'; // ADDED: Import useAuth

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null); // ADDED: For success messages
  const [showForgotPassword, setShowForgotPassword] = useState(false); // ADDED: State for forgot password form
  
  const supabase = useSupabaseClient<Database>();
  const navigate = useNavigate();
  const { session, isLoading: isSessionLoading } = useSessionContext();
  const [searchParams] = useSearchParams();
  const { sendPasswordResetEmail } = useAuth(); // ADDED: Use sendPasswordResetEmail from AuthContext

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
    if (!isSessionLoading && session?.user) {
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
  }, [session, isSessionLoading, navigate, supabase, searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null); // Clear messages on new attempt

    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
    } else {
      if (authData.user) { 
        try {
          await supabase
            .from('profiles')
            .update({ login_at: new Date().toISOString() })
            .eq('id', authData.user.id);
          console.log('LoginPage: login_at updated for user:', authData.user.id);
        } catch (updateLoginError) {
          console.error('LoginPage: Error updating login_at:', updateLoginError);
        }
      }
    }
    setLoading(false);
  };

  // ADDED: Handle forgot password submission
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (!email) {
      setError('Please enter your email address.');
      setLoading(false);
      return;
    }

    try {
      // MODIFIED: Removed redirectTo argument
      await sendPasswordResetEmail(email); 
      setMessage('Password reset instructions sent to your email!');
      setShowForgotPassword(false); // Go back to login form
      setEmail(''); // Clear email field
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email.');
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            {showForgotPassword ? 'Reset Your Password' : 'Log In to ContractAnalyser'}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {showForgotPassword ? 'Enter your email to receive reset instructions.' : 'Welcome back! Please enter your credentials.'}
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
                <label htmlFor="email" className="sr-only">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Email address"
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
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Send Reset Instructions'}
                </Button>
              </div>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="font-medium text-blue-600 hover:text-blue-500 text-sm"
                >
                  Back to Login
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label htmlFor="email" className="sr-only">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="sr-only">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Password"
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
                  {loading ? 'Logging In...' : 'Log In'}
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
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Forgot password?
                </button>
              </p>
            )}
            <p className="text-sm text-gray-600 mt-2">
              Don't have an account?{' '}
              <Link to={signupLink} className="font-medium text-blue-600 hover:text-blue-500">
                Sign Up
              </Link>
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default LoginPage;