import { Finding, RiskLevel } from '../types';

export const getRiskColor = (risk: RiskLevel): string => {
  switch (risk) {
    case 'high':
      return 'bg-red-600 text-white';
    case 'medium':
      return 'bg-amber-500 text-white';
    case 'low':
      return 'bg-blue-500 text-white';
    case 'none':
      return 'bg-green-500 text-white';
    default:
      return 'bg-gray-200 text-gray-800';
  }
};

export const getRiskBorderColor = (risk: RiskLevel): string => {
  switch (risk) {
    case 'high':
      return 'border-red-600';
    case 'medium':
      return 'border-amber-500';
    case 'low':
      return 'border-blue-500';
    case 'none':
      return 'border-green-500';
    default:
      return 'border-gray-200';
  }
};

export const getRiskTextColor = (risk: RiskLevel): string => {
  switch (risk) {
    case 'high':
      return 'text-red-600';
    case 'medium':
      return 'text-amber-500';
    case 'low':
      return 'text-blue-500';
    case 'none':
      return 'text-green-500';
    default:
      return 'text-gray-500';
  }
};

export const countFindingsByRisk = (findings: Finding[]): Record<RiskLevel, number> => {
  const counts: Record<RiskLevel, number> = {
    high: 0,
    medium: 0,
    low: 0,
    none: 0
  };
  
  findings.forEach(finding => {
    counts[finding.riskLevel]++;
  });
  
  return counts;
};

export const getRiskLevelLabel = (risk: RiskLevel): string => {
  switch (risk) {
    case 'high':
      return 'risk_level_high';
    case 'medium':
      return 'risk_level_medium';
    case 'low':
      return 'risk_level_low';
    case 'none':
      return 'risk_level_none';
    default:
      return 'risk_level_unknown';
  }
};

export const getCategoryLabel = (category: string): string => {
  switch (category) {
    case 'compliance':
      return 'category_compliance';
    case 'risk':
      return 'category_risk';
    case 'data-protection':
      return 'category_data_protection';
    case 'enforceability':
      return 'category_enforceability';
    case 'drafting':
      return 'category_drafting';
    case 'commercial':
      return 'category_commercial';
    default:
      return `category_${category.toLowerCase()}`;
  }
};