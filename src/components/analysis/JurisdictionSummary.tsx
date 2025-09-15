import React from 'react';
import { JurisdictionSummary as JurisdictionSummaryType } from '../../types';
import Card, { CardBody, CardHeader } from '../ui/Card';
import { RiskBadge } from '../ui/Badge';
import { getJurisdictionLabel, getJurisdictionFlag } from '../../utils/jurisdictionUtils';
import { Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next'; // ADDED

interface JurisdictionSummaryProps {
  summary: JurisdictionSummaryType;
}

const JurisdictionSummary: React.FC<JurisdictionSummaryProps> = ({ summary }) => {
  const { t } = useTranslation(); // ADDED

  if (summary.keyFindings.length === 0) {
    return null;
  }
  
  return (
    <Card className="h-full">
      <CardHeader className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-2xl mr-2">{getJurisdictionFlag(summary.jurisdiction)}</span>
          <h3 className="text-lg font-medium text-gray-900">
            {t(getJurisdictionLabel(summary.jurisdiction))} {/* MODIFIED: Apply t() */}
          </h3>
        </div>
        <RiskBadge risk={summary.riskLevel} />
      </CardHeader>
      
      <CardBody>
        <div className="space-y-4">
          {/* Applicable Laws */}
          {summary.applicableLaws.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Shield className="h-4 w-4 mr-1 text-blue-900" />
                {t('applicable_laws')} {/* MODIFIED: Apply t() */}
              </h4>
              <ul className="list-disc pl-5 space-y-1">
                {summary.applicableLaws.map((law, index) => (
                  <li key={index} className="text-sm text-gray-600">{t(law)}</li> 
                ))}
              </ul>
            </div>
          )}
          
          {/* Key Findings */}
          {summary.keyFindings.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">{t('key_findings')}</h4> {/* MODIFIED: Apply t() */}
              <ul className="list-disc pl-5 space-y-1">
                {summary.keyFindings.map((finding, index) => (
                  <li key={index} className="text-sm text-gray-600">{t(finding)}</li> 
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
};

export default JurisdictionSummary;