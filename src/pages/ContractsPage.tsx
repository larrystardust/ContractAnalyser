import React from 'react';
import ContractList from '../components/contracts/ContractList';
import { useTranslation } from 'react-i18next'; // ADDED

const ContractsPage: React.FC = () => {
  const { t } = useTranslation(); // ADDED
  // This function is passed to ContractList, but for this page,
  // we don't need to perform any specific action on contract selection.
  // In a more complex application, clicking a contract here might navigate
  // to a detailed analysis view or open a modal.
  // REMOVED: const handleSelectContract = (contractId: string) => {
  // REMOVED:   console.log(`Contract ${contractId} selected on Contracts Page.`);
  // REMOVED: };

  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('your_contracts')}</h1> {/* MODIFIED */}
      <ContractList /> {/* MODIFIED: Removed onSelectContract prop */}
    </div>
  );
};

export default ContractsPage;