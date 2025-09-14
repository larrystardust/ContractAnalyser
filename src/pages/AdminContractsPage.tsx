import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Eye, Trash2, Tag } from 'lucide-react';
import AdminDataTable from '../components/admin/AdminDataTable';
import Modal from '../components/ui/Modal';
import { useAdminContracts } from '../hooks/useAdminContracts';
import { AdminContract } from '../services/adminService';
import AdminContractDetailsModal from '../components/admin/AdminContractDetailsModal';
import Button from '../components/ui/Button';
import { JurisdictionBadge } from '../components/ui/Badge';
import { useTranslation } from 'react-i18next'; // ADDED

const AdminContractsPage: React.FC = () => {
  const { contracts, loading, error, fetchContracts, deleteContract, markContractForDeletion } = useAdminContracts();
  const [selectedContract, setSelectedContract] = useState<AdminContract | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const { t } = useTranslation(); // ADDED

  const handleViewDetails = (contract: AdminContract) => {
    setSelectedContract(contract);
    setIsDetailsModalOpen(true);
  };

  const handleDelete = async (contract: AdminContract) => {
    if (window.confirm(t('confirm_delete_contract', { name: contract.name, user_full_name: contract.user_full_name }))) { // MODIFIED
      const success = await deleteContract(contract.id);
      if (success) {
        alert(t('contract_deleted_successfully')); // MODIFIED
      } else {
        alert(t('failed_to_delete_contract')); // MODIFIED
      }
    }
  };

  const handleMarkForDeletion = async (contract: AdminContract) => {
    const newStatus = !contract.marked_for_deletion_by_admin;
    if (window.confirm(t(newStatus ? 'confirm_mark_for_deletion' : 'confirm_unmark_for_deletion', { name: contract.name }))) { // MODIFIED
      const success = await markContractForDeletion(contract.id, newStatus);
      if (success) {
        alert(t(newStatus ? 'contract_marked_for_deletion_successfully' : 'contract_unmarked_for_deletion_successfully')); // MODIFIED
      } else {
        alert(t(newStatus ? 'failed_to_mark_for_deletion' : 'failed_to_unmark_for_deletion')); // MODIFIED
      }
    }
  };

  const columns = [
    { key: 'name', header: t('contract_name_table') }, // MODIFIED
    { key: 'user_full_name', header: t('user_name_table') }, // MODIFIED
    { key: 'user_email', header: t('user_email_table') }, // MODIFIED
    { key: 'status', header: t('status_table') }, // MODIFIED
    {
      key: 'jurisdictions',
      header: t('jurisdictions_table_header'), // MODIFIED
      render: (item: AdminContract) => (
        <div className="flex flex-wrap gap-1">
          {(Array.isArray(item.jurisdictions) ? item.jurisdictions : []).map((j) => (
            <JurisdictionBadge key={j} jurisdiction={j} showLabel={false} />
          ))}
        </div>
      ),
    },
    { key: 'size', header: t('size_table') }, // MODIFIED
    {
      key: 'marked_for_deletion_by_admin',
      header: t('marked_for_deletion_table'), // MODIFIED
      render: (item: AdminContract) => (item.marked_for_deletion_by_admin ? t('yes') : t('no')), // MODIFIED
    },
    { key: 'created_at', header: t('uploaded_on_table'), render: (item: AdminContract) => new Date(item.created_at).toLocaleDateString() }, // MODIFIED
  ];

  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <div className="mb-6">
        <Link to="/admin" className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('back_to_admin_dashboard')} {/* MODIFIED */}
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-6">{t('manage_contracts')}</h1> {/* MODIFIED */}
      <p className="text-gray-700 mb-8">{t('oversee_contracts_analysis')}</p> {/* MODIFIED */}

      <AdminDataTable
        data={contracts}
        columns={columns}
        loading={loading}
        error={error}
        onEdit={handleViewDetails}
        onDelete={handleDelete}
        customActions={(contract: AdminContract) => (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleViewDetails(contract)}
              icon={<Eye className="h-4 w-4" />}
            >
              {t('view_details')} {/* MODIFIED */}
            </Button>
            <Button
              variant={contract.marked_for_deletion_by_admin ? 'outline' : 'secondary'}
              size="sm"
              onClick={() => handleMarkForDeletion(contract)}
              icon={<Tag className="h-4 w-4" />}
            >
              {contract.marked_for_deletion_by_admin ? t('unmark_for_deletion') : t('mark_for_deletion')} {/* MODIFIED */}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleDelete(contract)}
              icon={<Trash2 className="h-4 w-4" />}
            >
              {t('delete')} {/* MODIFIED */}
            </Button>
          </>
        )}
      />

      {selectedContract && (
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          title={t('contract_details', { name: selectedContract.name })} 
          className="max-w-4xl"
        >
          <AdminContractDetailsModal contract={selectedContract} />
        </Modal>
      )}
    </div>
  );
};

export default AdminContractsPage;