import { AnalysisResult, Contract, Finding, Jurisdiction } from '../types';

export const sampleContracts: Contract[] = [
  {
    id: '1',
    name: 'UK-EU Distribution Agreement.pdf',
    created_at: '2025-04-10T14:30:00Z',
    jurisdictions: ['UK', 'EU'],
    status: 'completed',
    size: '1.2 MB',
    analysisResult: undefined // Will be populated by generateSampleAnalysisResult
  },
  {
    id: '2',
    name: 'International Licensing Agreement.pdf', // MODIFIED: Renamed from Malta
    created_at: '2025-04-08T09:15:00Z',
    jurisdictions: ['Others', 'EU'], // MODIFIED: Changed to 'Others'
    status: 'completed',
    size: '2.8 MB',
    analysisResult: undefined // Will be populated by generateSampleAnalysisResult
  },
  {
    id: '3',
    name: 'Irish Service Level Agreement.pdf',
    created_at: '2025-04-05T16:45:00Z',
    jurisdictions: ['Ireland', 'EU'],
    status: 'analyzing', // Keep one analyzing for demo
    size: '0.9 MB',
    processing_progress: 50,
    analysisResult: undefined
  },
  {
    id: '4',
    name: 'Cross-Border Joint Venture.pdf', // MODIFIED: Renamed from Cyprus
    created_at: '2025-04-02T11:20:00Z',
    jurisdictions: ['Others', 'UK'], // MODIFIED: Changed to 'Others'
    status: 'pending', // Keep one pending for demo
    size: '3.4 MB',
    processing_progress: 0,
    analysisResult: undefined
  },
  {
    id: '5', // ADDED new contract for US
    name: 'US Software Licensing Agreement.pdf',
    created_at: '2025-04-01T10:00:00Z',
    jurisdictions: ['US'],
    status: 'completed',
    size: '1.5 MB',
    analysisResult: undefined
  },
  {
    id: '6', // ADDED new contract for Canada/Australia
    name: 'Canada-Australia Partnership Deed.pdf',
    created_at: '2025-03-28T14:00:00Z',
    jurisdictions: ['Canada', 'Australia'],
    status: 'completed',
    size: '2.0 MB',
    analysisResult: undefined
  }
];

export const allSampleFindings: Finding[] = [
  {
    id: 'f1',
    title: 'sample_finding_f1_title',
    description: 'sample_finding_f1_description',
    riskLevel: 'high',
    jurisdiction: 'EU',
    category: 'data-protection',
    recommendations: [
      'sample_finding_f1_recommendation_1',
      'sample_finding_f1_recommendation_2',
      'sample_finding_f1_recommendation_3'
    ],
    clauseReference: 'clause_reference_section_12_3', // MODIFIED: Now a translation key
    created_at: '2025-04-10T14:30:00Z',
    updated_at: '2025-04-10T14:30:00Z',
    analysis_result_id: 'ar1'
  },
  {
    id: 'f2',
    title: 'sample_finding_f2_title',
    description: 'sample_finding_f2_description',
    riskLevel: 'medium',
    jurisdiction: 'UK',
    category: 'compliance',
    recommendations: [
      'sample_finding_f2_recommendation_1',
      'sample_finding_f2_recommendation_2',
      'sample_finding_f2_recommendation_3'
    ],
    clauseReference: 'clause_reference_section_22_1', // MODIFIED: Now a translation key
    created_at: '2025-04-10T14:30:00Z',
    updated_at: '2025-04-10T14:30:00Z',
    analysis_result_id: 'ar1'
  },
  {
    id: 'f3',
    title: 'sample_finding_f3_title',
    description: 'sample_finding_f3_description',
    riskLevel: 'high',
    jurisdiction: 'Others',
    category: 'compliance',
    recommendations: [
      'sample_finding_f3_recommendation_1',
      'sample_finding_f3_recommendation_2',
      'sample_finding_f3_recommendation_3'
    ],
    clauseReference: 'clause_reference_section_8', // MODIFIED: Now a translation key
    created_at: '2025-04-08T09:15:00Z',
    updated_at: '2025-04-08T09:15:00Z',
    analysis_result_id: 'ar2'
  },
  {
    id: 'f4',
    title: 'sample_finding_f4_title',
    description: 'sample_finding_f4_description',
    riskLevel: 'medium',
    jurisdiction: 'Ireland',
    category: 'enforceability',
    recommendations: [
      'sample_finding_f4_recommendation_1',
      'sample_finding_f4_recommendation_2',
      'sample_finding_f4_recommendation_3'
    ],
    clauseReference: 'clause_reference_section_14_2', // MODIFIED: Now a translation key
    created_at: '2025-04-05T16:45:00Z',
    updated_at: '2025-04-05T16:45:00Z',
    analysis_result_id: 'ar3'
  },
  {
    id: 'f5',
    title: 'sample_finding_f5_title',
    description: 'sample_finding_f5_description',
    riskLevel: 'low',
    jurisdiction: 'Others',
    category: 'compliance',
    recommendations: [
      'sample_finding_f5_recommendation_1',
      'sample_finding_f5_recommendation_2',
      'sample_finding_f5_recommendation_3'
    ],
    clauseReference: 'clause_reference_section_17_4', // MODIFIED: Now a translation key
    created_at: '2025-04-02T11:20:00Z',
    updated_at: '2025-04-02T11:20:00Z',
    analysis_result_id: 'ar4'
  },
  {
    id: 'f6',
    title: 'sample_finding_f6_title',
    description: 'sample_finding_f6_description',
    riskLevel: 'medium',
    jurisdiction: 'UK',
    category: 'risk',
    recommendations: [
      'sample_finding_f6_recommendation_1',
      'sample_finding_f6_recommendation_2',
      'sample_finding_f6_recommendation_3'
    ],
    clauseReference: 'clause_reference_n_a', // MODIFIED: Now a translation key
    created_at: '2025-04-10T14:30:00Z',
    updated_at: '2025-04-10T14:30:00Z',
    analysis_result_id: 'ar1'
  },
  {
    id: 'f7',
    title: 'sample_finding_f7_title',
    description: 'sample_finding_f7_description',
    riskLevel: 'high',
    jurisdiction: 'EU',
    category: 'enforceability',
    recommendations: [
      'sample_finding_f7_recommendation_1',
      'sample_finding_f7_recommendation_2',
      'sample_finding_f7_recommendation_3'
    ],
    clauseReference: 'clause_reference_section_18', // MODIFIED: Now a translation key
    created_at: '2025-04-08T09:15:00Z',
    updated_at: '2025-04-08T09:15:00Z',
    analysis_result_id: 'ar2'
  },
  {
    id: 'f8',
    title: 'sample_finding_f8_title',
    description: 'sample_finding_f8_description',
    riskLevel: 'medium',
    jurisdiction: 'US',
    category: 'data-protection',
    recommendations: [
      'sample_finding_f8_recommendation_1',
      'sample_finding_f8_recommendation_2',
      'sample_finding_f8_recommendation_3'
    ],
    clauseReference: 'clause_reference_section_14_2', // MODIFIED: Now a translation key
    created_at: '2025-04-01T10:00:00Z',
    updated_at: '2025-04-01T10:00:00Z',
    analysis_result_id: 'ar5'
  },
  {
    id: 'f9',
    title: 'sample_finding_f9_title',
    description: 'sample_finding_f9_description',
    riskLevel: 'high',
    jurisdiction: 'Canada',
    category: 'compliance',
    recommendations: [
      'sample_finding_f9_recommendation_1',
      'sample_finding_f9_recommendation_2',
      'sample_finding_f9_recommendation_3'
    ],
    clauseReference: 'clause_reference_article_5_1', // MODIFIED: Now a translation key
    created_at: '2025-03-28T14:00:00Z',
    updated_at: '2025-03-28T14:00:00Z',
    analysis_result_id: 'ar6'
  },
  {
    id: 'f10',
    title: 'sample_finding_f10_title',
    description: 'sample_finding_f10_description',
    riskLevel: 'medium',
    jurisdiction: 'Australia',
    category: 'enforceability',
    recommendations: [
      'sample_finding_f10_recommendation_1',
      'sample_finding_f10_recommendation_2',
      'sample_finding_f10_recommendation_3'
    ],
    clauseReference: 'clause_reference_schedule_2_section_23', // MODIFIED: Now a translation key
    created_at: '2025-03-28T14:00:00Z',
    updated_at: '2025-03-28T14:00:00Z',
    analysis_result_id: 'ar6'
  }
];

