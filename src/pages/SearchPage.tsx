import React, { useState, useEffect } from 'react';
import { useContracts } from '../context/ContractContext';
import { Contract } from '../types';
import ContractList from '../components/contracts/ContractList';
import { Search as SearchIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '../components/ui/Button';

const SearchPage: React.FC = () => {
  const { contracts, loadingContracts } = useContracts();
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredContracts, setFilteredContracts] = useState<Contract[]>([]);
  const { t } = useTranslation();

  // State for advanced filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [contractTypeFilter, setContractTypeFilter] = useState('');
  const [partiesFilter, setPartiesFilter] = useState('');
  const [effectiveDateStart, setEffectiveDateStart] = useState('');
  const [effectiveDateEnd, setEffectiveDateEnd] = useState('');
  const [terminationDateStart, setTerminationDateStart] = useState('');
  const [terminationDateEnd, setTerminationDateEnd] = useState('');
  const [renewalDateStart, setRenewalDateStart] = useState('');
  const [renewalDateEnd, setRenewalDateEnd] = useState('');
  const [liabilityCapFilter, setLiabilityCapFilter] = useState('');
  const [indemnificationFilter, setIndemnificationFilter] = useState('');
  const [confidentialityFilter, setConfidentialityFilter] = useState('');
  const [contractValueFilter, setContractValueFilter] = useState(''); // ADDED: New state for contract value filter

  useEffect(() => {
    // ADDED: Console logs for debugging
    console.log('SearchPage: Contracts data:', contracts);
    console.log('SearchPage: Filter values:', { searchTerm, contractTypeFilter, partiesFilter, effectiveDateStart, effectiveDateEnd, terminationDateStart, terminationDateEnd, renewalDateStart, renewalDateEnd, liabilityCapFilter, indemnificationFilter, confidentialityFilter, contractValueFilter }); // MODIFIED: Added contractValueFilter

    let results = contracts;

    // Filter by contract name (searchTerm)
    if (searchTerm.trim() !== '') {
      const lowercasedSearchTerm = searchTerm.toLowerCase();
      results = results.filter(contract =>
        contract.name.toLowerCase().includes(lowercasedSearchTerm) ||
        (contract.translated_name && contract.translated_name.toLowerCase().includes(lowercasedSearchTerm))
      );
    }

    // Apply advanced filters
    results = results.filter(contract => {
      // ADDED: Console log for debugging individual contract's analysisResult
      console.log(`SearchPage: Checking contract ID: ${contract.id}, analysisResult:`, contract.analysisResult);

      if (!contract.analysisResult) return false; // Only filter contracts with analysis results

      const ar = contract.analysisResult;
      const lowercasedContractTypeFilter = contractTypeFilter.toLowerCase();
      const lowercasedPartiesFilter = partiesFilter.toLowerCase();
      const lowercasedLiabilityCapFilter = liabilityCapFilter.toLowerCase();
      const lowercasedIndemnificationFilter = indemnificationFilter.toLowerCase();
      const lowercasedConfidentialityFilter = confidentialityFilter.toLowerCase();
      const lowercasedContractValueFilter = contractValueFilter.toLowerCase(); // ADDED: Lowercased contract value filter

      // Contract Type Filter
      if (contractTypeFilter && ar.contractType && !ar.contractType.toLowerCase().includes(lowercasedContractTypeFilter)) {
        return false;
      }

      // Parties Filter
      if (partiesFilter && ar.parties && !ar.parties.some(party => party.toLowerCase().includes(lowercasedPartiesFilter))) {
        return false;
      }

      // Effective Date Range
      if (effectiveDateStart && ar.effectiveDate && new Date(ar.effectiveDate) < new Date(effectiveDateStart)) {
        return false;
      }
      if (effectiveDateEnd && ar.effectiveDate && new Date(ar.effectiveDate) > new Date(effectiveDateEnd)) {
        return false;
      }

      // Termination Date Range
      if (terminationDateStart && ar.terminationDate && new Date(ar.terminationDate) < new Date(terminationDateStart)) {
        return false;
      }
      if (terminationDateEnd && ar.terminationDate && new Date(ar.terminationDate) > new Date(terminationDateEnd)) {
        return false;
      }

      // Renewal Date Range
      if (renewalDateStart && ar.renewalDate && new Date(ar.renewalDate) < new Date(renewalDateStart)) {
        return false;
      }
      if (renewalDateEnd && ar.renewalDate && new Date(ar.renewalDate) > new Date(renewalDateEnd)) {
        return false;
      }

      // Liability Cap Summary Filter
      if (liabilityCapFilter && ar.liabilityCapSummary && !ar.liabilityCapSummary.toLowerCase().includes(lowercasedLiabilityCapFilter)) {
        return false;
      }

      // Indemnification Clause Summary Filter
      if (indemnificationFilter && ar.indemnificationClauseSummary && !ar.indemnificationClauseSummary.toLowerCase().includes(lowercasedIndemnificationFilter)) {
        return false;
      }

      // Confidentiality Obligations Summary Filter
      if (confidentialityFilter && ar.confidentialityObligationsSummary && !ar.confidentialityObligationsSummary.toLowerCase().includes(lowercasedConfidentialityFilter)) {
        return false;
      }

      // ADDED: Contract Value Filter
      if (contractValueFilter && ar.contractValue && !ar.contractValue.toLowerCase().includes(lowercasedContractValueFilter)) {
        return false;
      }

      return true;
    });

    setFilteredContracts(results);
  }, [
    searchTerm,
    contracts,
    contractTypeFilter,
    partiesFilter,
    effectiveDateStart,
    effectiveDateEnd,
    terminationDateStart,
    terminationDateEnd,
    renewalDateStart,
    renewalDateEnd,
    liabilityCapFilter,
    indemnificationFilter,
    confidentialityFilter,
    contractValueFilter, // ADDED: Add contractValueFilter to dependencies
  ]);

  const toggleAdvancedFilters = () => {
    setShowAdvancedFilters(prev => !prev);
  };

  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">{t('search_your_contracts')}</h1>
      
      <div className="relative mb-4">
        <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder={t('search_by_contract_name')} 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        />
      </div>

      {/* Advanced Filters Toggle */}
      <div className="mb-6">
        <Button
          variant="text"
          onClick={toggleAdvancedFilters}
          className="flex items-center text-blue-600 hover:text-blue-800"
          icon={showAdvancedFilters ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        >
          {t('advanced_filters')}
        </Button>
      </div>

      {/* Advanced Filters Section */}
      {showAdvancedFilters && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 p-4 border border-gray-200 rounded-md bg-gray-50">
          {/* Contract Type */}
          <div>
            <label htmlFor="contractTypeFilter" className="block text-sm font-medium text-gray-700 mb-1">
              {t('contract_type')}
            </label>
            <input
              type="text"
              id="contractTypeFilter"
              value={contractTypeFilter}
              onChange={(e) => setContractTypeFilter(e.target.value)}
              placeholder={t('e_g_service_agreement')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          {/* Parties */}
          <div>
            <label htmlFor="partiesFilter" className="block text-sm font-medium text-gray-700 mb-1">
              {t('parties')}
            </label>
            <input
              type="text"
              id="partiesFilter"
              value={partiesFilter}
              onChange={(e) => setPartiesFilter(e.target.value)}
              placeholder={t('e_g_acme_corp')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          {/* Effective Date Start */}
          <div>
            <label htmlFor="effectiveDateStart" className="block text-sm font-medium text-gray-700 mb-1">
              {t('effective_date_start')}
            </label>
            <input
              type="date"
              id="effectiveDateStart"
              value={effectiveDateStart}
              onChange={(e) => setEffectiveDateStart(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          {/* Effective Date End */}
          <div>
            <label htmlFor="effectiveDateEnd" className="block text-sm font-medium text-gray-700 mb-1">
              {t('effective_date_end')}
            </label>
            <input
              type="date"
              id="effectiveDateEnd"
              value={effectiveDateEnd}
              onChange={(e) => setEffectiveDateEnd(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          {/* Termination Date Start */}
          <div>
            <label htmlFor="terminationDateStart" className="block text-sm font-medium text-gray-700 mb-1">
              {t('termination_date_start')}
            </label>
            <input
              type="date"
              id="terminationDateStart"
              value={terminationDateStart}
              onChange={(e) => setTerminationDateStart(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          {/* Termination Date End */}
          <div>
            <label htmlFor="terminationDateEnd" className="block text-sm font-medium text-gray-700 mb-1">
              {t('termination_date_end')}
            </label>
            <input
              type="date"
              id="terminationDateEnd"
              value={terminationDateEnd}
              onChange={(e) => setTerminationDateEnd(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          {/* Renewal Date Start */}
          <div>
            <label htmlFor="renewalDateStart" className="block text-sm font-medium text-gray-700 mb-1">
              {t('renewal_date_start')}
            </label>
            <input
              type="date"
              id="renewalDateStart"
              value={renewalDateStart}
              onChange={(e) => setRenewalDateStart(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          {/* Renewal Date End */}
          <div>
            <label htmlFor="renewalDateEnd" className="block text-sm font-medium text-gray-700 mb-1">
              {t('renewal_date_end')}
            </label>
            <input
              type="date"
              id="renewalDateEnd"
              value={renewalDateEnd}
              onChange={(e) => setRenewalDateEnd(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          {/* Liability Cap Summary */}
          <div>
            <label htmlFor="liabilityCapFilter" className="block text-sm font-medium text-gray-700 mb-1">
              {t('liability_cap_summary')}
            </label>
            <input
              type="text"
              id="liabilityCapFilter"
              value={liabilityCapFilter}
              onChange={(e) => setLiabilityCapFilter(e.target.value)}
              placeholder={t('e_g_limited_to_1m')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          {/* Indemnification Clause Summary */}
          <div>
            <label htmlFor="indemnificationFilter" className="block text-sm font-medium text-gray-700 mb-1">
              {t('indemnification_clause_summary')}
            </label>
            <input
              type="text"
              id="indemnificationFilter"
              value={indemnificationFilter}
              onChange={(e) => setIndemnificationFilter(e.target.value)}
              placeholder={t('e_g_mutual_indemnity')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          {/* Confidentiality Obligations Summary */}
          <div>
            <label htmlFor="confidentialityFilter" className="block text-sm font-medium text-gray-700 mb-1">
              {t('confidentiality_obligations_summary')}
            </label>
            <input
              type="text"
              id="confidentialityFilter"
              value={confidentialityFilter}
              onChange={(e) => setConfidentialityFilter(e.target.value)}
              placeholder={t('e_g_non_disclosure')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          {/* ADDED: Contract Value Filter */}
          <div>
            <label htmlFor="contractValueFilter" className="block text-sm font-medium text-gray-700 mb-1">
              {t('contract_value')}
            </label>
            <input
              type="text"
              id="contractValueFilter"
              value={contractValueFilter}
              onChange={(e) => setContractValueFilter(e.target.value)}
              placeholder={t('e_g_100000_usd')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
        </div>
      )}

      {loadingContracts ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-900 mx-auto"></div>
          <p className="text-gray-500 mt-2">{t('loading_contracts')}</p>
        </div>
      ) : (
        <ContractList contractsToDisplay={filteredContracts} />
      )}

      {!loadingContracts && filteredContracts.length === 0 && (searchTerm !== '' || showAdvancedFilters) && (
        <div className="text-center py-8 text-gray-600">
          <p>{t('no_contracts_found_matching_search')}</p>
        </div>
      )}
       {!loadingContracts && contracts.length === 0 && searchTerm === '' && !showAdvancedFilters && (
        <div className="text-center py-8 text-gray-600">
          <p>{t('no_contracts_uploaded_yet')}</p>
        </div>
      )}
    </div>
  );
};

export default SearchPage;