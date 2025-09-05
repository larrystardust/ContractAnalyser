import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import Card, { CardBody, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';

const UpdatePasswordPage: React.FC = () => {
  const supabase = useSupabaseClient();
  const navigate = useNavigate();
  const location = useLocation(); // To get hash from URL

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // Extract access_token and refresh_token from URL hash
    const hashParams = new URLSearchParams(location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token'); // ADDED: Extract refresh_token

    console.log('UpdatePasswordPage: Extracted tokens from URL hash:', { accessToken, refreshToken }); // ADDED: Log extracted tokens

    if (accessToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }) // MODIFIED: Pass refresh_token
        .then(async ({ error }) => { // Make this async to await signOut
          if (error) {
            console.error('Error setting session:', error);
            setError('Failed to set session. The link may be invalid or expired.');
          } else {
            setMessage('Please enter your new password.');
            // Immediately sign out the temporary session to prevent automatic login to the app
            // The tokens are still valid for the password update operation.
            await supabase.auth.signOut(); // ADDED THIS LINE
            console.log('UpdatePasswordPage: Temporary session cleared.');
          }
        })
        .catch(err => {
          console.error('Unexpected error setting session:', err);
          setError('An unexpected error occurred. Please try again.');
        });
    } else {
      setError('No access token found. Please use the link from your email.');
    }
  }, [location.hash, supabase.auth]);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) { // Supabase default minimum password length
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      setMessage('Your password has been successfully updated! Redirecting to login...');
      // Clear the session after password update for security
      await supabase.auth.signOut();
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 3000); // Redirect after 3 seconds
    } catch (err: any) {
      console.error('Error updating password:', err);
      setError(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Set New Password</h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter and confirm your new password below.
          </p>
        </CardHeader>
        <CardBody>
          {message && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4 flex items-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              <span>{message}</span>
            </div>
          )}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handlePasswordUpdate} className="space-y-6">
            <div>
              <label htmlFor="new-password" className="sr-only">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  id="new-password"
                  name="new-password"
                  autoComplete="new-password"
                  required
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="sr-only">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirm-password"
                  name="confirm-password"
                  autoComplete="new-password"
                  required
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={loading || !newPassword || !confirmPassword}
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