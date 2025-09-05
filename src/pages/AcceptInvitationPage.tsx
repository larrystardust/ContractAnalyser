import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import Button from '../components/ui/Button';
import Card, { CardBody } from '../components/ui/Card';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

const AcceptInvitationPage: React.FC = () => {
  console.log('AcceptInvitationPage: Component rendered. Current URL:', window.location.href); // ADDED LOG
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const supabase = useSupabaseClient();
  const session = useSession();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const invitationToken = searchParams.get('token');
    console.log('AcceptInvitationPage: invitationToken from searchParams:', invitationToken); // ADDED LOG

    const handleAcceptInvitation = async () => {
      if (!invitationToken) {
        setStatus('error');
        setMessage('No invitation token found in the URL.');
        return;
      }

      if (!session) {
        // If user is not logged in, redirect to signup with a message
        const redirectUrl = `/signup?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        console.log('AcceptInvitationPage: User not logged in. Redirecting to:', redirectUrl); // ADDED LOG
        navigate(redirectUrl);
        setMessage('Please sign up or log in to accept the invitation.');
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('accept-invitation', {
          body: { invitation_token: invitationToken },
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (error) {
          throw error;
        }

        setStatus('success');
        setMessage(data.message || 'Invitation accepted successfully!');
        // MODIFIED: Automatically navigate to dashboard on success
        navigate('/dashboard', { replace: true });
      } catch (err: any) {
        console.error('Error accepting invitation:', err);
        setStatus('error');
        setMessage(err.message || 'Failed to accept invitation. Please try again.');
      }
    };

    handleAcceptInvitation();
  }, [searchParams, session, navigate, supabase]);

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <>
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Accepting Invitation...</h2>
            <p className="text-gray-600">Please wait while we process your invitation.</p>
          </>
        );
      case 'success':
        return (
          <>
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Success!</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            {/* Removed the "Go to Dashboard" button as it's now automatic */}
          </>
        );
      case 'error':
        return (
          <>
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Error!</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            {!session && (
              <Link to="/signup">
                <Button variant="primary" size="lg" className="w-full mb-4">
                  Sign Up
                </Button>
              </Link>
            )}
            <Link to="/">
              <Button variant="outline" size="lg" className="w-full">
                Return to Home
              </Button>
            </Link>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <Card className="max-w-md w-full">
        <CardBody className="text-center">
          {renderContent()}
        </CardBody>
      </Card>
    </div>
  );
};

export default AcceptInvitationPage;