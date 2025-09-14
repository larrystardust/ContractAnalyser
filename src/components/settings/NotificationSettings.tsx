import React, { useState, useEffect } from 'react';
import { Bell, Mail, Smartphone } from 'lucide-react';
import Button from '../ui/Button';
import Card, { CardBody, CardHeader } from '../ui/Card';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { Database } from '../../types/supabase';
import { useTranslation } from 'react-i18next'; // ADDED

// Define the structure for the default settings (including display info)
const notificationTypes = {
  'analysis-complete': {
    title: 'Analysis Complete',
    description: 'Get notified when contract analysis is finished',
    defaultEmail: true,
    defaultInApp: true
  },
  'high-risk-findings': {
    title: 'High Risk Findings',
    description: 'Immediate alerts for high-risk compliance issues',
    defaultEmail: true,
    defaultInApp: true
  },
  'weekly-reports': {
    title: 'Weekly Reports',
    description: 'Summary of all contract analyses from the past week',
    defaultEmail: false,
    defaultInApp: false
  },
  'system-updates': {
    title: 'System Updates',
    description: 'Information about new features and system maintenance',
    defaultEmail: false,
    defaultInApp: true
  },
};

const NotificationSettings: React.FC = () => {
  const supabase = useSupabaseClient<Database>();
  const session = useSession();
  const { t } = useTranslation(); // ADDED

  // State to hold the actual user preferences (only email/inApp status)
  const [preferences, setPreferences] = useState<Record<string, { email: boolean; inApp: boolean }>>(() => {
    const initialPrefs: Record<string, { email: boolean; inApp: boolean }> = {};
    for (const key in notificationTypes) {
      initialPrefs[key] = {
        email: notificationTypes[key as keyof typeof notificationTypes].defaultEmail,
        inApp: notificationTypes[key as keyof typeof notificationTypes].defaultInApp,
      };
    }
    return initialPrefs;
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchNotificationPreferences = async () => {
      if (!session?.user?.id) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('notification_settings')
          .eq('id', session.user.id)
          .maybeSingle();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means no rows found
          throw fetchError;
        }

        if (data?.notification_settings) {
          const fetchedSettings = data.notification_settings as Record<string, { email: boolean; inApp: boolean }>;
          // Merge fetched settings with defaults to ensure all types are present
          setPreferences(prev => {
            const merged = { ...prev }; // Start with current defaults
            for (const key in notificationTypes) {
              if (fetchedSettings[key]) {
                merged[key] = fetchedSettings[key];
              }
            }
            return merged;
          });
        }
      } catch (err: any) {
        console.error('Error fetching notification preferences:', err);
        setError(err.message || t('failed_to_load_notification_preferences')); // MODIFIED
      } finally {
        setIsLoading(false);
      }
    };
    fetchNotificationPreferences();
  }, [session?.user?.id, supabase, t]); // MODIFIED: Added t to dependency array

  const updatePreference = (id: string, type: 'email' | 'inApp', value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [type]: value,
      },
    }));
  };

  const handleSavePreferences = async () => {
    if (!session?.user?.id) {
      setError(t('must_be_logged_in_to_save_preferences')); // MODIFIED
      return;
    }
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: session.user.id,
            notification_settings: preferences, // Directly save the preferences object
          },
          { onConflict: 'id' }
        );

      if (updateError) {
        throw updateError;
      }
      setMessage(t('notification_preferences_saved_successfully')); // MODIFIED
    } catch (err: any) {
      console.error('Error saving notification preferences:', err);
      setError(err.message || t('failed_to_save_notification_preferences')); // MODIFIED
    } finally {
      setIsSaving(false);
    }
  };

  const ToggleSwitch: React.FC<{
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
  }> = ({ checked, onChange, disabled = false }) => (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        checked ? 'bg-blue-600' : 'bg-gray-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      disabled={disabled}
    >
      <span
        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );

  if (isLoading) {
    return (
      <Card>
        <CardBody className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900 mx-auto"></div>
          <p className="text-gray-500 mt-2">{t('loading_notification_preferences')}...</p> {/* MODIFIED */}
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center">
            <Bell className="h-5 w-5 text-blue-900 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">{t('notification_preferences')}</h3> {/* MODIFIED */}
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
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4 pb-4 border-b border-gray-200">
              <div className="text-sm font-medium text-gray-700">{t('notification_type')}</div> {/* MODIFIED */}
              <div className="text-sm font-medium text-gray-700 flex items-center justify-center">
                <Mail className="h-4 w-4 mr-1" />
                {t('email')} {/* MODIFIED */}
              </div>
              <div className="text-sm font-medium text-gray-700 flex items-center justify-center">
                <Smartphone className="h-4 w-4 mr-1" />
                {t('in_app')} {/* MODIFIED */}
              </div>
            </div>

            {Object.entries(preferences).map(([id, pref]) => {
              const typeInfo = notificationTypes[id as keyof typeof notificationTypes];
              if (!typeInfo) return null; // Should not happen if notificationTypes is comprehensive

              return (
                <div key={id} className="grid grid-cols-3 gap-4 items-center py-3">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">{t(typeInfo.title.toLowerCase().replace(/\s/g, '_'))}</h4> {/* MODIFIED */}
                    <p className="text-xs text-gray-500 mt-1">{t(typeInfo.description.toLowerCase().replace(/\s/g, '_'))}</p> {/* MODIFIED */}
                  </div>
                  <div className="flex justify-center">
                    <ToggleSwitch
                      checked={pref.email}
                      onChange={(checked) => updatePreference(id, 'email', checked)}
                    />
                  </div>
                  <div className="flex justify-center">
                    <ToggleSwitch
                      checked={pref.inApp}
                      onChange={(checked) => updatePreference(id, 'inApp', checked)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex justify-end">
            <Button
              variant="primary"
              onClick={handleSavePreferences}
              disabled={isSaving}
            >
              {isSaving ? t('saving') : t('save_notification_settings')} {/* MODIFIED */}
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            {t('note_email_reports_setting')} {/* MODIFIED */}
          </p>
        </CardBody>
      </Card>
    </div>
  );
};

export default NotificationSettings;