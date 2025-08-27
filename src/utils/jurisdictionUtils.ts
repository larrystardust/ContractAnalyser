import { Jurisdiction } from '../types';

export const getJurisdictionLabel = (jurisdiction: Jurisdiction): string => {
  switch (jurisdiction) {
    case 'UK':
      return 'United Kingdom';
    case 'EU':
      return 'European Union';
    case 'Ireland':
      return 'Republic of Ireland';
    case 'US':
      return 'United States';
    case 'Canada':
      return 'Canada';
    case 'Australia':
      return 'Australia';
    case 'Others': // ADDED
      return 'Other Jurisdictions';
    default:
      return jurisdiction;
  }
};

export const getJurisdictionFlag = (jurisdiction: Jurisdiction): string => {
  switch (jurisdiction) {
    case 'UK':
      return '🇬🇧';
    case 'EU':
      return '🇪🇺';
    case 'Ireland':
      return '🇮🇪';
    case 'US':
      return '🇺🇸';
    case 'Canada':
      return '🇨🇦';
    case 'Australia':
      return '🇦🇺';
    case 'Others': // ADDED
      return '🌍';
    default:
      return '';
  }
};

export const getJurisdictionColor = (jurisdiction: Jurisdiction): string => {
  switch (jurisdiction) {
    case 'UK':
      return 'bg-blue-800 text-white';
    case 'EU':
      return 'bg-blue-600 text-white';
    case 'Ireland':
      return 'bg-green-600 text-white';
    case 'US':
      return 'bg-red-700 text-white';
    case 'Canada':
      return 'bg-red-600 text-white';
    case 'Australia':
      return 'bg-yellow-600 text-white';
    case 'Others': // ADDED
      return 'bg-gray-500 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
};

export const getAllJurisdictions = (): Jurisdiction[] => {
  return ['UK', 'EU', 'Ireland', 'US', 'Canada', 'Australia', 'Others']; // MODIFIED: Updated list
};

export const getJurisdictionBorderColor = (jurisdiction: Jurisdiction): string => {
  switch (jurisdiction) {
    case 'UK':
      return 'border-blue-800';
    case 'EU':
      return 'border-blue-600';
    case 'Ireland':
      return 'border-green-600';
    case 'US':
      return 'border-red-700';
    case 'Canada':
      return 'border-red-600';
    case 'Australia':
      return 'border-yellow-600';
    case 'Others': // ADDED
      return 'border-gray-500';
    default:
      return 'border-gray-500';
  }
};