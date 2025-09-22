import React, { useState, useEffect } from 'react';
import { Settings, Globe, Palette, FileText } from 'lucide-react';
import Button from '../ui/Button';
import Card, { CardBody, CardHeader } from '../ui/Card';
import { getAllJurisdictions, getJurisdictionLabel } from '../../utils/jurisdictionUtils';
import { JurisdictionBadge } from '../ui/Badge';
import { Jurisdiction } from '../../types';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { Database } from '../../types/supabase';
import { useTranslation } from 'react-i18next';

// Define the structure for the default settings (including display info)
const notificationTypes = {
  'analysis-complete': {
    titleKey: 'analysis_complete',
    descriptionKey: 'get_notified_when_contract_analysis_is_finished',
    defaultEmail: true,
    defaultInApp: true
  },
  'high-risk-findings': {
    titleKey: 'high_risk_findings',
    descriptionKey: 'immediate_alerts_for_high-risk_compliance_issues',
    defaultEmail: true,
    defaultInApp: true
  },
  'weekly-reports': {
    titleKey: 'weekly_reports',
    descriptionKey: 'summary_of_all_contract_analyses_from_the_past_week',
    defaultEmail: false,
    defaultInApp: false
  },
  'system-updates': {
    titleKey: 'system_updates',
    descriptionKey: 'information_about_new_features_and_system_maintenance',
    defaultEmail: false,
    defaultInApp: true
  },
};

const ApplicationPreferences: React.FC = () => {
  const supabase = useSupabaseClient<Database>();
  const session = useSession();
  const { t, i18n } = useTranslation();

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

  // Restore this useEffect hook
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
          .select('notification_settings, language_preference') // ADDED: Select language_preference
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

        // ADDED: Set language preference from fetched data
        if (data?.language_preference && i18n.language !== data.language_preference) {
          i18n.changeLanguage(data.language_preference);
        }

      } catch (err: any) {
        console.error('Error fetching notification preferences:', err);
        setError(err.message || t('failed_to_load_notification_preferences'));
      } finally {
        setIsLoading(false);
      }
    };
    fetchNotificationPreferences();
  }, [session?.user?.id, supabase, t, i18n]); // ADDED: i18n to dependencies

  // Keep the minimal render for now
  return (
    <div style={{ border: '2px solid red', padding: '20px', margin: '20px', backgroundColor: 'lightyellow', color: 'black' }}>
      <h1>{t('preferences_test_title')}</h1>
      <p>{t('preferences_test_description')}</p>
      <p>If you see this, the component is rendering!</p>
    </div>
  );
};

export default ApplicationPreferences;