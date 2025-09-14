import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next'; // ADDED

const AcceptInvitationPage: React.FC = () => {
  console.log('AcceptInvitationPage: Component rendered. Current URL:', window.location.href);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation(); // ADDED

  useEffect(() => {
    const invitationToken = searchParams.get('token');
    console.log('AcceptInvitationPage: invitationToken from searchParams:', invitationToken);

    if (invitationToken) {
      // Redirect to the signup page, passing the invitation token as a query parameter
      console.log('AcceptInvitationPage: Redirecting to signup page with invitation token.');
      navigate(`/signup?invitation_token=${encodeURIComponent(invitationToken)}`, { replace: true });
    } else {
      // If no token, redirect to home or show an error (for robustness)
      console.log('AcceptInvitationPage: No invitation token found. Redirecting to home.');
      navigate('/', { replace: true });
    }
  }, [searchParams, navigate]); // Depend on searchParams and navigate

  // This page should ideally not render much, as it immediately redirects
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="text-center">
        <p className="text-gray-600">{t('redirecting_to_signup')}...</p> {/* MODIFIED */}
      </div>
    </div>
  );
};

export default AcceptInvitationPage;