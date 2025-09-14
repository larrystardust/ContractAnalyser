import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSupabaseClient, useSessionContext } from '@supabase/auth-helpers-react';
import Card, { CardBody, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Smartphone, Loader2, AlertCircle, CheckCircle, LogOut } from 'lucide-react';
import { Database } from '../types/supabase';
import { useTranslation } from 'react-i18next'; // ADDED

const MfaChallengePage: React.FC = () => {
  const supabase = useSupabaseClient<Database>();
  const navigate = useNavigate();
  const { session, isLoading: isSessionLoading } = useSessionContext();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation(); // ADDED

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
          setMessage(t('enter_6_digit_code')); // MODIFIED
        } else {
          // No TOTP factor found, redirect to dashboard (or login if unexpected)
          // This means the user was incorrectly sent to MFA challenge page.
          console.warn('MfaChallengePage: User has no verified TOTP factors but is on MFA challenge page. Redirecting.');
          navigate(redirectPath);
        }
      } catch (err: any) {
        console.error('MfaChallengePage: Error fetching MFA factors:', err);
        setError(err.message || t('failed_to_load_mfa_factors')); // MODIFIED
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    fetchMfaFactors();
  }, [session, isSessionLoading, navigate, supabase, redirectPath, t]); // MODIFIED: Added t to dependency array

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (!factorId) {
      setError(t('mfa_factor_not_found')); // MODIFIED
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
      // Explicitly refresh the session to ensure AAL is updated immediately.
      // This is crucial for AuthGuard to correctly recognize the session.
      const { data: refreshedSessionData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.error('MfaChallengePage: Error refreshing session after MFA verification:', refreshError);
      } else {
        console.log('MfaChallengePage: Session refreshed. New AAL:', refreshedSessionData?.session?.aal);
      }

      // Now, explicitly get the session again to ensure we have the latest state
      const { data: { session: currentSessionAfterRefresh }, error: getSessionError } = await supabase.auth.getSession();
      if (getSessionError) {
        console.error('MfaChallengePage: Error getting session after refresh:', getSessionError);
      } else {
        console.log('MfaChallengePage: Current session AAL after refresh and getSession:', currentSessionAfterRefresh?.aal);
      }

      // Set localStorage flag to indicate MFA was passed
      localStorage.setItem('mfa_passed', 'true');
      // REMOVED: localStorage.removeItem('mfa_passed'); // This line was removed from AuthGuard and AdminGuard

      // Navigate to the redirect path
      navigate(redirectPath);

    } catch (err: any) {
      console.error('MFA verification error:', err);
      setError(err.message || t('invalid_2fa_code')); // MODIFIED
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('mfa_passed');
      navigate('/login');
    } catch (err: any) {
      console.error('Error logging out:', err);
      setError(err.message || t('failed_to_log_out')); // MODIFIED
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

  // If session is already aal2, it should have been redirected by the AuthGuard.
  // This is a fallback to prevent rendering the form if already authenticated.
  if (!session?.user || session.aal === 'aal2') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <Smartphone className="h-12 w-12 text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">{t('two_factor_auth')}</h2> {/* MODIFIED */}
          <p className="mt-2 text-sm text-gray-600">
            {t('enter_6_digit_code')} {/* MODIFIED */}
          </p>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleVerifyMfa} className="space-y-6">
            <div>
              <label htmlFor="totpCode" className="sr-only">{t('2fa_code')}</label> {/* MODIFIED */}
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
                {loading ? t('verifying') : t('verify_code')} {/* MODIFIED */}
              </Button>
            </div>
          </form>
          <div className="mt-4">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              onClick={handleLogout}
              disabled={loading}
              icon={<LogOut className="h-5 w-5" />}
            >
              {t('logout_button')} {/* MODIFIED */}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default MfaChallengePage;