import React, { useState, useEffect } from 'react';
import { Settings, Globe, Palette, FileText } from 'lucide-react';
import Button from '../ui/Button';
import Card, { CardBody, CardHeader } from '../ui/Card';
import { getAllJurisdictions } from '../../utils/jurisdictionUtils';
import { JurisdictionBadge } from '../ui/Badge';
import { Jurisdiction } from '../../types';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { Database } from '../../types/supabase';
import { useTranslation } from 'react-i18next'; // ADDED

const ApplicationPreferences: React.FC = () => {
  const supabase = useSupabaseClient<Database>();
  const session = useSession();
  const { t } = useTranslation(); // ADDED

  const [preferences, setPreferences] = useState({
    defaultJurisdictions: [] as Jurisdiction[],
    theme: 'system' as 'light' | 'dark' | 'system',
    reportFormat: 'pdf' as 'pdf' | 'docx' | 'html',
    autoAnalysis: true,
    emailReports: false
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchPreferences = async () => {
      if (!session?.user?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('default_jurisdictions, theme_preference, email_reports_enabled')
          .eq('id', session.user.id)
          .maybeSingle();

        if (fetchError && fetchError.code !== 'PGRST116') {
          throw fetchError;
        }

        const fetchedTheme = (data?.theme_preference as 'light' | 'dark' | 'system') || 'system';
        const fetchedJurisdictions = (data?.default_jurisdictions as Jurisdiction[]) || [];
        const fetchedEmailReports = data?.email_reports_enabled || false;

        setPreferences(prev => ({
          ...prev,
          defaultJurisdictions: fetchedJurisdictions,
          theme: fetchedTheme,
          emailReports: fetchedEmailReports,
        }));

        // Also update localStorage with the fetched theme
        localStorage.setItem('theme-preference', fetchedTheme);

      } catch (err: any) {
        console.error('Error fetching preferences:', err);
        setError(err.message || t('failed_to_load_preferences')); // MODIFIED
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreferences();
  }, [session?.user?.id, supabase, t]); // MODIFIED: Added t to dependency array

  const toggleJurisdiction = (jurisdiction: Jurisdiction) => {
    setPreferences(prev => ({
      ...prev,
      defaultJurisdictions: prev.defaultJurisdictions.includes(jurisdiction)
        ? prev.defaultJurisdictions.filter(j => j !== jurisdiction)
        : [...prev.defaultJurisdictions, jurisdiction]
    }));
  };

  const handlePreferenceChange = (key: string, value: any) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
    // If theme is changed, update localStorage immediately
    if (key === 'theme') {
      localStorage.setItem('theme-preference', value);
      // The useTheme hook will pick this up and apply it
    }
  };

  const handleSave = async () => {
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
            default_jurisdictions: preferences.defaultJurisdictions,
            theme_preference: preferences.theme,
            email_reports_enabled: preferences.emailReports,
          },
          { onConflict: 'id' }
        );

      if (updateError) {
        throw updateError;
      }

      setMessage(t('preferences_saved_successfully')); // MODIFIED
      // The useTheme hook's real-time listener will update the theme,
      // and it already saves to localStorage. So no need to explicitly save here again.
    } catch (err: any) {
      console.error('Error saving preferences:', err);
      setError(err.message || t('failed_to_save_preferences')); // MODIFIED
    } finally {
      setIsSaving(false);
    }
  };

  const ToggleSwitch: React.FC<{
    checked: boolean;
    onChange: (checked: boolean) => void;
  }> = ({ checked, onChange }) => (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        checked ? 'bg-blue-600' : 'bg-gray-200'
      }`}
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
          <p className="text-gray-500 mt-2">{t('loading_preferences')}...</p> {/* MODIFIED */}
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
            <h3 className="text-lg font-medium text-gray-900">{t('default_jurisdictions')}</h3> {/* MODIFIED */}
          </div>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-gray-600 mb-4">
            {t('default_jurisdictions_hint')} {/* MODIFIED */}
          </p>
          <div className="flex flex-wrap gap-2">
            {getAllJurisdictions().map((jurisdiction) => (
              <button
                key={jurisdiction}
                type="button"
                onClick={() => toggleJurisdiction(jurisdiction)}
                className={`py-2 px-3 rounded-full text-sm font-medium transition-colors
                  ${preferences.defaultJurisdictions.includes(jurisdiction)
                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                    : 'bg-gray-100 text-gray-800 border border-gray-200 hover:bg-gray-200'
                  }`}
              >
                {jurisdiction}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Theme Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center">
            <Palette className="h-5 w-5 text-blue-900 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">{t('dashboard_appearance')}</h3> {/* MODIFIED */}
          </div>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('theme')}</label> {/* MODIFIED */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'light', label: t('light') }, {/* MODIFIED */}
                  { value: 'dark', label: t('dark') }, {/* MODIFIED */}
                  { value: 'system', label: t('system') } {/* MODIFIED */}
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handlePreferenceChange('theme', option.value)}
                    className={`p-3 text-sm font-medium rounded-lg border transition-colors
                      ${preferences.theme === option.value
                        ? 'bg-blue-50 border-blue-300 text-blue-800'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Report Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center">
            <FileText className="h-5 w-5 text-blue-900 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">{t('report_preferences')}</h3> {/* MODIFIED */}
          </div>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            {/* Commented out: Default Report Format */}
            {/*
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Default Report Format</label>
              <select
                value={preferences.reportFormat}
                onChange={(e) => handlePreferenceChange('reportFormat', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="pdf">PDF Document</option>
                <option value="docx">Word Document (.docx)</option>
                <option value="html">HTML Report</option>
              </select>
            </div>
            */}

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">{t('auto_start_analysis')}</h4> {/* MODIFIED */}
                <p className="text-sm text-gray-500">{t('auto_start_analysis_hint')}</p> {/* MODIFIED */}
              </div>
              <ToggleSwitch
                checked={preferences.autoAnalysis}
                onChange={(checked) => handlePreferenceChange('autoAnalysis', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">{t('email_reports')}</h4> {/* MODIFIED */}
                <p className="text-sm text-gray-500">{t('email_reports_hint')}</p> {/* MODIFIED */}
              </div>
              <ToggleSwitch
                checked={preferences.emailReports}
                onChange={(checked) => handlePreferenceChange('emailReports', checked)}
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={isSaving}
          icon={<Settings className="w-4 h-4" />}
        >
          {isSaving ? t('saving_preferences') : t('save_preferences')} {/* MODIFIED */}
        </Button>
      </div>
    </div>
  );
};

export default ApplicationPreferences;