import React, { useState } from 'react';
import { AnalysisResult, Finding, Jurisdiction, JurisdictionSummary } from '../../types'; // Import JurisdictionSummary
import Card, { CardBody, CardHeader } from '../ui/Card';
import { RiskBadge, JurisdictionBadge, CategoryBadge } from '../ui/Badge';
import { AlertCircle, Info, FilePlus } from 'lucide-react';
import Button from '../ui/Button';
import { getRiskBorderColor, getRiskTextColor, countFindingsByRisk } from '../../utils/riskUtils';
import { getJurisdictionLabel } from '../../utils/jurisdictionUtils';

interface AnalysisResultsProps {
  analysisResult: AnalysisResult;
}

// Helper function to generate jurisdiction summaries from findings
const generateJurisdictionSummaries = (
  findings: Finding[],
  contractJurisdictions: Jurisdiction[]
): Record<Jurisdiction, JurisdictionSummary> => {
  const summaries: Record<Jurisdiction, JurisdictionSummary> = {};

  // Initialize summaries for all contract jurisdictions
  contractJurisdictions.forEach(j => {
    summaries[j] = {
      jurisdiction: j,
      applicableLaws: [], // Placeholder, as this isn't in findings
      keyFindings: [],
      riskLevel: 'none', // Will be updated
    };
  });

  // Process findings to populate keyFindings and determine riskLevel
  findings.forEach(finding => {
    const j = finding.jurisdiction;
    if (summaries[j]) {
      summaries[j].keyFindings.push(finding.title);
      // Update risk level if a higher risk finding is encountered
      if (finding.riskLevel === 'high') {
        summaries[j].riskLevel = 'high';
      } else if (finding.riskLevel === 'medium' && summaries[j].riskLevel !== 'high') {
        summaries[j].riskLevel = 'medium';
      } else if (finding.riskLevel === 'low' && summaries[j].riskLevel === 'none') {
        summaries[j].riskLevel = 'low';
      }
    } else if (j === 'EU' && !summaries['EU']) { // Handle EU findings if not explicitly in contract jurisdictions
      summaries['EU'] = {
        jurisdiction: 'EU',
        applicableLaws: [],
        keyFindings: [finding.title],
        riskLevel: finding.riskLevel,
      };
    }
  });

  // Add placeholder applicable laws for demonstration
  Object.values(summaries).forEach(summary => {
    if (summary.applicableLaws.length === 0) {
      summary.applicableLaws.push(`${getJurisdictionLabel(summary.jurisdiction)} Law 1`);
      summary.applicableLaws.push(`${getJurisdictionLabel(summary.jurisdiction)} Law 2`);
    }
  });

  return summaries;
};


const AnalysisResults: React.FC<AnalysisResultsProps> = ({ analysisResult }) => {
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<Jurisdiction | 'all'>('all');
  const [expandedFindings, setExpandedFindings] = useState<string[]>([]);
  
  // Generate jurisdiction summaries dynamically
  const contractJurisdictions = analysisResult.findings.map(f => f.jurisdiction).filter((value, index, self) => self.indexOf(value) === index); // Get unique jurisdictions from findings
  const jurisdictionSummaries = generateJurisdictionSummaries(analysisResult.findings, contractJurisdictions as Jurisdiction[]);

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
  
  const jurisdictions = Object.keys(jurisdictionSummaries) as Jurisdiction[]; // Use generated summaries

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Executive Summary</h2>
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
      
      {/* Jurisdiction Filter */}
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
          // Only show jurisdictions that have findings
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
      
      {/* Findings */}
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
      
      {/* Data Protection Impact */}
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