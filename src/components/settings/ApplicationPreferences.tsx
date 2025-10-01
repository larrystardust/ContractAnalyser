import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Globe, Palette, FileText, Mail, Smartphone } from 'lucide-react';
import Button from '../ui/Button';
import Card, { CardBody, CardHeader } from '../ui/Card';
import { getAllJurisdictions, getJurisdictionLabel } from '../../utils/jurisdictionUtils';
import { JurisdictionBadge } from '../ui/Badge';
import { Jurisdiction } from '../../types';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { Database } from '../../types/supabase';
import { useTranslation } from 'react-i18next';

const ApplicationPreferences: React.FC = () => {
  const supabase = useSupabaseClient<Database>();
  const session = useSession();
  const { t, i18n } = useTranslation();

  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language);
  const [selectedTheme, setSelectedTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [emailReportsEnabled, setEmailReportsEnabled] = useState(false);
  const [autoStartAnalysisEnabled, setAutoStartAnalysisEnabled] = useState(true);
  const [selectedDefaultJurisdictions, setSelectedDefaultJurisdictions] = useState<Jurisdiction[]>([]); // ADDED: New state for default jurisdictions

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchPreferences = useCallback(async () => {
    if (!session?.user?.id) {
      setIsLoading(false);
      console.log("AP: No user ID, skipping fetch.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('language_preference, theme_preference, email_reports_enabled, auto_start_analysis_enabled, default_jurisdictions') // MODIFIED: Added default_jurisdictions
        .eq('id', session.user.id)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      console.log("AP: Fetched profile data:", data);

      const dbLanguage = data?.language_preference || i18n.language;
      setSelectedLanguage(dbLanguage);
      console.log(`AP: Initializing selectedLanguage to: ${dbLanguage}`);

      if (i18n.language !== dbLanguage) {
        console.log(`AP: Changing i18n language from ${i18n.language} to ${dbLanguage}`);
        i18n.changeLanguage(dbLanguage);
      } else {
        console.log(`AP: i18n language already matches DB preference (${dbLanguage}). No change needed.`);
      }

      const dbTheme = (data?.theme_preference as 'light' | 'dark' | 'system') || 'system';
      setSelectedTheme(dbTheme);
      console.log(`AP: Initializing selectedTheme to: ${dbTheme}`);

      setEmailReportsEnabled(data?.email_reports_enabled || false);
      setAutoStartAnalysisEnabled(data?.auto_start_analysis_enabled || false);
      setSelectedDefaultJurisdictions((data?.default_jurisdictions as Jurisdiction[]) || []); // ADDED: Set default jurisdictions

    } catch (err: any) {
      console.error('Error fetching notification preferences:', err);
      setError(err.message || t('failed_to_load_notification_preferences'));
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, supabase, t, i18n]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  // ADDED: handleJurisdictionToggle function
  const handleJurisdictionToggle = (jurisdiction: Jurisdiction) => {
    setSelectedDefaultJurisdictions(prev => {
      if (prev.includes(jurisdiction)) {
        return prev.filter(j => j !== jurisdiction);
      } else {
        return [...prev, jurisdiction];
      }
    });
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

  const handleSavePreferences = async () => {
    if (!session?.user?.id) {
      setError(t('must_be_logged_in_to_save_preferences'));
      return;
    }
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const languageChanged = i18n.language !== selectedLanguage; // Check if language actually changed

      console.log(`AP: Saving preferences. Changing i18n language to: ${selectedLanguage}`);
      i18n.changeLanguage(selectedLanguage); // This updates the i18n instance and localStorage

      const { error: updateError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: session.user.id,
            language_preference: selectedLanguage,
            theme_preference: selectedTheme,
            email_reports_enabled: emailReportsEnabled,
            auto_start_analysis_enabled: autoStartAnalysisEnabled,
            default_jurisdictions: selectedDefaultJurisdictions,
          },
          { onConflict: 'id' }
        );

      if (updateError) {
        console.error("AP: Error saving language preference:", updateError);
        throw updateError;
      }
      setMessage(t('notification_preferences_saved_successfully'));
      console.log("AP: Language preference saved successfully.");

      await fetchPreferences(); // Call fetchPreferences to re-sync state with DB

      if (languageChanged) { // Only reload if the language preference was actually changed
        window.location.reload();
      }

    } catch (err: any) {
      console.error('Error saving notification preferences:', err);
      setError(err.message || t('failed_to_save_notification_preferences'));
    } finally {
      setIsSaving(false);
    }
  };

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
                onClick={() => handleJurisdictionToggle(jurisdiction)} // MODIFIED: Uncommented and linked
                className={`py-1 px-3 rounded-full text-xs font-medium transition-colors
                  ${selectedDefaultJurisdictions.includes(jurisdiction) // MODIFIED: Check against selectedDefaultJurisdictions
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
              value={selectedTheme}
              onChange={(e) => setSelectedTheme(e.target.value as 'light' | 'dark' | 'system')}
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

      {/* Language Preference */}
      <Card>
        <CardHeader>
          <div className="flex items-center">
            <Globe className="h-5 w-5 text-blue-900 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">{t('language_preference')}</h3>
          </div>
        </CardHeader>
        <CardBody>
          <div>
            <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-2">{t('select_language')}</label>
            <select
              id="language"
              name="language"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              disabled={isSaving}
            >
              <option value="en">{t('english')}</option>
              <option value="es">{t('spanish')}</option>
              <option value="fr">{t('french')}</option>
              <option value="ar">{t('arabic')}</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">{t('language_preference_hint')}</p>
          </div>
        </CardBody>
      </Card>

      {/* Report Preferences Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center">
            <FileText className="h-5 w-5 text-blue-900 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">{t('report_preferences')}</h3>
          </div>
        </CardHeader>
        <CardBody>
          {/* Email Reports Toggle */}
          <div className="flex items-center justify-between py-3">
            <div>
              <h4 className="text-sm font-medium text-gray-900">{t('email_reports')}</h4>
              <p className="text-xs text-gray-500 mt-1">{t('email_reports_hint')}</p>
            </div>
            <ToggleSwitch
              checked={emailReportsEnabled}
              onChange={setEmailReportsEnabled}
              disabled={isSaving}
            />
          </div>
          {/* Auto-start Analysis */}
          <div className="flex items-center justify-between py-3 border-t border-gray-200">
            <div>
              <h4 className="text-sm font-medium text-gray-900">{t('auto_start_analysis')}</h4>
              <p className="text-xs text-gray-500 mt-1">{t('auto_start_analysis_hint')}</p>
            </div>
            <ToggleSwitch
              checked={autoStartAnalysisEnabled}
              onChange={setAutoStartAnalysisEnabled}
              disabled={isSaving}
            />
          </div>
        </CardBody>
      </Card>

      {/* Save Button */}
      <div className="mt-6 flex justify-end">
        <Button
          variant="primary"
          onClick={handleSavePreferences}
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