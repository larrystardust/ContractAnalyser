import React, { useState, useEffect } from 'react';
import { Shield, Key, Smartphone, Eye, EyeOff, Save, QrCode, CheckCircle, XCircle, Copy, Lock } from 'lucide-react';
import Button from '../ui/Button';
import Card, { CardBody, CardHeader } from '../ui/Card';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import Modal from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const SecuritySettings: React.FC = () => {
  const supabase = useSupabaseClient();
  const session = useSession();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const { t } = useTranslation();

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

  // Re-authentication states for disabling 2FA
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthTotpCode, setReauthTotpCode] = useState('');
  const [reauthError, setReauthError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null); // Moved factorId state here

  useEffect(() => {
    const fetch2FAStatus = async () => {
      if (!session?.user) return;
      setIsLoading(true);
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
        addToast(err.message || t('failed_to_fetch_2fa_status'), 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetch2FAStatus();
  }, [session?.user, supabase, addToast, t]);

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

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      addToast(t('new_passwords_do_not_match'), 'error');
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

      addToast(t('password_updated_successfully'), 'success');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      console.error('Error updating password:', err);
      addToast(err.message || t('failed_to_update_password'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTwoFactorToggle = async () => {
    setIsLoading(true);

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
          throw new Error(t('failed_to_enroll_2fa_factor'));
        }

        setFactorId(enrollData.id);

        if (!enrollData.totp) {
          throw new Error(t('failed_to_generate_2fa_enrollment_data'));
        }

        if (!enrollData.totp.qr_code || !enrollData.totp.secret) {
          throw new Error(t('incomplete_2fa_enrollment_data_received'));
        }

        setQrCodeUrl(enrollData.totp.qr_code);
        setSecret(enrollData.totp.secret);
      } catch (err: any) {
        console.error('Error enrolling 2FA:', err);
        // MODIFIED: Check for specific error message
        if (err.message === "Maximum number of verified factors reached, unenroll to continue") {
          addToast(t('too_many_enrolled_mfa_factors_error'), 'error');
        } else {
          addToast(err.message || t('failed_to_start_2fa_enrollment'), 'error');
        }
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
      setReauthError(t('please_enter_password_and_totp_code'));
      setIsLoading(false);
      return;
    }

    if (!factorId) {
      setReauthError(t('no_2fa_factor_to_disable'));
      setIsLoading(false);
      return;
    }

    try {
      const { error: passwordReauthError } = await supabase.auth.reauthenticate({
        password: reauthPassword,
      });
      if (passwordReauthError) {
        throw passwordReauthError;
      }

      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) {
        throw challengeError;
      }
      if (!challengeData?.id) {
        throw new Error(t('failed_to_create_mfa_challenge_for_totp'));
      }

      const { error: verifyTotpError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: reauthTotpCode,
      });
      if (verifyTotpError) {
        throw verifyTotpError;
      }

      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
      if (unenrollError) {
        throw unenrollError;
      }

      setTwoFactorEnabled(false);
      setFactorId(null);
      addToast(t('two_factor_authentication_disabled_successfully'), 'success');
      setShowEnrollmentFlow(false);
      setEnrollmentStep('initial');
      setShowReauthModal(false);
      setReauthPassword('');
      setReauthTotpCode('');
    } catch (err: any) {
      console.error('Error during 2FA disable process:', err);
      setReauthError(err.message || t('failed_to_disable_2fa'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!factorId) {
      addToast(t('no_2fa_factor_to_verify'), 'error');
      setIsLoading(false);
      return;
    }

    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      if (!challengeData?.id) {
        throw new Error(t('failed_to_create_mfa_challenge'));
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verificationCode,
      });
      if (verifyError) throw verifyError;

      setTwoFactorEnabled(true);
      localStorage.setItem('mfa_passed', 'true');
      addToast(t('two_factor_authentication_enabled_successfully'), 'success');
      setShowEnrollmentFlow(false);
      setEnrollmentStep('initial');
      setVerificationCode('');
      navigate('/dashboard', { replace: true });

    } catch (err: any) {
      console.error('Error verifying 2FA:', err);
      addToast(err.message || t('invalid_2fa_code'), 'error');
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
    try {
      if (!supabase.auth.mfa || !supabase.auth.mfa.recoveryCodes) {
        throw new Error(t('recovery_codes_functionality_not_available'));
      }

      const { codes, error: generateError } = await supabase.auth.mfa.recoveryCodes.generate();
      if (generateError) throw generateError;
      
      setRecoveryCodes(codes);
      addToast(t('two_factor_authentication_enabled_successfully_save_codes'), 'success', 10000);
    } catch (err: any) {
      console.error('Error generating recovery codes:', err);
      addToast(err.message || t('failed_to_generate_recovery_codes'), 'error');
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
    addToast(t('recovery_codes_copied_to_clipboard'), 'info');
  };

  const handleSignOutOtherSessions = async () => {
    setIsLoading(true);
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' });
      if (signOutError) {
        throw signOutError;
      }
      addToast(t('successfully_signed_out_of_all_other_sessions'), 'success');
    } catch (err: any) {
      console.error('Error signing out other sessions:', err);
      addToast(err.message || t('failed_to_sign_out_other_sessions'), 'error');
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
            <h3 className="text-lg font-medium text-gray-900">{t('change_password')}</h3>
          </div>
        </CardHeader>
        <CardBody>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {/* Current Password Input */}
            <div>
              <label htmlFor="currentPassword" className="sr-only">{t('current_password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="currentPassword"
                  name="currentPassword"
                  type={showPasswords.current ? 'text' : 'password'}
                  required
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder={t('current_password')} 
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
              <label htmlFor="newPassword" className="sr-only">{t('new_password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="newPassword"
                  name="newPassword"
                  type={showPasswords.new ? 'text' : 'password'}
                  required
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder={t('new_password')} 
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
              <label htmlFor="confirmPassword" className="sr-only">{t('confirm_password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPasswords.confirm ? 'text' : 'password'}
                  required
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder={t('confirm_password')} 
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
                {isLoading ? t('updating') : t('update_password')}
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
            <h3 className="text-lg font-medium text-gray-900">{t('two_factor_authentication')}</h3>
          </div>
        </CardHeader>
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">
                {twoFactorEnabled ? t('account_protected') : t('enable_two_factor_authentication')}
              </h4>
              <p className="text-sm text-gray-500 mt-1">
                {twoFactorEnabled
                  ? t('account_protected_description')
                  : t('add_extra_security')
                }
              </p>
            </div>
            <Button
              variant={twoFactorEnabled ? 'danger' : 'primary'}
              onClick={handleTwoFactorToggle}
              disabled={isLoading}
            >
              {isLoading ? t('processing') : (twoFactorEnabled ? t('disable') : t('enable'))}
            </Button>
          </div>

          {showEnrollmentFlow && !twoFactorEnabled && (
            <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-4">
              {enrollmentStep === 'qr_display' && qrCodeUrl && secret && (
                <>
                  <h5 className="text-md font-semibold text-gray-800 flex items-center">
                    <QrCode className="h-5 w-5 mr-2" /> {t('step_1_scan_qr')}
                  </h5>
                  <p className="text-sm text-gray-600">
                    {t('scan_qr_desc')}
                  </p>
                  <div className="flex flex-col items-center justify-center p-4 bg-white rounded-md border border-gray-200">
                    <img src={qrCodeUrl} alt={t('qr_code_alt_text')} className="w-32 h-32 mb-2" />
                    <p className="text-xs font-mono text-gray-700 break-all">{t('secret')}: {secret}</p>
                  </div>
                  <Button
                    variant="primary"
                    onClick={() => setEnrollmentStep('verify_code')}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {t('next_verify_code')}
                  </Button>
                </>
              )}

              {enrollmentStep === 'verify_code' && (
                <form onSubmit={handleVerify2FA} className="space-y-4">
                  <h5 className="text-md font-semibold text-gray-800 flex items-center">
                    <CheckCircle className="h-5 w-5 mr-2" /> {t('step_2_verify_code')}
                  </h5>
                  <p className="text-sm text-gray-600">
                    {t('enter_6_digit_code_app')}
                  </p>
                  <div>
                    <label htmlFor="verificationCode" className="sr-only">{t('verification_code')}</label>
                    <input
                      id="verificationCode"
                      name="verificationCode"
                      type="text"
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
                    {isLoading ? t('verifying') : t('verify_enable_2fa')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEnrollmentStep('qr_display')}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {t('back_to_qr_code')}
                  </Button>
                </form>
              )}

              {enrollmentStep === 'recovery_codes' && recoveryCodes.length > 0 && (
                <div className="space-y-4">
                  <h5 className="text-md font-semibold text-gray-800 flex items-center">
                    <Key className="h-5 w-5 mr-2" /> {t('step_3_recovery_codes')}
                  </h5>
                  <p className="text-sm text-gray-600">
                    {t('recovery_codes_desc')}
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
                    {t('copy_codes')}
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => setShowEnrollmentFlow(false)}
                    className="w-full"
                  >
                    {t('done')}
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
            <h3 className="text-lg font-medium text-gray-900">{t('active_sessions')}</h3>
          </div>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
              <div>
                <h4 className="text-sm font-medium text-gray-900">{t('current_session')}</h4>
                <p className="text-xs text-gray-500">{t('current_session_details')}</p>
                <p className="text-xs text-gray-500">{t('last_active_now')}</p>
              </div>
              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                {t('current')}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <h4 className="text-sm font-medium text-gray-900">{t('mobile_session')}</h4>
                <p className="text-xs text-gray-500">{t('mobile_session_details')}</p>
                <p className="text-xs text-gray-500">{t('last_active_2_hours_ago')}</p>
              </div>
              <Button variant="outline" size="sm">
                {t('revoke')}
              </Button>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <Button
                variant="danger"
                size="sm"
                onClick={handleSignOutOtherSessions}
                disabled={isLoading}
              >
                {t('sign_out_other_sessions')}
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
        title={t('confirm_password_to_disable_2fa_modal')} 
      >
        <form onSubmit={handleReauthenticateAndDisable2FA} className="space-y-4">
          <p className="text-sm text-gray-700">
            {t('enter_password_totp_to_confirm_modal')}
          </p>
          <div>
            <label htmlFor="reauthPassword" className="sr-only">{t('password')}</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                id="reauthPassword"
                name="reauthPassword"
                type="password"
                required
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder={t('your_password_modal')} 
                value={reauthPassword}
                onChange={(e) => setReauthPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
          <div>
            <label htmlFor="reauthTotpCode" className="sr-only">{t('totp_code')}</label>
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
              {t('cancel_modal')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading || !reauthPassword || !reauthTotpCode || reauthTotpCode.length !== 6}
            >
              {isLoading ? t('confirming') : t('confirm_modal')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SecuritySettings;