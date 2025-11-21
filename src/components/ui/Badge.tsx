import React from 'react';
import { RiskLevel, Jurisdiction } from '../../types';
import { getRiskColor, getRiskLevelLabel, getCategoryLabel } from '../../utils/riskUtils'; // MODIFIED: Import getCategoryLabel
import { getJurisdictionColor, getJurisdictionLabel } from '../../utils/jurisdictionUtils';
import { useTranslation } from 'react-i18next';

interface RiskBadgeProps {
  risk: RiskLevel;
  className?: string;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ risk, className = '' }) => {
  const { t } = useTranslation();
  return (
    <span 
      className={`px-2 py-1 text-xs font-medium rounded-full ${getRiskColor(risk)} ${className}`}
    >
      {t(getRiskLevelLabel(risk))}
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
  const { t } = useTranslation();
  return (
    <span 
      className={`px-2 py-1 text-xs font-medium rounded-full ${getJurisdictionColor(jurisdiction)} ${className}`}
      title={t(getJurisdictionLabel(jurisdiction))}
    >
      {showLabel ? t(getJurisdictionLabel(jurisdiction)) : jurisdiction}
    </span>
  );
};

interface CategoryBadgeProps {
  category: string;
  className?: string;
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({ category, className = '' }) => {
  const { t } = useTranslation();

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
      case 'drafting': // ADDED for completeness
        return 'bg-pink-600 text-white';
      case 'commercial': // ADDED for completeness
        return 'bg-yellow-600 text-white';
     case 'discrimination': // ADDED for completeness
        return 'bg-red-500 text-white';
      case 'pricing': // ADDED for completeness
        return 'bg-green-500 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  const categoryLabelKey = getCategoryLabel(category);

  let displayedLabel: string;
  if (categoryLabelKey.startsWith('DYNAMIC_LLM_CATEGORY:')) {
    const normalizedCategory = categoryLabelKey.substring('DYNAMIC_LLM_CATEGORY:'.length);
    // Attempt to translate the normalized category, otherwise use it as is
    const translatedCategoryPart = t(normalizedCategory, { defaultValue: normalizedCategory.replace(/_/g, ' ') });
    displayedLabel = `${t('category_prefix')} ${translatedCategoryPart}`;
  } else {
    displayedLabel = t(categoryLabelKey);
  }

  return (
    <span 
      className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(category)} ${className}`}
    >
      {displayedLabel}
    </span>
  );
};