export const generateSampleAnalysisResult = (contractId: string, jurisdictions: Jurisdiction[]): AnalysisResult => {
  const relevantFindings = allSampleFindings.filter(f => jurisdictions.includes(f.jurisdiction) || f.jurisdiction === 'EU');
  const complianceScore = Math.floor(Math.random() * (95 - 50 + 1)) + 50;

  const executiveSummary = `sample_executive_summary_prefix_${contractId}`;
  const dataProtectionImpact = (jurisdictions.includes('EU') || jurisdictions.includes('UK') || jurisdictions.includes('US') || jurisdictions.includes('Canada') || jurisdictions.includes('Australia') || jurisdictions.includes('Ireland') || jurisdictions.includes('Others')) ?
    'sample_data_protection_impact_detailed' :
    'sample_data_protection_impact_minimal';

  const jurisdictionSummaries: Record<Jurisdiction, JurisdictionSummary> = {};
  jurisdictions.forEach(j => {
    const jFindings = relevantFindings.filter(f => f.jurisdiction === j);
    jurisdictionSummaries[j] = {
      jurisdiction: j,
      applicableLaws: [
        `sample_applicable_law_${j}_1`,
        `sample_applicable_law_${j}_2`
      ],
      keyFindings: jFindings.map(f => f.title),
      riskLevel: jFindings.length > 2 ? 'high' : jFindings.length > 0 ? 'medium' : 'none'
    };
  });

  if (!jurisdictionSummaries['EU'] && relevantFindings.some(f => f.jurisdiction === 'EU')) {
    const euFindings = relevantFindings.filter(f => f.jurisdiction === 'EU');
    jurisdictionSummaries['EU'] = {
      jurisdiction: 'EU',
      applicableLaws: ['sample_applicable_law_EU_GDPR', 'sample_applicable_law_EU_Directive_X'],
      keyFindings: euFindings.map(f => f.title),
      riskLevel: euFindings.length > 0 ? 'high' : 'none'
    };
  }

  if (!jurisdictionSummaries['Others'] && relevantFindings.some(f => f.jurisdiction === 'Others')) {
    const othersFindings = relevantFindings.filter(f => f.jurisdiction === 'Others');
    jurisdictionSummaries['Others'] = {
      jurisdiction: 'Others',
      applicableLaws: ['sample_applicable_law_others_1', 'sample_applicable_law_others_2'],
      keyFindings: othersFindings.map(f => f.title),
      riskLevel: othersFindings.length > 0 ? 'medium' : 'none'
    };
  }

  return {
    id: `ar-${contractId}`,
    contract_id: contractId,
    executiveSummary,
    findings: relevantFindings,
    jurisdictionSummaries,
    dataProtectionImpact,
    complianceScore,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
};

sampleContracts.forEach(contract => {
  if (contract.status === 'completed') {
    contract.analysisResult = generateSampleAnalysisResult(contract.id, contract.jurisdictions);
  }
});