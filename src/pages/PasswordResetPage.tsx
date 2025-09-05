import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSupabaseClient, useSessionContext } from '@supabase/auth-helpers-react';
import Button from '../components/ui/Button';
import Card, { CardBody, CardHeader } from '../components/ui/Card';
import { Mail } from 'lucide-react';

const PasswordResetPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = useSupabaseClient();
  const { session } = useSessionContext();

  useEffect(() => {
    const signOutIfLoggedIn = async () => {
      if (session) {
        console.log('PasswordResetPage: User already logged in, signing out for clean reset process.');
        await supabase.auth.signOut();
      }
    };
    signOutIfLoggedIn();
  }, [session, supabase.auth]);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    // Use the Supabase auth callback URL which will properly handle the token exchange
    // The callback page should then redirect to the update-password page
    const redirectToUrl = `${window.location.origin}/auth/callback?redirect=/update-password`;

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectToUrl,
    });

    if (resetError) {
      setError(resetError.message);
    } else {
      setMessage('Password reset email sent! Please check your inbox.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Reset Your Password</h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </CardHeader>
        <CardBody>
          <form onSubmit={handlePasswordReset} className="space-y-6">
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
                disabled={loading}
              >
                {loading ? 'Sending Link...' : 'Send Reset Link'}
              </Button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Remember your password?{' '}
              <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
                Log In
              </Link>
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default PasswordResetPage;