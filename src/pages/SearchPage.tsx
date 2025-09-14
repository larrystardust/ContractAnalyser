import React, { useState, useEffect } from 'react';
import { useContracts } from '../context/ContractContext';
import { Contract } from '../types';
import ContractList from '../components/contracts/ContractList';
import { Search as SearchIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next'; // ADDED

const SearchPage: React.FC = () => {
  const { contracts, loadingContracts } = useContracts();
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredContracts, setFilteredContracts] = useState<Contract[]>([]);
  const { t } = useTranslation(); // ADDED

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredContracts(contracts);
    } else {
      const lowercasedSearchTerm = searchTerm.toLowerCase();
      const results = contracts.filter(contract =>
        contract.name.toLowerCase().includes(lowercasedSearchTerm)
      );
      setFilteredContracts(results);
    }
  }, [searchTerm, contracts]);

  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">{t('search_your_contracts')}</h1> {/* MODIFIED */}
      
      <div className="relative mb-6">
        <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder={t('search_by_contract_name')} 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        />
      </div>

      {loadingContracts ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-900 mx-auto"></div>
          <p className="text-gray-500 mt-2">{t('loading_contracts')}</p> {/* MODIFIED */}
        </div>
      ) : (
        <ContractList contractsToDisplay={filteredContracts} />
      )}

      {!loadingContracts && filteredContracts.length === 0 && searchTerm !== '' && (
        <div className="text-center py-8 text-gray-600">
          <p>{t('no_contracts_found_matching_search')}</p> {/* MODIFIED */}
        </div>
      )}
       {!loadingContracts && contracts.length === 0 && searchTerm === '' && (
        <div className="text-center py-8 text-gray-600">
          <p>{t('no_contracts_uploaded_yet')}</p> {/* MODIFIED */}
        </div>
      )}
    </div>
  );
};

export default SearchPage;