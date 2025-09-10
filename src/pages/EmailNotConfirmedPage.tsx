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

  useEffect(() => {
    if (session?.user?.email) {
      setUserEmail(session.user.email);
    } else {
      // If no session or email, redirect to login
      navigate('/login', { replace: true });
    }
  }, [session, navigate]);

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

  if (!userEmail) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <Mail className="h-12 w-12 text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Not Confirmed</h2>
          <p className="mt-2 text-sm text-gray-600">
            Your email address <span className="font-medium text-blue-600">{userEmail}</span> has not been confirmed.
            Please check your inbox for a confirmation link.
          </p>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
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