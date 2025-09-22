import React, { useState, useEffect } from 'react';
import { Settings, Globe, Palette, FileText } from 'lucide-react';
import Button from '../ui/Button';
import Card, { CardBody, CardHeader } from '../ui/Card';
import { getAllJurisdictions, getJurisdictionLabel } from '../../utils/jurisdictionUtils';
import { JurisdictionBadge } from '../ui/Badge';
import { Jurisdiction } from '../../types';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { Database } from '../../types/supabase';
import { useTranslation } from 'react-i18next'; // MODIFIED: Destructure i18n

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
  const { t, i18n } = useTranslation(); // MODIFIED: Destructure i18n

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