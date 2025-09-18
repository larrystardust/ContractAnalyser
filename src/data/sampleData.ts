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
    title: 'Data Transfer Risk', // MODIFIED: Actual string
    description: 'The contract allows for data transfer to third countries without specifying adequate safeguards, potentially violating GDPR.', // MODIFIED: Actual string
    riskLevel: 'high',
    jurisdiction: 'EU',
    category: 'data-protection',
    recommendations: [
      'Implement Standard Contractual Clauses (SCCs) or Binding Corporate Rules (BCRs).', // MODIFIED: Actual string
      'Conduct a Data Protection Impact Assessment (DPIA) for all international data transfers.', // MODIFIED: Actual string
      'Ensure explicit consent from data subjects for international transfers.' // MODIFIED: Actual string
    ],
    clauseReference: 'Section 12.3', // MODIFIED: Actual string
    created_at: '2025-04-10T14:30:00Z',
    updated_at: '2025-04-10T14:30:00Z',
    analysis_result_id: 'ar1'
  },
  {
    id: 'f2',
    title: 'Ambiguous Termination Clause', // MODIFIED: Actual string
    description: 'The contract\'s termination clause is unclear regarding notice periods and conditions for termination for convenience, leading to potential disputes.', // MODIFIED: Actual string
    riskLevel: 'medium',
    jurisdiction: 'UK',
    category: 'compliance',
    recommendations: [
      'Clearly define notice periods for all types of termination.', // MODIFIED: Actual string
      'Specify conditions under which termination for convenience can be exercised.', // MODIFIED: Actual string
      'Include a clear dispute resolution mechanism for termination-related issues.' // MODIFIED: Actual string
    ],
    clauseReference: 'Section 22.1', // MODIFIED: Actual string
    created_at: '2025-04-10T14:30:00Z',
    updated_at: '2025-04-10T14:30:00Z',
    analysis_result_id: 'ar1'
  },
  {
    id: 'f3',
    title: 'Unspecified Governing Law', // MODIFIED: Actual string
    description: 'The contract fails to explicitly state the governing law, which could lead to complex and costly legal battles in international disputes.', // MODIFIED: Actual string
    riskLevel: 'high',
    jurisdiction: 'Others',
    category: 'compliance',
    recommendations: [
      'Clearly state the governing law for the contract.', // MODIFIED: Actual string
      'Consider a jurisdiction with a well-established commercial law framework.', // MODIFIED: Actual string
      'Ensure consistency between governing law and dispute resolution clauses.' // MODIFIED: Actual string
    ],
    clauseReference: 'Section 8', // MODIFIED: Actual string
    created_at: '2025-04-08T09:15:00Z',
    updated_at: '2025-04-08T09:15:00Z',
    analysis_result_id: 'ar2'
  },
  {
    id: 'f4',
    title: 'Limited Liability Cap', // MODIFIED: Actual string
    description: 'The liability cap is set too low, potentially exposing the client to significant financial risk in case of major breaches or damages.', // MODIFIED: Actual string
    riskLevel: 'medium',
    jurisdiction: 'Ireland',
    category: 'enforceability',
    recommendations: [
      'Re-evaluate the liability cap to align with potential damages and industry standards.', // MODIFIED: Actual string
      'Consider carve-outs for gross negligence or willful misconduct.', // MODIFIED: Actual string
      'Ensure the cap is insurable and reflects the risk profile of the services.' // MODIFIED: Actual string
    ],
    clauseReference: 'Section 14.2', // MODIFIED: Actual string
    created_at: '2025-04-05T16:45:00Z',
    updated_at: '2025-04-05T16:45:00Z',
    analysis_result_id: 'ar3'
  },
  {
    id: 'f5',
    title: 'Minor Formatting Inconsistencies', // MODIFIED: Actual string
    description: 'Minor inconsistencies in formatting and numbering were found, which could lead to misinterpretation in complex clauses.', // MODIFIED: Actual string
    riskLevel: 'low',
    jurisdiction: 'Others',
    category: 'compliance',
    recommendations: [
      'Conduct a thorough review for formatting consistency.', // MODIFIED: Actual string
      'Utilize automated formatting tools for future drafting.', // MODIFIED: Actual string
      'Ensure all cross-references are accurate and up-to-date.' // MODIFIED: Actual string
    ],
    clauseReference: 'Section 17.4', // MODIFIED: Actual string
    created_at: '2025-04-02T11:20:00Z',
    updated_at: '2025-04-02T11:20:00Z',
    analysis_result_id: 'ar4'
  },
  {
    id: 'f6',
    title: 'Lack of Indemnification Clause', // MODIFIED: Actual string
    description: 'The contract lacks a comprehensive indemnification clause, leaving parties exposed to third-party claims arising from the contract\'s performance.', // MODIFIED: Actual string
    riskLevel: 'medium',
    jurisdiction: 'UK',
    category: 'risk',
    recommendations: [
      'Add a mutual indemnification clause covering typical business risks.', // MODIFIED: Actual string
      'Specify the scope and limitations of indemnification.', // MODIFIED: Actual string
      'Ensure indemnification aligns with insurance coverage.' // MODIFIED: Actual string
    ],
    clauseReference: 'N/A', // MODIFIED: Actual string
    created_at: '2025-04-10T14:30:00Z',
    updated_at: '2025-04-10T14:30:00Z',
    analysis_result_id: 'ar1'
  },
  {
    id: 'f7',
    title: 'GDPR Compliance Gaps', // MODIFIED: Actual string
    description: 'The contract does not fully address GDPR requirements for data processing agreements, particularly regarding data breach notification and sub-processor obligations.', // MODIFIED: Actual string
    riskLevel: 'high',
    jurisdiction: 'EU',
    category: 'enforceability',
    recommendations: [
      'Integrate a comprehensive Data Processing Addendum (DPA) compliant with GDPR Article 28.', // MODIFIED: Actual string
      'Clearly define roles and responsibilities for data controllers and processors.', // MODIFIED: Actual string
      'Include specific clauses on data breach notification procedures and timelines.' // MODIFIED: Actual string
    ],
    clauseReference: 'Section 18', // MODIFIED: Actual string
    created_at: '2025-04-08T09:15:00Z',
    updated_at: '2025-04-08T09:15:00Z',
    analysis_result_id: 'ar2'
  },
  {
    id: 'f8',
    title: 'CCPA Compliance Concerns', // MODIFIED: Actual string
    description: 'The contract does not adequately address consumer rights under the California Consumer Privacy Act (CCPA), such as the right to opt-out of data sales.', // MODIFIED: Actual string
    riskLevel: 'medium',
    jurisdiction: 'US',
    category: 'data-protection',
    recommendations: [
      'Review and update data handling clauses to comply with CCPA requirements.', // MODIFIED: Actual string
      'Ensure mechanisms for consumers to exercise their CCPA rights are clearly outlined.', // MODIFIED: Actual string
      'Consult with a US privacy law expert for specific guidance.' // MODIFIED: Actual string
    ],
    clauseReference: 'Section 14.2', // MODIFIED: Actual string
    created_at: '2025-04-01T10:00:00Z',
    updated_at: '2025-04-01T10:00:00Z',
    analysis_result_id: 'ar5'
  },
  {
    id: 'f9',
    title: 'PIPEDA Non-Compliance', // MODIFIED: Actual string
    description: 'The contract lacks specific provisions for consent and data security as required by the Personal Information Protection and Electronic Documents Act (PIPEDA) in Canada.', // MODIFIED: Actual string
    riskLevel: 'high',
    jurisdiction: 'Canada',
    category: 'compliance',
    recommendations: [
      'Incorporate explicit consent mechanisms for personal information collection and use.', // MODIFIED: Actual string
      'Detail data security measures in line with PIPEDA\'s fair information principles.', // MODIFIED: Actual string
      'Ensure transparency regarding data handling practices.' // MODIFIED: Actual string
    ],
    clauseReference: 'Article 5.1', // MODIFIED: Actual string
    created_at: '2025-03-28T14:00:00Z',
    updated_at: '2025-03-28T14:00:00Z',
    analysis_result_id: 'ar6'
  },
  {
    id: 'f10',
    title: 'Australian Consumer Law Discrepancies', // MODIFIED: Actual string
    description: 'Certain clauses may be deemed unfair or misleading under the Australian Consumer Law (ACL), potentially rendering them unenforceable.', // MODIFIED: Actual string
    riskLevel: 'medium',
    jurisdiction: 'Australia',
    category: 'enforceability',
    recommendations: [
      'Review clauses for compliance with ACL unfair contract terms provisions.', // MODIFIED: Actual string
      'Ensure all representations are accurate and not misleading.', // MODIFIED: Actual string
      'Seek legal advice on specific clauses under Australian law.' // MODIFIED: Actual string
    ],
    clauseReference: 'Schedule 2, Section 23', // MODIFIED: Actual string
    created_at: '2025-03-28T14:00:00Z',
    updated_at: '2025-03-28T14:00:00Z',
    analysis_result_id: 'ar6'
  }
];

