import { Jurisdiction } from '../types';

export const getJurisdictionLabel = (jurisdiction: Jurisdiction): string => {
  switch (jurisdiction) {
    case 'UK':
      return 'jurisdiction_uk'; // MODIFIED: Returns translation key
    case 'EU':
      return 'jurisdiction_eu'; // MODIFIED: Returns translation key
    case 'Ireland':
      return 'jurisdiction_ireland'; // MODIFIED: Returns translation key
    case 'US':
      return 'jurisdiction_us'; // MODIFIED: Returns translation key
    case 'Canada':
      return 'jurisdiction_canada'; // MODIFIED: Returns translation key
    case 'Australia':
      return 'jurisdiction_australia'; // MODIFIED: Returns translation key
    case 'Others':
      return 'jurisdiction_others'; // MODIFIED: Returns translation key
    default:
      return `jurisdiction_${jurisdiction.toLowerCase()}`; // MODIFIED: Returns translation key
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
    case 'Others':
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
    case 'Others':
      return 'bg-gray-500 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
};

export const getAllJurisdictions = (): Jurisdiction[] => {
  return ['UK', 'EU', 'Ireland', 'US', 'Canada', 'Australia', 'Others'];
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
    case 'Others':
      return 'border-gray-500';
    default:
      return 'border-gray-500';
  }
};