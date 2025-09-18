import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import Button from '../components/ui/Button';
import Card, { CardBody, CardHeader } from '../components/ui/Card';
import { Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next'; // ADDED

const EmailSentPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const supabase = useSupabaseClient();
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [redirectParam, setRedirectParam] = useState<string | null>(null);
  const { t } = useTranslation(); // ADDED

  useEffect(() => {
    // Attempt to retrieve the email from local storage
    const emailFromStorage = localStorage.getItem('signup_email');
    if (emailFromStorage) {
      setUserEmail(emailFromStorage);
    } else {
      // If no email found, maybe redirect to signup or show a different message
      // For now, we'll just set a generic message
      setUserEmail(t('your_email_address')); // MODIFIED
    }

    // ADDED: Retrieve redirect parameter from URL
    const param = searchParams.get('redirect');
    if (param) {
      setRedirectParam(param);
    }
  }, [searchParams, t]); // MODIFIED: Added t to dependency array

  const handleResendEmail = async () => {
    setLoading(true);
    setResendError(null);
    setResendMessage(null);

    if (!userEmail || userEmail === t('your_email_address')) { // MODIFIED
      setResendError(t('go_back_signup_valid_email')); // MODIFIED
      setLoading(false);
      return;
    }

    try {
      let emailRedirectToUrl = `${import.meta.env.VITE_APP_BASE_URL}/auth/callback`;
      // ADDED: If a redirect parameter exists, append it to the emailRedirectTo URL
      if (redirectParam) {
        emailRedirectToUrl += `?redirect=${encodeURIComponent(redirectParam)}`;
      }

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: userEmail,
        options: {
          emailRedirectTo: emailRedirectToUrl,
        }
      });

      if (error) {
        throw error;
      }

      setResendMessage(t('another_email_sent')); // MODIFIED
    } catch (err: any) {
      console.error('Error resending confirmation email:', err);
      setResendError(err.message || t('failed_to_resend_email')); // MODIFIED
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    // Clear any signup-related local storage items before navigating
    localStorage.removeItem('signup_email');
    localStorage.removeItem('signup_full_name');
    localStorage.removeItem('signup_mobile_phone_number');
    localStorage.removeItem('signup_country_code');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <Mail className="h-12 w-12 text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('email_sent_page_title')}</h2> {/* MODIFIED */}
          <p className="mt-2 text-sm text-gray-600">
            <Trans 
              i18nKey="email_sent_message" 
              values={{ userEmail }}
              components={{
                highlight: <span className="font-medium text-blue-600" />
              }}
            />
          </p>
        </CardHeader>
        <CardBody>
          {resendMessage && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4 flex items-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              <span>{resendMessage}</span>
            </div>
          )}
          {resendError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span>{resendError}</span>
            </div>
          )}

          <div className="space-y-4">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={handleResendEmail}
              disabled={loading}
            >
              {loading ? t('sending_email') : t('resend_confirmation_email')} {/* MODIFIED */}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              onClick={handleBackToLogin}
              disabled={loading}
            >
              {t('back_to_login_button')} {/* MODIFIED */}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default EmailSentPage;
