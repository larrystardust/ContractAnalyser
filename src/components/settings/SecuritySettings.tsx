import React, { useState, useEffect } from 'react';
import { Shield, Key, Smartphone, Eye, EyeOff, Save, QrCode, CheckCircle, XCircle, Copy, Lock } from 'lucide-react';
import Button from '../components/ui/Button';
import Card, { CardBody, CardHeader } from '../ui/Card';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import Modal from '../components/ui/Modal';

const SecuritySettings: React.FC = () => {
  const supabase = useSupabaseClient();
  const session = useSession();

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  // 2FA States
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [showEnrollmentFlow, setShowEnrollmentFlow] = useState(false);
  const [enrollmentStep, setEnrollmentStep] = useState<'initial' | 'qr_display' | 'verify_code' | 'recovery_codes'>('initial');
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [factorId, setFactorId] = useState<string | null>(null);

  // Re-authentication states for disabling 2FA
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthTotpCode, setReauthTotpCode] = useState('');
  const [reauthError, setReauthError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetch2FAStatus = async () => {
      if (!session?.user) return;
      setIsLoading(true);
      setError(null);
      try {
        const { data: factors, error: getFactorsError } = await supabase.auth.mfa.listFactors();
        if (getFactorsError) throw getFactorsError;

        const totpFactor = factors?.totp.find(factor => factor.status === 'verified');
        if (totpFactor) {
          setTwoFactorEnabled(true);
          setFactorId(totpFactor.id);
        } else {
          setTwoFactorEnabled(false);
          setFactorId(null);
        }
      } catch (err: any) {
        console.error('Error fetching 2FA status:', err);
        setError(err.message || 'Failed to fetch 2FA status.');
      } finally {
        setIsLoading(false);
      }
    };

    fetch2FAStatus();
  }, [session?.user, supabase]);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match.');
      setIsLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      setMessage('Password updated successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      console.error('Error updating password:', err);
      setError(err.message || 'Failed to update password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTwoFactorToggle = async () => {
    setIsLoading(true);
    setError(null);
    setMessage(null);

    if (twoFactorEnabled) {
      setShowReauthModal(true);
      setIsLoading(false);
      return;
    } else {
      setShowEnrollmentFlow(true);
      setEnrollmentStep('qr_display');
      try {
        const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: `TOTP-${Date.now()}`,
        });
        if (enrollError) throw enrollError;

        if (!enrollData?.id) {
          throw new Error('Failed to enroll 2FA factor. Please try again.');
        }

        setFactorId(enrollData.id);

        if (!enrollData.totp) {
          throw new Error('Failed to generate 2FA enrollment data. Please check your Supabase project\'s TOTP MFA configuration.');
        }

        if (!enrollData.totp.qr_code || !enrollData.totp.secret) {
          throw new Error('Incomplete 2FA enrollment data received. Please try again or check your Supabase project\'s TOTP MFA configuration.');
        }

        setQrCodeUrl(enrollData.totp.qr_code);
        setSecret(enrollData.totp.secret);
      } catch (err: any) {
        console.error('Error enrolling 2FA:', err);
        setError(err.message || 'Failed to start 2FA enrollment.');
        setShowEnrollmentFlow(false);
        setEnrollmentStep('initial');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleReauthenticateAndDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setReauthError(null);

    if (!reauthPassword || !reauthTotpCode) {
      setReauthError('Please enter both your password and TOTP code.');
      setIsLoading(false);
      return;
    }

    if (!factorId) {
      setReauthError('No 2FA factor found to disable.');
      setIsLoading(false);
      return;
    }

    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) {
        throw challengeError;
      }

      if (!challengeData?.id) {
        throw new Error('Failed to create MFA challenge');
      }

      const { error: reauthError } = await supabase.auth.reauthenticate({
        password: reauthPassword,
        mfa: {
          factorId,
          challengeId: challengeData.id,
          code: reauthTotpCode
        }
      });
      if (reauthError) {
        throw reauthError;
      }

      // Removed the AAL2 check as reauthenticate itself confirms the AAL elevation
      // const { data: currentSessionData, error: getSessionError } = await supabase.auth.getSession();
      // if (getSessionError) {
      //   throw getSessionError;
      // }
      // if (currentSessionData.session?.aal !== 'aal2') {
      //   throw new Error('Failed to achieve AAL2 authentication level after re-authentication. Current AAL: ' + currentSessionData.session?.aal);
      // }

      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
      if (unenrollError) {
        throw unenrollError;
      }

      setTwoFactorEnabled(false);
      setFactorId(null);
      setMessage('Two-factor authentication disabled successfully.');
      setShowEnrollmentFlow(false);
      setEnrollmentStep('initial');
      setShowReauthModal(false);
      setReauthPassword('');
      setReauthTotpCode('');
    } catch (err: any) {
      console.error('Error during re-authentication or disabling 2FA:', err);
      setReauthError(err.message || 'Failed to disable 2FA. Please check your password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    if (!factorId) {
      setError('No 2FA factor to verify.');
      setIsLoading(false);
      return;
    }

    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      if (!challengeData?.id) {
        throw new Error('Failed to create MFA challenge');
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verificationCode,
      });
      if (verifyError) throw verifyError;

      // Only proceed to recovery codes and show success message after successful verification
      setTwoFactorEnabled(true);
      setEnrollmentStep('recovery_codes');
      setVerificationCode('');
      await handleGenerateRecoveryCodes(); // Await this call
    } catch (err: any) {
      console.error('Error verifying 2FA:', err);
      setError(err.message || 'Invalid 2FA code. Please try again.');
      // If verification fails, reset 2FA state to initial
      setTwoFactorEnabled(false);
      setShowEnrollmentFlow(false);
      setEnrollmentStep('initial');
      setFactorId(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateRecoveryCodes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Check if recoveryCodes functionality is available
      if (!supabase.auth.mfa || !supabase.auth.mfa.recoveryCodes) {
        throw new Error('Recovery codes functionality is not available. Please ensure MFA is fully enabled and configured in your Supabase project settings, including recovery codes.');
      }

      const { codes, error: generateError } = await supabase.auth.mfa.recoveryCodes.generate();
      if (generateError) throw generateError;
      
      setRecoveryCodes(codes);
      // Show success message ONLY after recovery codes are generated
      setMessage('Two-factor authentication enabled successfully! Please save these recovery codes in a safe place!');
    } catch (err: any) {
      console.error('Error generating recovery codes:', err);
      setError(err.message || 'Failed to generate recovery codes.');
      // If recovery code generation fails, consider 2FA setup incomplete or problematic
      setTwoFactorEnabled(false);
      setShowEnrollmentFlow(false);
      setEnrollmentStep('initial');
      setFactorId(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyRecoveryCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setMessage('Recovery codes copied to clipboard!');
  };

  const handleSignOutOtherSessions = async () => {
    setIsLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' });
      if (signOutError) {
        throw signOutError;
      }
      setMessage('Successfully signed out of all other sessions.');
    } catch (err: any) {
      console.error('Error signing out other sessions:', err);
      setError(err.message || 'Failed to sign out other sessions.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Change Password */}
      <Card>
        <CardHeader>
          <div className="flex items-center">
            <Key className="h-5 w-5 text-blue-900 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Change Password</h3>
          </div>
        </CardHeader>
        <CardBody>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {/* Current Password Input */}
            <div>
              <label htmlFor="currentPassword" className="sr-only">Current Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="currentPassword"
                  name="currentPassword"
                  type={showPasswords.current ? 'text' : 'password'}
                  required
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Current Password"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('current')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.current ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* New Password Input */}
            <div>
              <label htmlFor="newPassword" className="sr-only">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="newPassword"
                  name="newPassword"
                  type={showPasswords.new ? 'text' : 'password'}
                  required
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="New Password"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('new')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.new ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password Input */}
            <div>
              <label htmlFor="confirmPassword" className="sr-only">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPasswords.confirm ? 'text' : 'password'}
                  required
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Confirm New Password"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('confirm')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.confirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                variant="primary"
                disabled={isLoading || !passwordData.newPassword || !passwordData.confirmPassword}
                icon={<Save className="w-4 h-4" />}
              >
                {isLoading ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {/* Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <div className="flex items-center">
            <Smartphone className="h-5 w-5 text-blue-900 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Two-Factor Authentication</h3>
          </div>
        </CardHeader>
        <CardBody>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
              {error}
            </div>
          )}
          {message && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4">
              {message}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">
                {twoFactorEnabled ? 'Two-factor authentication is enabled' : 'Enable two-factor authentication'}
              </h4>
              <p className="text-sm text-gray-500 mt-1">
                {twoFactorEnabled
                  ? 'Your account is protected with two-factor authentication'
                  : 'Add an extra layer of security to your account'
                }
              </p>
            </div>
            <Button
              variant={twoFactorEnabled ? 'danger' : 'primary'}
              onClick={handleTwoFactorToggle}
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : (twoFactorEnabled ? 'Disable' : 'Enable')}
            </Button>
          </div>

          {showEnrollmentFlow && !twoFactorEnabled && (
            <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-4">
              {enrollmentStep === 'qr_display' && qrCodeUrl && secret && (
                <>
                  <h5 className="text-md font-semibold text-gray-800 flex items-center">
                    <QrCode className="h-5 w-5 mr-2" /> Step 1: Scan QR Code
                  </h5>
                  <p className="text-sm text-gray-600">
                    Scan the QR code below with your authenticator app (e.g., Google Authenticator, Authy).
                    Alternatively, you can manually enter the secret key.
                  </p>
                  <div className="flex flex-col items-center justify-center p-4 bg-white rounded-md border border-gray-200">
                    <img src={qrCodeUrl} alt="QR Code" className="w-32 h-32 mb-2" />
                    <p className="text-xs font-mono text-gray-700 break-all">Secret: {secret}</p>
                  </div>
                  <Button
                    variant="primary"
                    onClick={() => setEnrollmentStep('verify_code')}
                    disabled={isLoading}
                    className="w-full"
                  >
                    Next: Verify Code
                  </Button>
                </>
              )}

              {enrollmentStep === 'verify_code' && (
                <form onSubmit={handleVerify2FA} className="space-y-4">
                  <h5 className="text-md font-semibold text-gray-800 flex items-center">
                    <CheckCircle className="h-5 w-5 mr-2" /> Step 2: Verify Code
                  </h5>
                  <p className="text-sm text-gray-600">
                    Enter the 6-digit code from your authenticator app to complete setup.
                  </p>
                  <div>
                    <label htmlFor="verificationCode" className="sr-only">Verification Code</label>
                    <input
                      type="text"
                      id="verificationCode"
                      name="verificationCode"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      maxLength={6}
                      pattern="\d{6}"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-center text-lg tracking-widest focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="------"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isLoading || verificationCode.length !== 6}
                    className="w-full"
                  >
                    {isLoading ? 'Verifying...' : 'Verify and Enable 2FA'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEnrollmentStep('qr_display')}
                    disabled={isLoading}
                    className="w-full"
                  >
                    Back to QR Code
                  </Button>
                </form>
              )}

              {enrollmentStep === 'recovery_codes' && recoveryCodes.length > 0 && (
                <div className="space-y-4">
                  <h5 className="text-md font-semibold text-gray-800 flex items-center">
                    <Key className="h-5 w-5 mr-2" /> Step 3: Recovery Codes
                  </h5>
                  <p className="text-sm text-gray-600">
                    These are one-time use codes to access your account if you lose your authenticator device.
                    **Save them in a safe place!** They will not be shown again.
                  </p>
                  <div className="bg-white p-4 rounded-md border border-gray-200 font-mono text-sm space-y-1">
                    {recoveryCodes.map((code, index) => (
                      <div key={index}>{code}</div>
                    ))}
                  </div>
                  <Button
                    variant="secondary"
                    onClick={handleCopyRecoveryCodes}
                    icon={<Copy className="h-4 w-4" />}
                    className="w-full"
                  >
                    Copy Codes
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => setShowEnrollmentFlow(false)}
                    className="w-full"
                  >
                    Done
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <div className="flex items-center">
            <Shield className="h-5 w-5 text-blue-900 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Active Sessions</h3>
          </div>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Current Session</h4>
                <p className="text-xs text-gray-500">Chrome on Windows • London, UK</p>
                <p className="text-xs text-gray-500">Last active: Now</p>
              </div>
              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                Current
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Mobile Session</h4>
                <p className="text-xs text-gray-500">Safari on iPhone • London, UK</p>
                <p className="text-xs text-gray-500">Last active: 2 hours ago</p>
              </div>
              <Button variant="outline" size="sm">
                Revoke
              </Button>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <Button
                variant="danger"
                size="sm"
                onClick={handleSignOutOtherSessions}
                disabled={isLoading}
              >
                Sign Out All Other Sessions
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Re-authentication Modal */}
      <Modal
        isOpen={showReauthModal}
        onClose={() => {
          setShowReauthModal(false);
          setReauthPassword('');
          setReauthTotpCode('');
          setReauthError(null);
          setIsLoading(false);
        }}
        title="Confirm Password to Disable 2FA"
      >
        <form onSubmit={handleReauthenticateAndDisable2FA} className="space-y-4">
          <p className="text-sm text-gray-700">
            Please enter your current password and a TOTP code from your authenticator app to confirm your identity before disabling two-factor authentication.
          </p>
          <div>
            <label htmlFor="reauthPassword" className="sr-only">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                id="reauthPassword"
                name="reauthPassword"
                type="password"
                required
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Your Password"
                value={reauthPassword}
                onChange={(e) => setReauthPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
          <div>
            <label htmlFor="reauthTotpCode" className="sr-only">TOTP Code</label>
            <div className="relative">
              <Smartphone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                id="reauthTotpCode"
                name="reauthTotpCode"
                type="text"
                required
                maxLength={6}
                pattern="\d{6}"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-center tracking-widest"
                placeholder="------"
                value={reauthTotpCode}
                onChange={(e) => setReauthTotpCode(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
          {reauthError && (
            <p className="text-sm text-red-600 text-center">{reauthError}</p>
          )}
          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowReauthModal(false);
                setReauthPassword('');
                setReauthTotpCode('');
                setReauthError(null);
                setIsLoading(false);
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading || !reauthPassword || !reauthTotpCode || reauthTotpCode.length !== 6}
            >
              {isLoading ? 'Confirming...' : 'Confirm'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SecuritySettings;