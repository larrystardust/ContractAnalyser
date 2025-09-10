import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import Card, { CardBody, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Mail, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const EmailNotConfirmedPage: React.FC = () => {
  const supabase = useSupabaseClient();
  const session = useSession();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loadingResend, setLoadingResend] = useState(false);
  const [isEmailVerifiedByAdmin, setIsEmailVerifiedByAdmin] = useState<boolean | null>(null); // ADDED: State for admin verification status

  useEffect(() => {
    const fetchVerificationStatus = async () => {
      if (session?.user?.id) {
        setUserEmail(session.user.email);
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('is_email_verified_by_admin')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profileError) {
            console.error('Error fetching is_email_verified_by_admin in EmailNotConfirmedPage:', profileError);
            setIsEmailVerifiedByAdmin(false);
          } else {
            setIsEmailVerifiedByAdmin(profileData?.is_email_verified_by_admin ?? false);
          }
        } catch (err) {
          console.error('Unexpected error fetching profile in EmailNotConfirmedPage:', err);
          setIsEmailVerifiedByAdmin(false);
        }
      } else {
        navigate('/login', { replace: true });
      }
    };

    fetchVerificationStatus();
  }, [session, navigate, supabase]);

  const handleResendEmail = async () => {
    if (!userEmail) {
      addToast('No email address found to resend confirmation.', 'error');
      return;
    }

    setLoadingResend(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: userEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }
      addToast('Confirmation email sent! Please check your inbox.', 'success');
    } catch (err: any) {
      console.error('Error resending confirmation email:', err);
      addToast(err.message || 'Failed to resend confirmation email.', 'error');
    } finally {
      setLoadingResend(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  if (!userEmail || isEmailVerifiedByAdmin === null) { // MODIFIED: Wait for admin verification status
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  const isSelfRegisteredUnconfirmed = !session?.user?.email_confirmed_at && isEmailVerifiedByAdmin === true; // User is self-registered but hasn't confirmed via link
  const isAdminCreatedUnconfirmed = isEmailVerifiedByAdmin === false; // User is admin-created and not yet verified by admin

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <Mail className="h-12 w-12 text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Not Confirmed</h2>
          <p className="mt-2 text-sm text-gray-600">
            Your email address <span className="font-medium text-blue-600">{userEmail}</span> is not yet confirmed.
          </p>
        </CardHeader>
        <CardBody>
          {isSelfRegisteredUnconfirmed && (
            <p className="text-gray-700 mb-4">
              Please check your inbox for a confirmation link. If you haven't received it, you can request another one below.
            </p>
          )}
          {isAdminCreatedUnconfirmed && (
            <p className="text-gray-700 mb-4">
              Your account requires administrator verification. Please contact your administrator to gain full access.
            </p>
          )}

          <div className="space-y-4">
            {isSelfRegisteredUnconfirmed && (
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleResendEmail}
                disabled={loadingResend}
                icon={loadingResend ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}
              >
                {loadingResend ? 'Sending...' : 'Resend Confirmation Email'}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              onClick={handleLogout}
              disabled={loadingResend}
            >
              Logout
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default EmailNotConfirmedPage;