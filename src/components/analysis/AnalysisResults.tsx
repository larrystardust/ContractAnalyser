import React, { useState } from 'react';
import { AnalysisResult, Finding, Jurisdiction, JurisdictionSummary } from '../../types';
import Card, { CardBody, CardHeader } from '../ui/Card';
import { RiskBadge, JurisdictionBadge, CategoryBadge } from '../ui/Badge';
import { AlertCircle, Info, FilePlus, Mail, RefreshCw } from 'lucide-react';
import Button from '../ui/Button';
import { getRiskBorderColor, getRiskTextColor, countFindingsByRisk } from '../../utils/riskUtils';
import { getJurisdictionLabel } from '../../utils/jurisdictionUtils';
import { supabase } from '../../lib/supabase';
import { useSession } from '@supabase/auth-helpers-react';
import { useUserProfile } from '../../hooks/useUserProfile';
import { useContracts } from '../../context/ContractContext';

interface AnalysisResultsProps {
  analysisResult: AnalysisResult;
}

const AnalysisResults: React.FC<AnalysisResultsProps> = ({ analysisResult }) => {
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<Jurisdiction | 'all'>('all');
  const [expandedFindings, setExpandedFindings] = useState<string[]>([]);
  const [isEmailing, setIsEmailing] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const session = useSession();
  const { defaultJurisdictions, loading: loadingUserProfile } = useUserProfile();
  const { reanalyzeContract, refetchContracts } = useContracts(); // MODIFIED: Destructure refetchContracts

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
      alert('You must be logged in to email reports.');
      return;
    }

    if (!analysisResult || !analysisResult.contract_id || !analysisResult.executiveSummary || !analysisResult.reportFilePath) {
      console.error('Email Error: analysisResult or required fields are missing.', { analysisResult });
      alert('Cannot email report: Analysis data is incomplete. Please try again later or contact support.');
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
        alert('Failed to fetch user email preferences. Please try again.');
        return;
      }

      const userName = profileData?.full_name || session.user.email;
      const sendEmail = profileData?.email_reports_enabled || false;

      if (!sendEmail) {
        alert('Your email reports setting is currently disabled. Please enable it in your Application Preferences to receive reports via email.');
        return;
      }

      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('reports')
        .createSignedUrl(analysisResult.reportFilePath, 3600);

      if (signedUrlError) {
        console.error('Error creating signed URL for report:', signedUrlError);
        alert('Failed to generate a link for the report. Please try again.');
        return;
      }

      const reportLink = signedUrlData.signedUrl;

      const { data: htmlBlob, error: fetchHtmlError } = await supabase.storage
        .from('reports')
        .download(analysisResult.reportFilePath);

      if (fetchHtmlError) {
        console.error('Error downloading HTML report from storage:', fetchHtmlError);
        alert('Failed to retrieve report content. Please try again.');
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
        throw new Error(errorData.error || 'Edge Function returned an error');
      }

      alert('Report email sent successfully!');
    } catch (error: any) {
      console.error('Error emailing report:', error);
      alert(`Failed to email report: ${error.message}`);
    } finally {
      setIsEmailing(false);
    }
  };

  const handleReanalyze = async () => {
    if (!analysisResult?.contract_id) {
      alert('No contract selected for re-analysis.');
      return;
    }
    setIsReanalyzing(true);
    try {
      await reanalyzeContract(analysisResult.contract_id);
      // MODIFIED: Remove alert and explicitly refetch contracts
      await refetchContracts(); // Force a refetch to get the latest status and analysis result
    } catch (error: any) {
      console.error('Re-analysis failed:', error);
      alert(`Failed to re-analyze contract: ${error.message}`); // Error message here
    } finally {
      setIsReanalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Executive Summary</h2>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEmailReport}
              disabled={isEmailing}
              icon={<Mail className="w-4 h-4" />}
            >
              {isEmailing ? 'Emailing...' : 'Email Full Report'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReanalyze}
              disabled={isReanalyzing}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              {isReanalyzing ? 'Re-analyzing...' : 'Re-analyze Contract'}
            </Button>
          </div>
        </div>
        <p className="text-gray-700">{analysisResult.executiveSummary}</p>
        
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <FilePlus className="h-6 w-6 text-green-700" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-green-700">Compliance Score</p>
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
                <p className="text-sm text-red-700">High Risk Issues</p>
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
                <p className="text-sm text-amber-700">Medium Risk Issues</p>
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
                <p className="text-sm text-blue-700">Low Risk Issues</p>
                <p className="text-2xl font-bold text-blue-800">{riskCounts.low}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setSelectedJurisdiction('all')}
          className={`py-2 px-4 rounded-md text-sm font-medium transition-colors
            ${selectedJurisdiction === 'all'
              ? 'bg-gray-800 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
        >
          All Jurisdictions
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
              {getJurisdictionLabel(jurisdiction)}
            </button>
          );
        })}
      </div>
      
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">
          {selectedJurisdiction === 'all' 
            ? 'All Findings' 
            : `${getJurisdictionLabel(selectedJurisdiction)} Findings`}
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({filteredFindings.length} {filteredFindings.length === 1 ? 'issue' : 'issues'})
          </span>
        </h2>
        
        {filteredFindings.length === 0 ? (
          <Card>
            <CardBody className="text-center py-8">
              <Info className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No findings for this jurisdiction</p>
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
                        {finding.title}
                      </h3>
                      {finding.clauseReference && (
                        <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          {finding.clauseReference}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mt-2">
                      <RiskBadge risk={finding.riskLevel} />
                      <JurisdictionBadge jurisdiction={finding.jurisdiction} showLabel={false} />
                      <CategoryBadge category={finding.category} />
                    </div>
                    
                    <p className="mt-3 text-gray-700">{finding.description}</p>
                    
                    {expandedFindings.includes(finding.id) && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Recommendations</h4>
                        <ul className="list-disc pl-5 space-y-1">
                          {finding.recommendations.map((rec, index) => (
                            <li key={index} className="text-sm text-gray-700">{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  
                  <Button
                    variant="text"
                    size="sm"
                    onClick={() => toggleFindingExpanded(finding.id)}
                    className="ml-4"
                  >
                    {expandedFindings.includes(finding.id) ? 'Hide Details' : 'Show Details'}
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))
        )}
      </div>
      
      {analysisResult.dataProtectionImpact && (
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Data Protection Impact</h2>
          <p className="text-gray-700">{analysisResult.dataProtectionImpact}</p>
        </div>
      )}
    </div>
  );
};

export default AnalysisResults;