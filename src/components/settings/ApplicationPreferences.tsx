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
          .select('notification_settings, language_preference')
          .eq('id', session.user.id)
          .maybeSingle();

        if (fetchError && fetchError.code !== 'PGRST116') {
          throw fetchError;
        }

        if (data?.notification_settings) {
          const fetchedSettings = data.notification_settings as Record<string, { email: boolean; inApp: boolean }>;
          setPreferences(prev => {
            const merged = { ...prev };
            for (const key in notificationTypes) {
              if (fetchedSettings[key]) {
                merged[key] = fetchedSettings[key];
              }
            }
            return merged;
          });
        }

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
  }, [session?.user?.id, supabase, t, i18n]);

  // Restore the original return block here
  if (isLoading) {
    return (
      <Card>
        <CardBody className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900 mx-auto"></div>
          <p className="text-gray-500 mt-2">{t('loading_notification_preferences')}...</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
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

      {/* Default Jurisdictions */}
      <Card>
        <CardHeader>
          <div className="flex items-center">
            <Globe className="h-5 w-5 text-blue-900 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">{t('default_jurisdictions')}</h3>
          </div>
        </CardHeader>
        <CardBody>
          <div className="flex flex-wrap gap-2">
            {getAllJurisdictions().map((jurisdiction) => (
              <button
                key={jurisdiction}
                type="button"
                // onClick={() => handleJurisdictionToggle(jurisdiction)} // Commented out for now
                className={`py-1 px-3 rounded-full text-xs font-medium transition-colors
                  ${(preferences.default_jurisdictions || []).includes(jurisdiction)
                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                    : 'bg-gray-100 text-gray-800 border border-gray-200 hover:bg-gray-200'
                  }`}
                disabled={isSaving}
              >
                {t(getJurisdictionLabel(jurisdiction))}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1">{t('default_jurisdictions_hint')}</p>
        </CardBody>
      </Card>

      {/* Theme Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center">
            <Palette className="h-5 w-5 text-blue-900 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">{t('theme_preference')}</h3>
          </div>
        </CardHeader>
        <CardBody>
          <div>
            <label htmlFor="theme" className="block text-sm font-medium text-gray-700 mb-2">{t('select_theme')}</label>
            <select
              id="theme"
              name="theme"
              // value={preferences.theme} // Commented out for now
              // onChange={(e) => handlePreferenceChange('theme', e.target.value)} // Commented out for now
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              disabled={isSaving}
            >
              <option value="light">{t('light')}</option>
              <option value="dark">{t('dark')}</option>
              <option value="system">{t('system')}</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">{t('theme_preference_hint')}</p>
          </div>
        </CardBody>
      </Card>

      {/* Report Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center">
            <FileText className="h-5 w-5 text-blue-900 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">{t('report_preferences')}</h3>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-3 gap-4 pb-4 border-b border-gray-200">
            <div className="text-sm font-medium text-gray-700">{t('notification_type')}</div>
            <div className="text-sm font-medium text-gray-700 flex items-center justify-center">
              <Mail className="h-4 w-4 mr-1" />
              {t('email')}
            </div>
            <div className="text-sm font-medium text-gray-700 flex items-center justify-center">
              <Smartphone className="h-4 w-4 mr-1" />
              {t('in_app')}
            </div>
          </div>

          {Object.entries(preferences).map(([id, pref]) => {
            const typeInfo = notificationTypes[id as keyof typeof notificationTypes];
            if (!typeInfo) return null;

            return (
              <div key={id} className="grid grid-cols-3 gap-4 items-center py-3">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">{t(typeInfo.titleKey)}</h4>
                  <p className="text-xs text-gray-500 mt-1">{t(typeInfo.descriptionKey)}</p>
                </div>
                <div className="flex justify-center">
                  {/* <ToggleSwitch // Commented out for now
                    checked={pref.email}
                    onChange={(checked) => updatePreference(id, 'email', checked)}
                  /> */}
                  <input type="checkbox" checked={pref.email} disabled={true} /> {/* Temporary placeholder */}
                </div>
                <div className="flex justify-center">
                  {/* <ToggleSwitch // Commented out for now
                    checked={pref.inApp}
                    onChange={(checked) => updatePreference(id, 'inApp', checked)}
                  /> */}
                  <input type="checkbox" checked={pref.inApp} disabled={true} /> {/* Temporary placeholder */}
                </div>
              </div>
            );
          })}
        </CardBody>
      </Card>

      {/* Save Button */}
      <div className="mt-6 flex justify-end">
        <Button
          variant="primary"
          // onClick={handleSavePreferences} // Commented out for now
          disabled={isSaving}
          icon={<Settings className="w-4 h-4" />}
        >
          {isSaving ? t('saving_preferences') : t('save_preferences')}
        </Button>
      </div>
    </div>
  );
};

export default ApplicationPreferences;