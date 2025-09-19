export interface Contract {
  id: string; // Changed to string for UUID
  user_id: string; // Added for Supabase foreign key
  name: string;
  file_path: string; // Added for Supabase Storage path
  size: string;
  jurisdictions: Jurisdiction[];
  status: 'pending' | 'analyzing' | 'completed' | 'failed'; // Added 'failed'
  processing_progress?: number;
  analysisResult?: AnalysisResult;
  created_at: string; // Changed from uploadDate
  updated_at: string; // Added
}

export type Jurisdiction = 'UK' | 'EU' | 'Ireland' | 'US' | 'Canada' | 'Australia' | 'Sharia' | 'Others'; // MODIFIED: Added 'Sharia'

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
}

export interface JurisdictionSummary {
  jurisdiction: Jurisdiction;
  applicableLaws: string[];
  keyFindings: string[];
  riskLevel: RiskLevel;
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
  tier: number;
  pricing: {
    monthly?: { priceId: string; price: number; interval: 'month' };
    yearly?: { priceId: string; price: number; interval: 'year' };
    one_time?: { priceId: string; price: number; interval: 'one_time' };
  };
}

// ADDED: New type for analysis languages
export type AnalysisLanguage = 'en' | 'fr' | 'es' | 'ar' | 'auto';