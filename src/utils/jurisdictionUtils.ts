import { Jurisdiction } from '../types';

export const getJurisdictionLabel = (jurisdiction: Jurisdiction): string => {
  switch (jurisdiction) {
    case 'UK':
      return 'jurisdiction_uk'; // MODIFIED: Returns translation key
    case 'EU':
      return 'jurisdiction_eu'; // MODIFIED: Returns translation key
    case 'Ireland':
    case 'IE': // ADDED: Handle 'IE' as a possible output for Ireland
      return 'jurisdiction_ireland'; // MODIFIED: Returns translation key
    case 'US':
      return 'jurisdiction_us'; // MODIFIED: Returns translation key
    case 'Canada':
      return 'jurisdiction_canada'; // MODIFIED: Returns translation key
    case 'Australia':
      return 'jurisdiction_australia'; // MODIFIED: Returns translation key
    case 'Islamic Law': // ADDED
      return 'jurisdiction_islamic_law'; // ADDED
    case 'Nigeria': // ADDED: New jurisdiction
      return 'jurisdiction_nigeria'; // ADDED: New translation key
    case 'Others':
      return 'jurisdiction_others'; // MODIFIED: Returns translation key
    default:
      // Normalize jurisdiction string to a consistent snake_case format for translation keys
      const normalizedJurisdiction = jurisdiction.toLowerCase().replace(/[-\s]/g, '_');
      return `jurisdiction_${normalizedJurisdiction}`; // MODIFIED: Fallback for unknown jurisdictions
  }
};

export const getJurisdictionFlag = (jurisdiction: Jurisdiction): string => {
  switch (jurisdiction) {
    case 'UK':
      return '🇬🇧';
    case 'EU':
      return '🇪🇺';
    case 'Ireland':
    case 'IE': // ADDED
      return '🇮🇪';
    case 'US':
      return '🇺🇸';
    case 'Canada':
      return '🇨🇦';
    case 'Australia':
      return '🇦🇺';
    case 'Islamic Law': // ADDED
      return '🌙'; // ADDED: Using half moon as a representative
    case 'Nigeria': // ADDED: New jurisdiction
      return '🇳🇬'; // ADDED: Nigeria flag
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
    case 'IE': // ADDED
      return 'bg-green-600 text-white';
    case 'US':
      return 'bg-red-700 text-white';
    case 'Canada':
      return 'bg-red-600 text-white';
    case 'Australia':
      return 'bg-yellow-600 text-white';
    case 'Islamic Law': // ADDED
      return 'bg-green-800 text-white'; // ADDED: A new color for Islamic Law
    case 'Nigeria': // ADDED: New jurisdiction
      return 'bg-green-700 text-white'; // ADDED: A new color for Nigeria
    case 'Others':
      return 'bg-gray-500 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
};

export const getAllJurisdictions = (): Jurisdiction[] => {
  return ['UK', 'EU', 'Ireland', 'US', 'Canada', 'Australia', 'Islamic Law', 'Others']; // MODIFIED: Removed 'Nigeria'
};

export const getJurisdictionBorderColor = (jurisdiction: Jurisdiction): string => {
  switch (jurisdiction) {
    case 'UK':
      return 'border-blue-800';
    case 'EU':
      return 'border-blue-600';
    case 'Ireland':
    case 'IE': // ADDED
      return 'border-green-600';
    case 'US':
      return 'border-red-700';
    case 'Canada':
      return 'border-red-600';
    case 'Australia':
      return 'border-yellow-600';
    case 'Islamic Law': // ADDED
      return 'border-green-800'; // ADDED
    case 'Nigeria': // ADDED
      return 'border-green-700'; // ADDED
    case 'Others':
      return 'border-gray-500';
    default:
      return 'border-gray-500';
  }
};