import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Eye, Trash2, Tag } from 'lucide-react';
import AdminDataTable from '../components/admin/AdminDataTable';
import Modal from '../components/ui/Modal';
import { useAdminContracts } from '../hooks/useAdminContracts'; // Import the new hook
import { AdminContract } from '../services/adminService'; // Import AdminContract type
import AdminContractDetailsModal from '../components/admin/AdminContractDetailsModal'; // Import the new modal component
import Button from '../components/ui/Button';
import { JurisdictionBadge } from '../components/ui/Badge';

const AdminContractsPage: React.FC = () => {
  const { contracts, loading, error, fetchContracts, deleteContract, markContractForDeletion } = useAdminContracts();
  const [selectedContract, setSelectedContract] = useState<AdminContract | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const handleViewDetails = (contract: AdminContract) => {
    setSelectedContract(contract);
    setIsDetailsModalOpen(true);
  };

  const handleDelete = async (contract: AdminContract) => {
    if (window.confirm(`Are you sure you want to permanently delete contract "${contract.name}" by ${contract.user_full_name}? This action cannot be undone.`)) {
      const success = await deleteContract(contract.id);
      if (success) {
        alert('Contract deleted successfully!');
      } else {
        alert('Failed to delete contract.');
      }
    }
  };

  const handleMarkForDeletion = async (contract: AdminContract) => {
    const newStatus = !contract.marked_for_deletion_by_admin;
    if (window.confirm(`Are you sure you want to ${newStatus ? 'mark' : 'unmark'} contract "${contract.name}" for automatic deletion?`)) {
      const success = await markContractForDeletion(contract.id, newStatus);
      if (success) {
        alert(`Contract ${newStatus ? 'marked' : 'unmarked'} for deletion successfully!`);
      } else {
        alert(`Failed to ${newStatus ? 'mark' : 'unmark'} contract for deletion.`);
      }
    }
  };

  const columns = [
    { key: 'name', header: 'Contract Name' },
    { key: 'user_full_name', header: 'User Name' },
    { key: 'user_email', header: 'User Email' },
    { key: 'status', header: 'Status' },
    {
      key: 'jurisdictions',
      header: 'Jurisdictions',
      render: (item: AdminContract) => (
        <div className="flex flex-wrap gap-1">
          {(Array.isArray(item.jurisdictions) ? item.jurisdictions : []).map((j) => (
            <JurisdictionBadge key={j} jurisdiction={j} showLabel={false} />
          ))}
        </div>
      ),
    },
    { key: 'size', header: 'Size' },
    {
      key: 'marked_for_deletion_by_admin',
      header: 'Marked for Deletion',
      render: (item: AdminContract) => (item.marked_for_deletion_by_admin ? 'Yes' : 'No'),
    },
    { key: 'created_at', header: 'Uploaded On', render: (item: AdminContract) => new Date(item.created_at).toLocaleDateString() },
  ];

  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <div className="mb-6">
        <Link to="/admin" className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Admin Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-6">Manage Contracts</h1>
      <p className="text-gray-700 mb-8">Oversee all uploaded contracts and their analysis results.</p>

      <AdminDataTable
        data={contracts}
        columns={columns}
        loading={loading}
        error={error}
        onEdit={handleViewDetails} // Use onEdit to trigger view details modal
        onDelete={handleDelete} // Use onDelete for actual deletion
        // Custom actions for the table
        customActions={(contract: AdminContract) => (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleViewDetails(contract)}
              icon={<Eye className="h-4 w-4" />}
            >
              View Details
            </Button>
            <Button
              variant={contract.marked_for_deletion_by_admin ? 'outline' : 'secondary'}
              size="sm"
              onClick={() => handleMarkForDeletion(contract)}
              icon={<Tag className="h-4 w-4" />}
            >
              {contract.marked_for_deletion_by_admin ? 'Unmark for Deletion' : 'Mark for Deletion'}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleDelete(contract)}
              icon={<Trash2 className="h-4 w-4" />}
            >
              Delete
            </Button>
          </>
        )}
      />

      {selectedContract && (
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          title={`Contract Details: ${selectedContract.name}`}
          className="max-w-4xl" // Adjust modal size for better viewing of analysis
        >
          <AdminContractDetailsModal contract={selectedContract} />
        </Modal>
      )}
    </div>
  );
};

export default AdminContractsPage;