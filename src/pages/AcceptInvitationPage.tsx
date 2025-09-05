import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useSession } from '@supabase/auth-helpers-react';
import Button from '../components/ui/Button';
import Card, { CardBody } from '../components/ui/Card';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

const AcceptInvitationPage: React.FC = () => {
  console.log('AcceptInvitationPage: Component rendered. Current URL:', window.location.href);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const session = useSession(); // Keep session for conditional rendering/redirection logic

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const invitationToken = searchParams.get('token');
    console.log('AcceptInvitationPage: invitationToken from searchParams:', invitationToken);

    if (!invitationToken) {
      setStatus('error');
      setMessage('No invitation token found in the URL. Please ensure you are using the full invitation link.');
      return;
    }

    // MODIFIED: Redirect to AuthCallbackPage to centralize invitation processing
    // This ensures that authentication and invitation acceptance happen in one place.
    const redirectToAuthCallback = () => {
      const appBaseUrl = import.meta.env.VITE_APP_BASE_URL;
      if (!appBaseUrl) {
        console.error('VITE_APP_BASE_URL is not defined. Cannot construct redirect URL.');
        setStatus('error');
        setMessage('Application base URL is not configured. Please contact support.');
        return;
      }
      // Construct the URL for AuthCallbackPage, passing the current path and query as a redirect_to hash parameter
      const currentPathAndQuery = window.location.pathname + window.location.search;
      const authCallbackUrl = `${appBaseUrl}/auth/callback#redirect_to=${encodeURIComponent(currentPathAndQuery)}`;
      console.log('AcceptInvitationPage: Attempting to redirect to AuthCallbackPage:', authCallbackUrl);
      window.location.href = authCallbackUrl; // Perform full page reload/redirect
    };

    // Use a small timeout to ensure the component has rendered before attempting the redirect.
    // This can sometimes help with race conditions or browser rendering quirks.
    const redirectTimer = setTimeout(() => {
      redirectToAuthCallback();
    }, 100); // 100ms delay

    // Cleanup the timer if the component unmounts before the redirect
    return () => clearTimeout(redirectTimer);

  }, [searchParams]); // Only re-run if searchParams change, as session changes are handled by AuthCallbackPage

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <>
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Processing Invitation...</h2>
            <p className="text-gray-600">{message}</p>
          </>
        );
      case 'success': // This state should ideally not be reached directly anymore, as AuthCallbackPage redirects
        return (
          <>
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Success!</h2>
            <p className="text-gray-600 mb-6">{message}</p>
          </>
        );
      case 'error':
        return (
          <>
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Error!</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            {/* Provide options to go home or sign up/login if not authenticated */}
            {!session && ( // Use the session from useSession hook
              <Link to="/signup">
                <Button variant="primary" size="lg" className="w-full mb-4">
                  Sign Up / Log In
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