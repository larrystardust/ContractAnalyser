import React, { useState } from 'react';
import { AnalysisResult, Finding, Jurisdiction, JurisdictionSummary } from '../../types';
import Card, { CardBody, CardHeader } from '../ui/Card';
import { RiskBadge, JurisdictionBadge, CategoryBadge } from '../ui/Badge';
import { AlertCircle, Info, FilePlus, Download } from 'lucide-react';
import Button from '../ui/Button'; // ADDED: Import Button
import { getRiskBorderColor, getRiskTextColor, countFindingsByRisk } from '../../utils/riskUtils';
import { getJurisdictionLabel } from '../../utils/jurisdictionUtils';
import { useTranslation } from 'react-i18next';

interface SampleAnalysisResultsProps {
  analysisResult: AnalysisResult;
  isSample?: boolean;
  contractName: string;
}

const SampleAnalysisResults: React.FC<SampleAnalysisResultsProps> = ({ analysisResult, isSample = true, contractName }) => {
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<Jurisdiction | 'all'>('all');
  const [expandedFindings, setExpandedFindings] = useState<string[]>([]);
  const { t } = useTranslation();
  
  const jurisdictionSummaries = analysisResult.jurisdictionSummaries;
  
  const filteredFindings = selectedJurisdiction === 'all' 
    ? analysisResult.findings 
    : analysisResult.findings.filter(finding => finding.jurisdiction === selectedJurisdiction);
  
  const riskCounts = countFindingsByRisk(analysisResult.findings);
  
  const toggleFindingExpanded = (findingId: string) => {
    if (expandedFindings.includes(findingId)) {
      setExpandedFindings(expandedFindings.filter(id => id !== findingId));
    } else {
      setExpandedFindings([...expandedFindings, findingId]);
    }
  };
  
  const jurisdictions = Object.keys(jurisdictionSummaries) as Jurisdiction[];

  // ADDED: Handle download of redlined clause artifacts for sample data
  const handleDownloadRedlinedClause = () => {
    if (!analysisResult.redlinedClauseArtifactsData || analysisResult.redlinedClauseArtifactsData.length === 0) {
      alert(t('no_artifacts_to_download'));
      return;
    }
    const jsonString = JSON.stringify(analysisResult.redlinedClauseArtifactsData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `redlined_clauses_sample_${analysisResult.contract_id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    alert(t('redlined_clause_download_started'));
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">{t('executive_summary')}</h2>
        </div>
        <p className="text-gray-700">
          {t(analysisResult.executiveSummary, { contractName: t(contractName), complianceScore: analysisResult.complianceScore })}
        </p>
        
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <FilePlus className="h-6 w-6 text-green-700" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-green-700">{t('compliance_score')}</p>
                <p className="text-2xl font-bold text-green-800">{analysisResult.complianceScore}%</p>
              </div>
            </div>
          </div>
          
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-700" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-red-700">{t('high_risk_issues')}</p>
                <p className="text-2xl font-bold text-red-800">{riskCounts.high}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <Info className="h-6 w-6 text-amber-700" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-amber-700">{t('medium_risk_issues')}</p>
                <p className="text-2xl font-bold text-amber-800">{riskCounts.medium}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Info className="h-6 w-6 text-blue-700" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-blue-700">{t('low_risk_issues')}</p>
                <p className="text-2xl font-bold text-blue-800">{riskCounts.low}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* MODIFIED: Conditional rendering for Advanced Analysis Details Section for Sample */}
      {analysisResult.performedAdvancedAnalysis ? ( // MODIFIED: Use the new flag
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('advanced_analysis_details')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
            {/* All fields are now displayed if performedAdvancedAnalysis is true */}
            <p><strong>{t('effective_date')}:</strong> {t(analysisResult.effectiveDate || 'not_specified')}</p>
            <p><strong>{t('termination_date')}:</strong> {t(analysisResult.terminationDate || 'not_specified')}</p>
            <p><strong>{t('renewal_date')}:</strong> {t(analysisResult.renewalDate || 'not_specified')}</p>
            <p><strong>{t('contract_type')}:</strong> {t(analysisResult.contractType || 'not_specified')}</p>
            <p><strong>{t('contract_value')}:</strong> {t(analysisResult.contractValue || 'not_specified')}</p>
            <p><strong>{t('parties')}:</strong> {analysisResult.parties && analysisResult.parties.length > 0 ? analysisResult.parties.map(p => t(p)).join(', ') : t('not_specified')}</p>
            <p className="md:col-span-2"><strong>{t('liability_cap_summary')}:</strong> {t(analysisResult.liabilityCapSummary || 'not_specified')}</p>
            <p className="md:col-span-2"><strong>{t('indemnification_clause_summary')}:</strong> {t(analysisResult.indemnificationClauseSummary || 'not_specified')}</p>
            <p className="md:col-span-2"><strong>{t('confidentiality_obligations_summary')}:</strong> {t(analysisResult.confidentialityObligationsSummary || 'not_specified')}</p>
          </div>
        </div>
      ) : null}
      
      {/* ADDED: Artifacts Section for Sample Data */}
      {analysisResult.performedAdvancedAnalysis && analysisResult.redlinedClauseArtifactsData && analysisResult.redlinedClauseArtifactsData.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('artifacts_section_title')}</h2>
          <div className="space-y-6">
            {analysisResult.redlinedClauseArtifactsData.map((artifact, index) => (
              <div key={index} className="space-y-4 border-b pb-4 last:border-b-0 last:pb-0">
                <h3 className="text-lg font-medium text-gray-800">{t('redlined_clause_artifact')} {analysisResult.redlinedClauseArtifactsData!.length > 1 ? `#${index + 1}` : ''}</h3>
                {artifact.findingId && <p className="text-sm text-gray-600">{t('associated_finding_id')}: {artifact.findingId}</p>}
                <div className="bg-gray-100 p-4 rounded-md font-mono text-sm overflow-x-auto">
                  <p className="font-bold text-gray-700">{t('original_clause')}:</p>
                  <pre className="whitespace-pre-wrap text-gray-800">{t(artifact.originalClause)}</pre>
                  <p className="font-bold text-gray-700 mt-4">{t('redlined_version')}:</p>
                  <pre className="whitespace-pre-wrap text-red-600">{t(artifact.redlinedVersion)}</pre>
                  <p className="font-bold text-gray-700 mt-4">{t('suggested_revision')}:</p>
                  <pre className="whitespace-pre-wrap text-green-600">{t(artifact.suggestedRevision)}</pre>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadRedlinedClause}
              icon={<Download className="w-4 h-4" />}
            >
              {t('download_all_artifacts')}
            </Button>
          </div>
        </div>
      )}
      
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setSelectedJurisdiction('all')}
          className={`py-2 px-4 rounded-md text-sm font-medium transition-colors
            ${selectedJurisdiction === 'all'
              ? 'bg-gray-800 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
        >
          {t('all_jurisdictions')}
        </button>
        
        {jurisdictions.map((jurisdiction) => {
          if (jurisdictionSummaries[jurisdiction].keyFindings.length === 0) {
            return null;
          }
          
          return (
            <button
              key={jurisdiction}
              onClick={() => setSelectedJurisdiction(jurisdiction)}
              className={`py-2 px-4 rounded-md text-sm font-medium transition-colors
                ${selectedJurisdiction === jurisdiction
                  ? 'bg-blue-900 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
            >
              {t(getJurisdictionLabel(jurisdiction))}
            </button>
          );
        })}
      </div>
      
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">
          {selectedJurisdiction === 'all' 
            ? t('all_findings') 
            : t('jurisdiction_findings', { jurisdiction: t(getJurisdictionLabel(selectedJurisdiction)) })}
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({filteredFindings.length} {filteredFindings.length === 1 ? t('issue') : t('issues')})
          </span>
        </h2>
        
        {filteredFindings.length === 0 ? (
          <Card>
            <CardBody className="text-center py-8">
              <Info className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">{t('no_findings_for_jurisdiction')}</p>
            </CardBody>
          </Card>
        ) : (
          filteredFindings.map((finding) => (
            <Card
              key={finding.id}
              className={`border-l-4 ${getRiskBorderColor(finding.riskLevel)} transition-all duration-200`}
            >
              <CardBody>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h3 className={`text-base font-medium ${getRiskTextColor(finding.riskLevel)}`}>
                        {t(finding.title)}
                      </h3>
                      {finding.clauseReference && (
                        <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          {t(finding.clauseReference)}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mt-2">
                      <RiskBadge risk={finding.riskLevel} />
                      <JurisdictionBadge jurisdiction={finding.jurisdiction} showLabel={true} />
                      <CategoryBadge category={finding.category} />
                    </div>
                    
                    <p className="mt-3 text-gray-700">{t(finding.description)}</p>
                    
                    {expandedFindings.includes(finding.id) && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">{t('recommendations')}</h4>
                        <ul className="list-disc pl-5 space-y-1">
                          {finding.recommendations.map((rec, index) => (
                            <li key={index} className="text-sm text-gray-700">{t(rec)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => toggleFindingExpanded(finding.id)}
                    className="ml-4 text-blue-600 hover:underline text-sm"
                  >
                    {expandedFindings.includes(finding.id) ? t('hide_details') : t('show_details')}
                  </button>
                </div>
              </CardBody>
            </Card>
          ))
        )}
      </div>
      
      {analysisResult.dataProtectionImpact && (
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('data_protection_impact')}</h2>
          <p className="text-gray-700">{t(analysisResult.dataProtectionImpact)}</p>
        </div>
      )}
    </div>
  );
};

export default SampleAnalysisResults;