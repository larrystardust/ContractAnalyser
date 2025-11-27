import { AnalysisResult, Contract, Finding, Jurisdiction } from '../types';

export const sampleContracts: Contract[] = [
  {
    id: '1',
    name: 'sample_contract_uk_eu_distribution_agreement', // MODIFIED to key
    created_at: '2025-04-10T14:30:00Z',
    jurisdictions: ['UK', 'EU'],
    status: 'completed',
    size: '1.2 MB',
    analysisResult: undefined // Will be populated by generateSampleAnalysisResult
  },
  {
    id: '2',
    name: 'sample_contract_international_licensing_agreement', // MODIFIED to key
    created_at: '2025-04-08T09:15:00Z',
    jurisdictions: ['Others', 'EU'],
    status: 'completed',
    size: '2.8 MB',
    analysisResult: undefined // Will be populated by generateSampleAnalysisResult
  },
  {
    id: '3',
    name: 'sample_contract_irish_service_level_agreement', // MODIFIED to key
    created_at: '2025-04-05T16:45:00Z',
    jurisdictions: ['Ireland', 'EU'],
    status: 'analyzing', // Keep one analyzing for demo
    size: '0.9 MB',
    processing_progress: 50,
    analysisResult: undefined
  },
  {
    id: '4',
    name: 'sample_contract_cross_border_joint_venture', // MODIFIED to key
    created_at: '2025-04-02T11:20:00Z',
    jurisdictions: ['Others', 'UK'],
    status: 'pending', // Keep one pending for demo
    size: '3.4 MB',
    processing_progress: 0,
    analysisResult: undefined
  },
  {
    id: '5',
    name: 'sample_contract_us_software_licensing_agreement', // MODIFIED to key
    created_at: '2025-04-01T10:00:00Z',
    jurisdictions: ['US'],
    status: 'completed',
    size: '1.5 MB',
    analysisResult: undefined
  },
  {
    id: '6',
    name: 'sample_contract_canada_australia_partnership_deed', // MODIFIED to key
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
    title: 'finding_title_data_transfer_risk',
    description: 'finding_desc_data_transfer_risk',
    riskLevel: 'high',
    jurisdiction: 'EU',
    category: 'data-protection',
    recommendations: [
      'finding_rec_sccs_bcrs',
      'finding_rec_dpia_international_transfers',
      'finding_rec_explicit_consent_international_transfers'
    ],
    clauseReference: 'clause_ref_company_policies',
    created_at: '2025-04-10T14:30:00Z',
    updated_at: '2025-04-10T14:30:00Z',
    analysis_result_id: 'ar1'
  },
  {
    id: 'f2',
    title: 'finding_title_ambiguous_termination_clause',
    description: 'finding_desc_ambiguous_termination_clause',
    riskLevel: 'medium',
    jurisdiction: 'UK',
    category: 'compliance',
    recommendations: [
      'finding_rec_clearly_define_notice_periods',
      'finding_rec_specify_termination_conditions',
      'finding_rec_include_dispute_resolution'
    ],
    clauseReference: 'clause_ref_probationary_period',
    created_at: '2025-04-10T14:30:00Z',
    updated_at: '2025-04-10T14:30:00Z',
    analysis_result_id: 'ar1'
  },
  {
    id: 'f3',
    title: 'finding_title_unspecified_governing_law',
    description: 'finding_desc_unspecified_governing_law',
    riskLevel: 'high',
    jurisdiction: 'Others',
    category: 'compliance',
    recommendations: [
      'finding_rec_clearly_state_governing_law',
      'finding_rec_consider_well_established_jurisdiction',
      'finding_rec_ensure_consistency_governing_law'
    ],
    clauseReference: 'clause_ref_governing_law',
    created_at: '2025-04-08T09:15:00Z',
    updated_at: '2025-04-08T09:15:00Z',
    analysis_result_id: 'ar2'
  },
  {
    id: 'f4',
    title: 'finding_title_limited_liability_cap',
    description: 'finding_desc_limited_liability_cap',
    riskLevel: 'medium',
    jurisdiction: 'Ireland',
    category: 'enforceability',
    recommendations: [
      'finding_rec_re_evaluate_liability_cap',
      'finding_rec_consider_carve_outs',
      'finding_rec_ensure_cap_insurable'
    ],
    clauseReference: 'clause_ref_liability_cap',
    created_at: '2025-04-05T16:45:00Z',
    updated_at: '2025-04-05T16:45:00Z',
    analysis_result_id: 'ar3'
  },
  {
    id: 'f5',
    title: 'finding_title_minor_formatting_inconsistencies',
    description: 'finding_desc_minor_formatting_inconsistencies',
    riskLevel: 'low',
    jurisdiction: 'Others',
    category: 'compliance',
    recommendations: [
      'finding_rec_thorough_review_formatting',
      'finding_rec_utilize_automated_tools',
      'finding_rec_ensure_cross_references_accurate'
    ],
    clauseReference: 'clause_ref_formatting',
    created_at: '2025-04-02T11:20:00Z',
    updated_at: '2025-04-02T11:20:00Z',
    analysis_result_id: 'ar4'
  },
  {
    id: 'f6',
    title: 'finding_title_lack_of_indemnification_clause',
    description: 'finding_desc_lack_of_indemnification_clause',
    riskLevel: 'medium',
    jurisdiction: 'UK',
    category: 'risk',
    recommendations: [
      'finding_rec_add_mutual_indemnification',
      'finding_rec_specify_scope_indemnification',
      'finding_rec_ensure_indemnification_aligns'
    ],
    clauseReference: 'clause_ref_indemnification',
    created_at: '2025-04-10T14:30:00Z',
    updated_at: '2025-04-10T14:30:00Z',
    analysis_result_id: 'ar1'
  },
  {
    id: 'f7',
    title: 'finding_title_gdpr_compliance_gaps',
    description: 'finding_desc_gdpr_compliance_gaps',
    riskLevel: 'high',
    jurisdiction: 'EU',
    category: 'enforceability',
    recommendations: [
      'finding_rec_integrate_dpa',
      'finding_rec_define_roles_responsibilities',
      'finding_rec_include_data_breach_notification'
    ],
    clauseReference: 'clause_ref_data_processing',
    created_at: '2025-04-08T09:15:00Z',
    updated_at: '2025-04-08T09:15:00Z',
    analysis_result_id: 'ar2'
  },
  {
    id: 'f8',
    title: 'finding_title_ccpa_compliance_concerns',
    description: 'finding_desc_ccpa_compliance_concerns',
    riskLevel: 'medium',
    jurisdiction: 'US',
    category: 'data-protection',
    recommendations: [
      'finding_rec_review_update_ccpa',
      'finding_rec_ensure_mechanisms_ccpa',
      'finding_rec_consult_us_privacy_expert'
    ],
    clauseReference: 'clause_ref_consumer_rights',
    created_at: '2025-04-01T10:00:00Z',
    updated_at: '2025-04-01T10:00:00Z',
    analysis_result_id: 'ar5'
  },
  {
    id: 'f9',
    title: 'finding_title_pipeda_non_compliance',
    description: 'finding_desc_pipeda_non_compliance',
    riskLevel: 'high',
    jurisdiction: 'Canada',
    category: 'compliance',
    recommendations: [
      'finding_rec_incorporate_consent_pipeda',
      'finding_rec_detail_data_security_pipeda',
      'finding_rec_ensure_transparency_pipeda'
    ],
    clauseReference: 'clause_ref_data_privacy',
    created_at: '2025-03-28T14:00:00Z',
    updated_at: '2025-03-28T14:00:00Z',
    analysis_result_id: 'ar6'
  },
  {
    id: 'f10',
    title: 'finding_title_australian_consumer_law_discrepancies',
    description: 'finding_desc_australian_consumer_law_discrepancies',
    riskLevel: 'medium',
    jurisdiction: 'Australia',
    category: 'enforceability',
    recommendations: [
      'finding_rec_review_acl_compliance',
      'finding_rec_ensure_representations_accurate',
      'finding_rec_seek_legal_advice_australian_law'
    ],
    clauseReference: 'clause_ref_consumer_law',
    created_at: '2025-03-28T14:00:00Z',
    updated_at: '2025-03-28T14:00:00Z',
    analysis_result_id: 'ar6'
  },
  { // ADDED: New finding for Pension & retirement
    id: 'f11',
    title: 'finding_title_ambiguity_in_pension_options',
    description: 'finding_desc_ambiguity_in_pension_options',
    riskLevel: 'low',
    jurisdiction: 'UK',
    category: 'commercial',
    recommendations: [
      'finding_rec_clarify_pension_plan',
      'finding_rec_ensure_pension_compliance',
      'finding_rec_provide_pension_enrollment_instructions'
    ],
    clauseReference: 'clause_ref_pension_retirement',
    created_at: '2025-09-18T10:00:00Z',
    updated_at: '2025-09-18T10:00:00Z',
    analysis_result_id: 'ar1' // Assign to an existing analysis result for demo
  }
];

