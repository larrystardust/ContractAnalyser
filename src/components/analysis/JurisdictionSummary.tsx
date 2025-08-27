import React from 'react';
import { JurisdictionSummary as JurisdictionSummaryType } from '../../types';
import Card, { CardBody, CardHeader } from '../ui/Card';
import { RiskBadge } from '../ui/Badge';
import { getJurisdictionLabel, getJurisdictionFlag } from '../../utils/jurisdictionUtils';
import { Shield } from 'lucide-react';

interface JurisdictionSummaryProps {
  summary: JurisdictionSummaryType;
}

const JurisdictionSummary: React.FC<JurisdictionSummaryProps> = ({ summary }) => {
  if (summary.keyFindings.length === 0) {
    return null; // Don't render jurisdictions with no findings
  }
  
  return (
    <Card className="h-full">
      <CardHeader className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-2xl mr-2">{getJurisdictionFlag(summary.jurisdiction)}</span>
          <h3 className="text-lg font-medium text-gray-900">
            {getJurisdictionLabel(summary.jurisdiction)}
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
                <Shield className="w-4 h-4 mr-1 text-blue-900" />
                Applicable Laws
              </h4>
              <ul className="list-disc pl-5 space-y-1">
                {summary.applicableLaws.map((law, index) => (
                  <li key={index} className="text-sm text-gray-600">{law}</li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Key Findings */}
          {summary.keyFindings.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Key Findings</h4>
              <ul className="list-disc pl-5 space-y-1">
                {summary.keyFindings.map((finding, index) => (
                  <li key={index} className="text-sm text-gray-600">{finding}</li>
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