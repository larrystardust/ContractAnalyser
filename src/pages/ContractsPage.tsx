import React, { useState } from 'react';
import ContractList from '../components/contracts/ContractList';
import { useTranslation } from 'react-i18next'; // ADDED
import { Contract } from '../types'; // ADDED: Import Contract type
import { useNavigate } from 'react-router-dom'; // ADDED: Import useNavigate

const ContractsPage: React.FC = () => {
  const { t } = useTranslation(); // ADDED
  const navigate = useNavigate(); // ADDED: Initialize useNavigate
  const [pinnedContractId, setPinnedContractId] = useState<string | null>(null); // ADDED: State for pinned contract ID

  // ADDED: handleViewAnalysis function to update pinnedContractId and navigate
  const handleViewAnalysis = (contract: Contract) => {
    setPinnedContractId(contract.id);
    navigate(`/dashboard?contractId=${contract.id}`);
  };

  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('your_contracts')}</h1> {/* MODIFIED */}
      <ContractList onViewAnalysis={handleViewAnalysis} pinnedContractId={pinnedContractId} /> {/* MODIFIED: Pass onViewAnalysis and pinnedContractId */}
    </div>
  );
};

export default ContractsPage;