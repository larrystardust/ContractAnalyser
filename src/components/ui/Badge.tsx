import React from 'react';
import { RiskLevel, Jurisdiction } from '../../types';
import { getRiskColor, getRiskLevelLabel } from '../../utils/riskUtils';
import { getJurisdictionColor, getJurisdictionLabel } from '../../utils/jurisdictionUtils';
import { useTranslation } from 'react-i18next'; // ADDED

interface RiskBadgeProps {
  risk: RiskLevel;
  className?: string;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ risk, className = '' }) => {
  const { t } = useTranslation(); // ADDED
  return (
    <span 
      className={`px-2 py-1 text-xs font-medium rounded-full ${getRiskColor(risk)} ${className}`}
    >
      {t(getRiskLevelLabel(risk))} {/* MODIFIED: Apply t() */}
    </span>
  );
};

interface JurisdictionBadgeProps {
  jurisdiction: Jurisdiction;
  className?: string;
  showLabel?: boolean;
}

export const JurisdictionBadge: React.FC<JurisdictionBadgeProps> = ({ 
  jurisdiction, 
  className = '',
  showLabel = true
}) => {
  const { t } = useTranslation(); // ADDED
  return (
    <span 
      className={`px-2 py-1 text-xs font-medium rounded-full ${getJurisdictionColor(jurisdiction)} ${className}`}
      title={t(getJurisdictionLabel(jurisdiction))} /* MODIFIED: Apply t() */
    >
      {showLabel ? t(getJurisdictionLabel(jurisdiction)) : jurisdiction} {/* MODIFIED: Apply t() */}
    </span>
  );
};

interface CategoryBadgeProps {
  category: string;
  className?: string;
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({ category, className = '' }) => {
  const { t } = useTranslation(); // ADDED

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'compliance':
        return 'bg-purple-600 text-white';
      case 'risk':
        return 'bg-orange-600 text-white';
      case 'data-protection':
        return 'bg-teal-600 text-white';
      case 'enforceability':
        return 'bg-indigo-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  const getCategoryLabel = (category: string): string => {
    switch (category) {
      case 'compliance':
        return 'Compliance';
      case 'risk':
        return 'Risk';
      case 'data-protection':
        return 'Data Protection';
      case 'enforceability':
        return 'Enforceability';
      default:
        return category.charAt(0).toUpperCase() + category.slice(1);
    }
  };

  return (
    <span 
      className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(category)} ${className}`}
    >
      {t(getCategoryLabel(category))} {/* MODIFIED: Apply t() */}
    </span>
  );
};