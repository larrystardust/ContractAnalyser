import React, { useState, useEffect } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useNavigate } from 'react-router-dom';
import { Database } from '../types/supabase';

const RECOVERY_FLAG = 'password_recovery_active';
const RECOVERY_EXPIRY = 'password_recovery_expiry';
const RECOVERY_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const ResetPassword: React.FC = () => {
  const supabase = useSupabaseClient<Database>();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // On mount, set the recovery flag with expiry
  useEffect(() => {
    const expiryTime = Date.now() + RECOVERY_DURATION_MS;
    localStorage.setItem(RECOVERY_FLAG, 'true');
    localStorage.setItem(RECOVERY_EXPIRY, expiryTime.toString());
    console.log('ResetPassword: Recovery flag set with expiry:', new Date(expiryTime).toISOString());
  }, []);

  const clearRecoveryState = () => {
    localStorage.removeItem(RECOVERY_FLAG);
    localStorage.removeItem(RECOVERY_EXPIRY);
    console.log('ResetPassword: Recovery state cleared.');
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!password || !confirmPassword) {
      setErrorMsg('Please fill in both password fields.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      // Supabase requires the recovery session to still be alive
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        console.error('ResetPassword: Error updating password:', error);
        setErrorMsg(error.message || 'Failed to update password.');
        setLoading(false);
        return;
      }

      // Clear recovery state after successful reset
      clearRecoveryState();

      // Sign out to kill the temporary recovery session
      await supabase.auth.signOut();

      console.log('ResetPassword: Password updated successfully. Redirecting to login.');
      navigate('/login');
    } catch (err: any) {
      console.error('ResetPassword: Unexpected error:', err);
      setErrorMsg('Unexpected error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-md">
        <h1 className="text-2xl font-bold text-center mb-6">Reset Your Password</h1>
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter new password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500"
              placeholder="Confirm new password"
            />
          </div>

          {errorMsg && (
            <p className="text-sm text-red-600 mt-2">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-900 text-white py-2 px-4 rounded-md shadow hover:bg-blue-800 disabled:opacity-50"
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;