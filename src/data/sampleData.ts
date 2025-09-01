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
    title: 'Non-compliant GDPR Data Processing Clause',
    description: 'The data processing clause does not meet current GDPR requirements for processor obligations.',
    riskLevel: 'high',
    jurisdiction: 'EU',
    category: 'data-protection',
    recommendations: [
      'Include specific processor obligations under Article 28 GDPR',
      'Add data breach notification timeframes',
      'Specify data subject rights handling procedures'
    ],
    clauseReference: 'Section 12.3',
    created_at: '2025-04-10T14:30:00Z', // ADDED
    updated_at: '2025-04-10T14:30:00Z', // ADDED
    analysis_result_id: 'ar1' // Placeholder
  },
  {
    id: 'f2',
    title: 'Post-Brexit Governing Law Ambiguity',
    description: 'The governing law clause does not clearly address post-Brexit application of EU regulations.',
    riskLevel: 'medium',
    jurisdiction: 'UK',
    category: 'compliance',
    recommendations: [
      'Clarify which specific EU regulations will continue to apply',
      'Reference UK statutory instruments that replaced EU regulations',
      'Include specific dispute resolution mechanism for regulatory conflicts'
    ],
    clauseReference: 'Section 22.1',
    created_at: '2025-04-10T14:30:00Z', // ADDED
    updated_at: '2025-04-10T14:30:00Z', // ADDED
    analysis_result_id: 'ar1' // Placeholder
  },
  {
    id: 'f3',
    title: 'International Regulatory Compliance Gap', // MODIFIED: Renamed from Malta
    description: 'The agreement lacks required provisions under international gaming regulations.', // MODIFIED: Generic description
    riskLevel: 'high',
    jurisdiction: 'Others', // MODIFIED: Changed to 'Others'
    category: 'compliance',
    recommendations: [
      'Add responsible gaming requirements specific to relevant international standards',
      'Include player fund segregation provisions as per international best practices',
      'Reference relevant international gaming license requirements'
    ],
    clauseReference: 'Section 8',
    created_at: '2025-04-08T09:15:00Z', // ADDED
    updated_at: '2025-04-08T09:15:00Z', // ADDED
    analysis_result_id: 'ar2' // Placeholder
  },
  {
    id: 'f4',
    title: 'Potentially Unfair Limitation of Liability',
    description: 'The limitation of liability clause may be deemed unfair under Irish consumer law.',
    riskLevel: 'medium',
    jurisdiction: 'Ireland',
    category: 'enforceability',
    recommendations: [
      'Modify clause to exclude liability for death or personal injury',
      'Remove limitations for gross negligence',
      'Apply proportionate caps based on contract value'
    ],
    clauseReference: 'Section 14.2',
    created_at: '2025-04-05T16:45:00Z', // ADDED
    updated_at: '2025-04-05T16:45:00Z', // ADDED
    analysis_result_id: 'ar3' // Placeholder
  },
  {
    id: 'f5',
    title: 'Inadequate International Tax Provisions', // MODIFIED: Renamed from Cyprus
    description: 'The tax provisions do not address international withholding tax requirements.', // MODIFIED: Generic description
    riskLevel: 'low',
    jurisdiction: 'Others', // MODIFIED: Changed to 'Others'
    category: 'compliance',
    recommendations: [
      'Include specific reference to international withholding tax rates',
      'Add tax residency certification requirements',
      'Reference double taxation treaty provisions if applicable'
    ],
    clauseReference: 'Section 17.4',
    created_at: '2025-04-02T11:20:00Z', // ADDED
    updated_at: '2025-04-02T11:20:00Z', // ADDED
    analysis_result_id: 'ar4' // Placeholder
  },
  {
    id: 'f6',
    title: 'Missing Force Majeure Clause',
    description: 'The contract lacks a comprehensive force majeure clause, leaving parties exposed to unforeseen events.',
    riskLevel: 'medium',
    jurisdiction: 'UK',
    category: 'risk',
    recommendations: [
      'Add a standard force majeure clause covering natural disasters, pandemics, etc.',
      'Define clear procedures for invoking force majeure',
      'Specify consequences of force majeure events on contractual obligations'
    ],
    clauseReference: 'N/A',
    created_at: '2025-04-10T14:30:00Z', // ADDED
    updated_at: '2025-04-10T14:30:00Z', // ADDED
    analysis_result_id: 'ar1' // Placeholder
  },
  {
    id: 'f7',
    title: 'Ambiguous Termination Rights',
    description: 'The termination clause is vague regarding conditions for termination for convenience or cause.',
    riskLevel: 'high',
    jurisdiction: 'EU',
    category: 'enforceability',
    recommendations: [
      'Clearly define events of default and cure periods',
      'Specify notice periods for termination for convenience',
      'Outline post-termination obligations and rights'
    ],
    clauseReference: 'Section 18',
    created_at: '2025-04-08T09:15:00Z', // ADDED
    updated_at: '2025-04-08T09:15:00Z', // ADDED
    analysis_result_id: 'ar2' // Placeholder
  },
  {
    id: 'f8',
    title: 'US State-Specific Consumer Protection',
    description: 'The contract may not fully comply with California Consumer Privacy Act (CCPA) requirements.',
    riskLevel: 'medium',
    jurisdiction: 'US',
    category: 'data-protection',
    recommendations: [
      'Review and update data handling practices for California residents',
      'Ensure proper consumer rights (e.g., right to know, delete, opt-out) are addressed',
      'Consult with legal counsel for state-specific compliance'
    ],
    clauseReference: 'Section 14.2',
    created_at: '2025-04-01T10:00:00Z', // ADDED
    updated_at: '2025-04-01T10:00:00Z', // ADDED
    analysis_result_id: 'ar5' // Placeholder
  },
  {
    id: 'f9',
    title: 'Canadian Anti-Spam Legislation (CASL) Compliance',
    description: 'The marketing consent clauses may not fully comply with CASL requirements for express consent.',
    riskLevel: 'high',
    jurisdiction: 'Canada',
    category: 'compliance',
    recommendations: [
      'Review consent mechanisms to ensure they meet CASL standards',
      'Implement clear opt-in processes for commercial electronic messages',
      'Ensure proper identification of sender and unsubscribe mechanisms'
    ],
    clauseReference: 'Article 5.1',
    created_at: '2025-03-28T14:00:00Z', // ADDED
    updated_at: '2025-03-28T14:00:00Z', // ADDED
    analysis_result_id: 'ar6' // Placeholder
  },
  {
    id: 'f10',
    title: 'Australian Consumer Law (ACL) Unfair Contract Terms',
    description: 'Certain clauses might be deemed unfair under the Australian Consumer Law, especially for small businesses.',
    riskLevel: 'medium',
    jurisdiction: 'Australia',
    category: 'enforceability',
    recommendations: [
      'Assess clauses for potential imbalance, lack of transparency, or detriment to a party',
      'Ensure terms are reasonably necessary to protect legitimate interests',
      'Seek legal advice on specific clauses under ACL'
    ],
    clauseReference: 'Schedule 2, Section 23',
    created_at: '2025-03-28T14:00:00Z', // ADDED
    updated_at: '2025-03-28T14:00:00Z', // ADDED
    analysis_result_id: 'ar6' // Placeholder
  }
];