export const generateSampleAnalysisResult = (contractId: string, jurisdictions: Jurisdiction[]): AnalysisResult => {
  const relevantFindings = allSampleFindings.filter(f => jurisdictions.includes(f.jurisdiction) || f.jurisdiction === 'EU');
  const complianceScore = Math.floor(Math.random() * (95 - 50 + 1)) + 50;

  const executiveSummary = `This contract analysis for ${contractId} reveals a compliance score of ${complianceScore}%. The document generally adheres to legal standards, but specific areas require attention to mitigate potential risks and ensure full enforceability.`; // MODIFIED: Actual string
  const dataProtectionImpact = (jurisdictions.includes('EU') || jurisdictions.includes('UK') || jurisdictions.includes('US') || jurisdictions.includes('Canada') || jurisdictions.includes('Australia') || jurisdictions.includes('Ireland') || jurisdictions.includes('Others')) ?
    'The contract involves the processing of personal data, necessitating careful consideration of data protection regulations. Key areas of impact include data transfer mechanisms, consent requirements, and data security protocols. Compliance with GDPR, CCPA, or PIPEDA may require additional clauses or amendments to ensure robust data protection and avoid regulatory penalties.' : // MODIFIED: Actual string
    'The contract has minimal data protection impact, primarily focusing on general confidentiality. No significant personal data processing or cross-border transfers are identified that would trigger specific data protection regulations.'; // MODIFIED: Actual string

  const jurisdictionSummaries: Record<Jurisdiction, JurisdictionSummary> = {};
  jurisdictions.forEach(j => {
    const jFindings = relevantFindings.filter(f => f.jurisdiction === j);
    jurisdictionSummaries[j] = {
      jurisdiction: j,
      applicableLaws: [
        `General Contract Law of ${j}`, // MODIFIED: Actual string
        `Commercial Code of ${j}` // MODIFIED: Actual string
      ],
      keyFindings: jFindings.map(f => f.title),
      riskLevel: jFindings.length > 2 ? 'high' : jFindings.length > 0 ? 'medium' : 'none'
    };
  });

  if (!jurisdictionSummaries['EU'] && relevantFindings.some(f => f.jurisdiction === 'EU')) {
    const euFindings = relevantFindings.filter(f => f.jurisdiction === 'EU');
    jurisdictionSummaries['EU'] = {
      jurisdiction: 'EU',
      applicableLaws: ['General Data Protection Regulation (GDPR)', 'ePrivacy Directive'], // MODIFIED: Actual string
      keyFindings: euFindings.map(f => f.title),
      riskLevel: euFindings.length > 0 ? 'high' : 'none'
    };
  }

  if (!jurisdictionSummaries['Others'] && relevantFindings.some(f => f.jurisdiction === 'Others')) {
    const othersFindings = relevantFindings.filter(f => f.jurisdiction === 'Others');
    jurisdictionSummaries['Others'] = {
      jurisdiction: 'Others',
      applicableLaws: ['International Commercial Law Principles', 'Private International Law'], // MODIFIED: Actual string
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