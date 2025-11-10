import React, { useState, useEffect } from 'react';
import { AnalysisResult, Finding, Jurisdiction, JurisdictionSummary, RedlinedClauseArtifact } from '../../types';
import Card, { CardBody, CardHeader } from '../ui/Card';
import { RiskBadge, JurisdictionBadge, CategoryBadge } from '../ui/Badge';
import { AlertCircle, Info, FilePlus, Mail, RefreshCw, Loader2, Download } from 'lucide-react';
import Button from '../ui/Button';
import { getRiskBorderColor, getRiskTextColor } from '../../utils/riskUtils';
import { getJurisdictionLabel } from '../../utils/jurisdictionUtils';
import { supabase } from '../../lib/supabase';
import { useSession } from '@supabase/auth-helpers-react';
import { useUserProfile } from '../../hooks/useUserProfile';
import { useContracts } from '../../context/ContractContext';
import { useTranslation } from 'react-i18next';
import { useSubscription } from '../../hooks/useSubscription';

interface AnalysisResultsProps {
  analysisResult?: AnalysisResult;
  isSample?: boolean;
  onReanalyzeInitiated?: (contractName: string) => void;
  contractName: string;
}

const AnalysisResults: React.FC<AnalysisResultsProps> = ({ analysisResult, isSample = false, onReanalyzeInitiated, contractName }) => {
  const { t, i18n } = useTranslation(); // MODIFIED: Destructure i18n
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<Jurisdiction | 'all'>('all');
  const [expandedFindings, setExpandedFindings] = useState<string[]>([]);
  const [isEmailing, setIsEmailing] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const session = useSession();
  const { defaultJurisdictions, loading: loadingUserProfile } = useUserProfile();
  const { reanalyzeContract, refetchContracts } = useContracts();
  const { subscription, loading: loadingSubscription } = useSubscription();

  // ADDED: Determine if user is on an advanced plan
  const isAdvancedPlan = subscription && (subscription.tier === 4 || subscription.tier === 5);

  if (!analysisResult) {
    return (
      <Card>
        <CardBody className="text-center py-8">
          <Info className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">{t('no_analysis_results_available')}</p>
        </CardBody>
      </Card>
    );
  }

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

  const handleEmailReport = async () => {
    if (!session?.access_token || !session?.user?.id || !session?.user?.email) {
      alert(t('must_be_logged_in_to_email_reports'));
      return;
    }

    if (!analysisResult.contract_id || !analysisResult.executiveSummary || !analysisResult.reportFilePath) {
      console.error('Email Error: analysisResult or required fields are missing.', { analysisResult });
      alert(t('cannot_email_report_incomplete_data'));
      return;
    }

    setIsEmailing(true);
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, email_reports_enabled')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching user profile for email preference:', profileError);
        alert(t('failed_to_fetch_email_preferences'));
        return;
      }

      const userName = profileData?.full_name || session.user.email;
      const sendEmail = profileData?.email_reports_enabled || false;

      if (!sendEmail) {
        alert(t('email_reports_disabled_alert'));
        return;
      }

      const { data: signedUrlResponse, error: signedUrlError } = await supabase.functions.invoke('get-signed-report-url', {
        body: {
          contractId: analysisResult.contract_id,
          reportFilePath: analysisResult.reportFilePath,
        },
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (signedUrlError) {
        console.error('Error invoking get-signed-report-url Edge Function:', signedUrlError);
        alert(t('failed_to_generate_report_link', { message: signedUrlError.message }));
        return;
      }

      const reportLink = signedUrlResponse.url;

      const { data: htmlBlob, error: fetchHtmlError } = await supabase.storage
        .from('reports')
        .download(analysisResult.reportFilePath);

      if (fetchHtmlError) {
        console.error('Error downloading HTML report from storage:', fetchHtmlError);
        alert(t('failed_to_retrieve_report_content'));
        return;
      }

      const reportHtmlContent = await htmlBlob.text();

      const { data, error } = await supabase.functions.invoke('trigger-report-email', {
        body: {
          userId: session.user.id,
          contractId: analysisResult.contract_id,
          reportSummary: analysisResult.executiveSummary,
          reportLink: reportLink,
          reportHtmlContent: reportHtmlContent,
        },
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        const errorData = await error.context.json();
        throw new Error(errorData.error || t('edge_function_returned_error'));
      }

      alert(t('report_email_sent_successfully'));
    } catch (error: any) {
      console.error('Error emailing report:', error);
      alert(t('failed_to_email_report', { message: error.message }));
    } finally {
      setIsEmailing(false);
    }
  };

  const handleReanalyze = async () => {
    if (!analysisResult?.contract_id) return;
    if (onReanalyzeInitiated) {
      onReanalyzeInitiated(contractName);
    }
    setIsReanalyzing(true);
    try {
      await reanalyzeContract(analysisResult.contract_id);
      // The parent component (Dashboard) will handle closing the modal based on contract status update
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsReanalyzing(false);
    }
  };

  // MODIFIED: Handle download of redlined clause artifact to use PublicReportViewerPage
  const handleDownloadRedlinedClause = () => {
    if (!analysisResult?.redlinedClauseArtifactPath || !analysisResult?.contract_id) return;

    // Construct the URL to PublicReportViewerPage, passing artifactPath and lang
    const viewerUrl = `/public-report-view?artifactPath=${encodeURIComponent(analysisResult.redlinedClauseArtifactPath)}&lang=${i18n.language}`;
    window.open(viewerUrl, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">{t('executive_summary')}</h2>
          {!isSample && (
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleEmailReport}
                disabled={isEmailing}
                icon={<Mail className="w-4 h-4" />}
              >
                {isEmailing ? t('emailing') : t('email_full_report')}
              </Button>
              {/* The "Reanalyze Contract" button is commented out below */}
              {/*
              <Button
                variant="secondary"
                size="sm"
                onClick={handleReanalyze}
                disabled={isReanalyzing}
                icon={<RefreshCw className="w-4 h-4" />}
              >
                {isReanalyzing ? t('reanalyzing') : t('reanalyze_contract')}
              </Button>
              */}
            </div>
          )}
        </div>
        <p className="text-gray-700">
          {t(analysisResult.executiveSummary, { contractName: contractName, complianceScore: analysisResult.complianceScore })}
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
      
      {analysisResult.performedAdvancedAnalysis ? (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('advanced_analysis_details')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
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

      {/* MODIFIED: Artifacts Section (Conditional for performedAdvancedAnalysis) */}
      {analysisResult.performedAdvancedAnalysis && analysisResult.redlinedClauseArtifactPath && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('artifacts_section_title')}</h2>
          <p className="text-sm text-gray-600 mb-4">
            {t('redlined_clause_artifact_description', { findingId: analysisResult.redlinedClauseArtifactPath.split('/').pop()?.split('.')[0] || t('not_specified') })}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadRedlinedClause}
            icon={<Download className="w-4 h-4" />}
          >
            {t('view_artifact')} {/* MODIFIED: Changed button text */}
          </Button>
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

export default AnalysisResults;