import React, { useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useTranslation } from 'react-i18next';

const MobileCameraRedirect: React.FC = () => {
  const supabase = useSupabaseClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();

  useEffect(() => {
    const handleRedirect = async () => {
      const hashParams = new URLSearchParams(location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const error = hashParams.get('error');
      const errorDescription = hashParams.get('error_description');

      const scanSessionId = searchParams.get('scanSessionId');
      const authToken = searchParams.get('auth_token');

      if (error) {
        console.error('MobileCameraRedirect: Error from Supabase redirect:', error, errorDescription);
        // In case of error, still redirect to upload page, maybe with an error toast
        navigate('/upload', { replace: true, state: { error: errorDescription || t('mobile_redirect_authentication_failed') } });
        return;
      }

      if (accessToken && refreshToken) {
        try {
          // Set the session on the mobile device
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (setSessionError) throw setSessionError;

          // Redirect to the MobileCameraApp with original scan session details
          if (scanSessionId && authToken) {
            navigate(`/mobile-camera?scanSessionId=${scanSessionId}&auth_token=${authToken}`, { replace: true });
          } else {
            // Fallback if scanSessionId or authToken are missing (shouldn't happen if flow is correct)
            navigate('/upload', { replace: true, state: { error: t('mobile_redirect_missing_session_details') } });
          }

        } catch (err: any) {
          console.error('MobileCameraRedirect: Error setting session:', err);
          navigate('/upload', { replace: true, state: { error: err.message || t('mobile_redirect_failed_to_set_session') } });
        }
      } else {
        navigate('/upload', { replace: true, state: { error: t('mobile_redirect_no_tokens_found') } });
      }
    };

    handleRedirect();
  }, [location.hash, navigate, supabase.auth, searchParams, t]);

  // Render nothing visible to ensure a seamless transition
  return null;
};

export default MobileCameraRedirect;