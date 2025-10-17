export interface Contract {
  id: string; // Changed to string for UUID
  user_id: string; // Added for Supabase foreign key
  name: string;
  translated_name?: string; // ADDED: New field for translated contract name
  file_path: string; // Added for Supabase Storage path
  original_file_type?: string; // ADDED: New field to store original file type
  size: string;
  jurisdictions: Jurisdiction[];
  status: 'pending' | 'analyzing' | 'completed' | 'failed' | 'ocr_failed'; // ADDED 'ocr_failed'
  processing_progress?: number;
  analysisResult?: AnalysisResult;
  created_at: string; // Changed from uploadDate
  updated_at: string; // Added
  output_language?: AnalysisLanguage; // ADDED: New column for output language
  contract_content?: string; // ADDED: Ensure contract_content is part of the Contract interface
}

export type Jurisdiction = 'UK' | 'EU' | 'Ireland' | 'US' | 'Canada' | 'Australia' | 'Islamic Law' | 'Others'; // MODIFIED: Added 'Islamic Law'

export type RiskLevel = 'high' | 'medium' | 'low' | 'none';

export interface Finding {
  id: string; // Changed to string for UUID
  analysis_result_id: string; // Added foreign key
  title: string;
  description: string;
  riskLevel: RiskLevel;
  jurisdiction: Jurisdiction;
  category: 'compliance' | 'risk' | 'data-protection' | 'enforceability';
  recommendations: string[];
  clauseReference?: string;
  created_at: string; // Added
  updated_at: string; // Added
}

export interface AnalysisResult {
  id: string; // Added for UUID
  contract_id: string; // Added foreign key
  executiveSummary: string;
  findings: Finding[];
  jurisdictionSummaries: Record<Jurisdiction, JurisdictionSummary>;
  dataProtectionImpact?: string;
  complianceScore: number; // 0-100
  reportFilePath?: string | null; // ADDED: Path to the generated HTML report
  created_at: string; // Added
  updated_at: string; // Added
  // ADDED: New fields for advanced analysis
  effectiveDate?: string | null; // YYYY-MM-DD
  terminationDate?: string | null; // YYYY-MM-DD
  renewalDate?: string | null; // YYYY-MM-DD
  contractType?: string | null;
  contractValue?: string | null;
  parties?: string[] | null;
  liabilityCapSummary?: string | null;
  indemnificationClauseSummary?: string | null;
  confidentialityObligationsSummary?: string | null;
}

export interface JurisdictionSummary {
  jurisdiction: Jurisdiction;
  applicableLaws: string[];
  keyFindings: string[];
  riskLevel: RiskLevel;
}

// MODIFIED: New interface for simplified demo analysis result, now including advanced fields
export interface DemoAnalysisResult {
  executiveSummary: string;
  overallRiskLevel: RiskLevel;
  keyFindingTitle?: string;
  keyFindingDescription?: string;
  complianceScore: number;
  // ADDED: New fields for advanced analysis in demo results
  effectiveDate?: string | null; // YYYY-MM-DD
  terminationDate?: string | null; // YYYY-MM-DD
  renewalDate?: string | null; // YYYY-MM-DD
  contractType?: string | null;
  contractValue?: string | null;
  parties?: string[] | null;
  liabilityCapSummary?: string | null;
  indemnificationClauseSummary?: string | null;
  confidentialityObligationsSummary?: string | null;
}

// StripeProduct interface moved to supabase/functions/_shared/stripe_product_types.ts
// This is the correct place for the StripeProduct interface definition
export interface StripeProduct {
  id: string;
  name: string;
  description: string;
  mode: 'subscription' | 'payment' | 'admin_assigned';
  fileRetentionPolicy?: string;
  maxFiles?: number; // ADDED: Max files for the plan
  max_users?: number; // ADDED: Max users for the plan
  credits?: number; // ADDED: New field for single-use credits
  tier: number;
  pricing: {
    monthly?: { priceId: string; price: number; interval: 'month' };
    yearly?: { priceId: string; price: number; interval: 'year' };
    one_time?: { priceId: string; price: number; interval: 'one_time' };
  };
}

// ADDED: New type for analysis languages
export type AnalysisLanguage = 'en' | 'fr' | 'es' | 'ar' | 'auto';