import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSupabaseClient, useSessionContext } from '@supabase/auth-helpers-react';
import Card, { CardBody, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Smartphone, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Database } from '../types/supabase';

const MfaChallengePage: React.FC = () => {
  const supabase = useSupabaseClient<Database>();
  const navigate = useNavigate();
  const { session, isLoading: isSessionLoading } = useSessionContext();
  const [searchParams] = useSearchParams();

  const [totpCode, setTotpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);

  const redirectPath = searchParams.get('redirect') || '/dashboard';

  useEffect(() => {
    if (isSessionLoading) return;

    if (!session?.user) {
      // No user session, redirect to login
      navigate('/login');
      return;
    }

    // If aal1, fetch MFA factors to get the factorId
    const fetchMfaFactors = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) throw factorsError;

        const totpFactor = factors.totp.find(f => f.status === 'verified');
        if (totpFactor) {
          setFactorId(totpFactor.id);
          setMessage('Please enter your 2FA code.');
        } else {
          // No TOTP factor found, redirect to dashboard (or login if unexpected)
          // This means the user was incorrectly sent to MFA challenge page.
          console.warn('MfaChallengePage: User has no verified TOTP factors but is on MFA challenge page. Redirecting.');
          navigate(redirectPath); // Or navigate('/login') if this is a critical error
        }
      } catch (err: any) {
        console.error('MfaChallengePage: Error fetching MFA factors:', err);
        setError(err.message || 'Failed to load MFA factors.');
        navigate('/login'); // Redirect to login on error
      } finally {
        setLoading(false);
      }
    };

    fetchMfaFactors();
  }, [session, isSessionLoading, navigate, supabase, redirectPath]);

  // REMOVED: The useEffect that watches session.aal for navigation.
  // This was causing a race condition with AuthGuard.

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (!factorId) {
      setError('MFA factor not found. Please try logging in again.');
      setLoading(false);
      return;
    }

    try {
      // Step 1: Challenge the factor
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      if (!challengeData?.id) {
        throw new Error('Failed to create MFA challenge.');
      }

      // Step 2: Verify the challenge with the TOTP code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: totpCode,
      });

      if (verifyError) throw verifyError;

      // MFA verification successful.
      // Directly navigate to the intended path.
      // The auth-helpers-react library should update the session context after mfa.verify.
      navigate(redirectPath);

    } catch (err: any) {
      console.error('MFA verification error:', err);
      setError(err.message || 'Invalid 2FA code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (isSessionLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  // If session is already aal2, it should have been redirected by the useEffect.
  // This is a fallback to prevent rendering the form if already authenticated.
  // This check is still important for initial load if the user somehow lands here with aal2.
  if (!session?.user || session.aal === 'aal2') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <Smartphone className="h-12 w-12 text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">Two-Factor Authentication</h2>
          <p className="mt-2 text-sm text-gray-600">
            Please enter the 6-digit code from your authenticator app.
          </p>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleVerifyMfa} className="space-y-6">
            <div>
              <label htmlFor="totpCode" className="sr-only">2FA Code</label>
              <input
                id="totpCode"
                name="totpCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="one-time-code"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-center text-lg tracking-widest focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="------"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                disabled={loading}
              />
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative flex items-center">
                <AlertCircle className="h-5 w-5 mr-2" />
                <span>{error}</span>
              </div>
            )}
            {message && !error && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative flex items-center">
                <CheckCircle className="h-5 w-5 mr-2" />
                <span>{message}</span>
              </div>
            )}

            <div>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={loading || totpCode.length !== 6}
              >
                {loading ? 'Verifying...' : 'Verify Code'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
};

export default MfaChallengePage;