export const generateSampleAnalysisResult = (contractId: string, jurisdictions: Jurisdiction[]): AnalysisResult => {
  // Filter findings based on the new jurisdiction list.
  // If a contract has 'Others', it will include findings marked 'Others'.
  const relevantFindings = allSampleFindings.filter(f => jurisdictions.includes(f.jurisdiction) || f.jurisdiction === 'EU');
  const complianceScore = Math.floor(Math.random() * (95 - 50 + 1)) + 50; // Random score between 50 and 95

  const executiveSummary = `This contract (ID: ${contractId}) has been analyzed. It contains several compliance and risk issues across the specified jurisdictions. The overall compliance score is ${complianceScore}%. Further review of specific findings is recommended.`;
  const dataProtectionImpact = (jurisdictions.includes('EU') || jurisdictions.includes('UK') || jurisdictions.includes('US') || jurisdictions.includes('Canada') || jurisdictions.includes('Australia') || jurisdictions.includes('Ireland') || jurisdictions.includes('Others')) ? // MODIFIED: Added 'Others'
    'The contract involves data processing activities that fall under relevant data protection regulations. Specific clauses need review to ensure full compliance with data transfer mechanisms and data subject rights.' :
    'Data protection impact is minimal as the contract does not involve significant personal data processing or cross-border transfers in regulated jurisdictions.';

  const jurisdictionSummaries: Record<Jurisdiction, JurisdictionSummary> = {};
  jurisdictions.forEach(j => {
    const jFindings = relevantFindings.filter(f => f.jurisdiction === j);
    jurisdictionSummaries[j] = {
      jurisdiction: j,
      applicableLaws: [
        `${j} Law 1`,
        `${j} Law 2`
      ],
      keyFindings: jFindings.map(f => f.title),
      riskLevel: jFindings.length > 2 ? 'high' : jFindings.length > 0 ? 'medium' : 'none'
    };
  });

  // Add EU summary if not already present and relevant findings exist
  if (!jurisdictionSummaries['EU'] && relevantFindings.some(f => f.jurisdiction === 'EU')) {
    const euFindings = relevantFindings.filter(f => f.jurisdiction === 'EU');
    jurisdictionSummaries['EU'] = {
      jurisdiction: 'EU',
      applicableLaws: ['GDPR (Regulation 2016/679)', 'EU Directive X'],
      keyFindings: euFindings.map(f => f.title),
      riskLevel: euFindings.length > 0 ? 'high' : 'none'
    };
  }

  // Ensure 'Others' is included if relevant findings exist for it
  if (!jurisdictionSummaries['Others'] && relevantFindings.some(f => f.jurisdiction === 'Others')) {
    const othersFindings = relevantFindings.filter(f => f.jurisdiction === 'Others');
    jurisdictionSummaries['Others'] = {
      jurisdiction: 'Others',
      applicableLaws: ['International Law 1', 'Global Standard 2'],
      keyFindings: othersFindings.map(f => f.title),
      riskLevel: othersFindings.length > 0 ? 'medium' : 'none'
    };
  }


  return {
    id: `ar-${contractId}`, // Placeholder ID for analysis result
    contract_id: contractId,
    executiveSummary,
    findings: relevantFindings,
    jurisdictionSummaries, // ADDED
    dataProtectionImpact,
    complianceScore,
    created_at: new Date().toISOString(), // Placeholder
    updated_at: new Date().toISOString(), // Placeholder
  };
};

// Initialize sample contracts with analysis results
sampleContracts.forEach(contract => {
  if (contract.status === 'completed') {
    contract.analysisResult = generateSampleAnalysisResult(contract.id, contract.jurisdictions);
  }
});