export const generateSampleAnalysisResult = (contractId: string, jurisdictions: Jurisdiction[]): AnalysisResult => {
  const relevantFindings = allSampleFindings.filter(f => jurisdictions.includes(f.jurisdiction) || f.jurisdiction === 'EU');
  const complianceScore = Math.floor(Math.random() * (95 - 50 + 1)) + 50;

  const executiveSummary = 'executive_summary_template';
  const dataProtectionImpact = (jurisdictions.includes('EU') || jurisdictions.includes('UK') || jurisdictions.includes('US') || jurisdictions.includes('Canada') || jurisdictions.includes('Australia') || jurisdictions.includes('Ireland') || jurisdictions.includes('Others')) ?
    'data_protection_impact_template_detailed' :
    'data_protection_impact_template_minimal';

  const jurisdictionSummaries: Record<Jurisdiction, JurisdictionSummary> = {};
  jurisdictions.forEach(j => {
    const jFindings = relevantFindings.filter(f => f.jurisdiction === j);
    jurisdictionSummaries[j] = {
      jurisdiction: j,
      applicableLaws: [
        `applicable_law_general_contract_law_${j}`,
        `applicable_law_commercial_code_${j}`
      ],
      keyFindings: jFindings.map(f => f.title),
      riskLevel: jFindings.length > 2 ? 'high' : jFindings.length > 0 ? 'medium' : 'none'
    };
  });

  if (!jurisdictionSummaries['EU'] && relevantFindings.some(f => f.jurisdiction === 'EU')) {
    const euFindings = relevantFindings.filter(f => f.jurisdiction === 'EU');
    jurisdictionSummaries['EU'] = {
      jurisdiction: 'EU',
      applicableLaws: ['applicable_law_gdpr', 'applicable_law_eprivacy_directive'],
      keyFindings: euFindings.map(f => f.title),
      riskLevel: euFindings.length > 0 ? 'high' : 'none'
    };
  }

  if (!jurisdictionSummaries['Others'] && relevantFindings.some(f => f.jurisdiction === 'Others')) {
    const othersFindings = relevantFindings.filter(f => f.jurisdiction === 'Others');
    jurisdictionSummaries['Others'] = {
      jurisdiction: 'Others',
      applicableLaws: ['applicable_law_international_commercial_principles', 'applicable_law_private_international_law'],
      keyFindings: othersFindings.map(f => f.title),
      riskLevel: othersFindings.length > 0 ? 'medium' : 'none'
    };
  }

  const baseAnalysisResult: AnalysisResult = {
    id: `ar-${contractId}`,
    contract_id: contractId,
    executiveSummary,
    findings: relevantFindings,
    jurisdictionSummaries,
    dataProtectionImpact,
    complianceScore,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    performedAdvancedAnalysis: false, // Default to false
  };

  // ADDED: Specific advanced analysis details for contract ID 2
  if (contractId === '2') {
    return {
      ...baseAnalysisResult,
      performedAdvancedAnalysis: true,
      effectiveDate: '2025-01-01',
      terminationDate: '2030-12-31',
      renewalDate: '2026-01-01',
      contractType: 'contract_type_licensing_agreement', // Use translation key
      contractValue: 'contract_value_5m_usd', // Use translation key
      parties: ['parties_licensor_inc', 'parties_global_distributor_ltd'], // Use translation keys
      liabilityCapSummary: 'liability_cap_summary_2x_annual_fees', // Use translation key
      indemnificationClauseSummary: 'indemnification_clause_summary_mutual_breaches_ip', // Use translation key
      confidentialityObligationsSummary: 'confidentiality_obligations_summary_perpetual', // Use translation key
      redlinedClauseArtifactsData: [
        {
          originalClause: 'original_clause_licensor_indemnify_defects', // Use translation key
          redlinedVersion: 'redlined_version_licensor_indemnify_defects_misuse', // Use translation key
          suggestedRevision: 'suggested_revision_clarify_indemnification_scope' // Use translation key
        }
      ]
    };
  }

  // ADDED: Specific advanced analysis details for contract ID 6
  if (contractId === '6') {
    return {
      ...baseAnalysisResult,
      performedAdvancedAnalysis: true,
      effectiveDate: '2024-06-15',
      terminationDate: '2029-06-14',
      renewalDate: '2025-06-15',
      contractType: 'contract_type_partnership_deed', // Use translation key
      contractValue: 'contract_value_not_specified', // Use translation key
      parties: ['parties_canadian_partner_corp', 'parties_australian_ventures_pty_ltd'], // Use translation keys
      liabilityCapSummary: 'liability_cap_summary_capital_contribution', // Use translation key
      indemnificationClauseSummary: 'indemnification_clause_summary_cross_indemnification', // Use translation key
      confidentialityObligationsSummary: 'confidentiality_obligations_summary_partnership_2_years', // Use translation key
      redlinedClauseArtifactsData: [
        {
          originalClause: 'original_clause_governing_law_ontario', // Use translation key
          redlinedVersion: 'redlined_version_governing_law_ontario_nsw', // Use translation key
          suggestedRevision: 'suggested_revision_include_australian_jurisdiction' // Use translation key
        },
        {
          originalClause: 'original_clause_disputes_arbitration_toronto', // Use translation key
          redlinedVersion: 'redlined_version_disputes_arbitration_toronto_sydney', // Use translation key
          suggestedRevision: 'suggested_revision_flexibility_dispute_resolution' // Use translation key
        }
      ]
    };
  }

  return baseAnalysisResult;
};

sampleContracts.forEach(contract => {
  if (contract.status === 'completed') {
    contract.analysisResult = generateSampleAnalysisResult(contract.id, contract.jurisdictions);
  }
});