import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, UserPlus } from 'lucide-react';
import AdminDataTable from '../components/admin/AdminDataTable';
import UserForm from '../components/admin/UserForm';
import CreateUserForm from '../components/admin/CreateUserForm';
import Modal from '../components/ui/Modal';
import adminService, { AdminProfile, AdminProfileUpdate, AvailableSubscription } from '../services/adminService'; // ADDED AvailableSubscription
import Button from '../components/ui/Button';
import { JurisdictionBadge } from '../components/ui/Badge';
import { Jurisdiction } from '../types';

const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<AdminProfile[]>([]);
  const [allSubscriptions, setAllSubscriptions] = useState<AvailableSubscription[]>([]); // ADDED
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminProfile | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchUsersAndSubscriptions = async () => { // MODIFIED function name
    setLoading(true);
    setError(null);
    try {
      const { users: fetchedUsers, all_subscriptions: fetchedSubscriptions } = await adminService.getUsers(); // MODIFIED
      setUsers(fetchedUsers);
      setAllSubscriptions(fetchedSubscriptions); // ADDED
    } catch (err: any) {
      console.error('Error fetching users and subscriptions:', err); // MODIFIED log
      setError(err.message || 'Failed to load users and subscriptions.'); // MODIFIED error message
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndSubscriptions(); // MODIFIED call
  }, []);

  const handleEdit = (user: AdminProfile) => {
    setSelectedUser(user);
    setIsEditModalOpen(true);
  };

  const handleDelete = async (user: AdminProfile) => {
    if (window.confirm(`Are you sure you want to delete user: ${user.email}? This action cannot be undone.`)) {
      try {
        await adminService.deleteUser(user.id);
        alert('User deleted successfully!');
        fetchUsersAndSubscriptions(); // Refresh the list
      } catch (err: any) {
        console.error('Error deleting user:', err);
        alert(`Failed to delete user: ${err.message}`);
      }
    }
  };

  const handleFormSubmit = async (updates: AdminProfileUpdate) => {
    if (!selectedUser) return;

    setIsSaving(true);
    try {
      await adminService.updateUser(selectedUser.id, updates);
      alert('User profile updated successfully!'); // MODIFIED message
      setIsEditModalOpen(false);
      setSelectedUser(null);
      fetchUsersAndSubscriptions(); // Refresh the list
    } catch (err: any) {
      console.error('Error updating user:', err);
      alert(`Failed to update user: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGrantSingleUse = async (userId: string) => {
    try {
      await adminService.grantSingleUseCredit(userId);
      alert('Single-use credit granted successfully!');
      fetchUsersAndSubscriptions(); // Refresh the list to show updated credits
    } catch (err: any) {
      console.error('Error granting single-use credit:', err);
      alert(`Failed to grant single-use credit: ${err.message}`);
    }
  };

  // MODIFIED: This function now calls the new adminService.manageUserSubscription
  const handleManageSubscription = async (userId: string, subscriptionId: string | null, role: 'owner' | 'member' | null) => {
    try {
      await adminService.manageUserSubscription(userId, subscriptionId, role);
      alert('User subscription and role updated successfully!');
      fetchUsersAndSubscriptions(); // Refresh the list to show updated subscription/role
    } catch (err: any) {
      console.error('Error managing user subscription:', err);
      alert(`Failed to manage user subscription: ${err.message}`);
    }
  };

  const handleCreateCustomerPortal = async (userId: string) => {
    try {
      const portalUrl = await adminService.createCustomerPortalForUser(userId);
      window.open(portalUrl, '_blank');
    } catch (err: any) {
      console.error('Error creating customer portal:', err);
      alert(`Failed to create customer portal: ${err.message}`);
    }
  };

  const handleEditModalClose = () => {
    setIsEditModalOpen(false);
    setSelectedUser(null);
  };

  const handleCreateUserModalClose = () => {
    setIsCreateUserModalOpen(false);
  };

  const handleUserCreated = () => {
    setIsCreateUserModalOpen(false);
    fetchUsersAndSubscriptions(); // Refresh the list after a new user is created
  };

  const columns = [
    { key: 'full_name', header: 'Full Name' },
    { key: 'email', header: 'Email' },
    { key: 'business_name', header: 'Business Name' }, // ADDED: Business Name column
    { key: 'is_admin', header: 'Admin', render: (item: AdminProfile) => (item.is_admin ? 'Yes' : 'No') },
    {
      key: 'subscription_details',
      header: 'Subscription',
      render: (item: AdminProfile) => {
        if (item.single_use_credits > 0) {
          return `Single Use (Credits: ${item.single_use_credits})`;
        }
        if (item.subscription_details) {
          const sub = allSubscriptions.find(s => s.subscription_id === item.subscription_details?.subscription_id);
          return `${sub?.product_name || 'Unknown'} (${item.subscription_details.status})`;
        }
        return 'None';
      },
    },
    {
      key: 'membership_details',
      header: 'Role',
      render: (item: AdminProfile) => item.membership_details?.role || 'N/A',
    },
    { key: 'mobile_phone_number', header: 'Phone' },
    { key: 'country_code', header: 'Country Code' },
    { key: 'theme_preference', header: 'Theme' },
    { key: 'email_reports_enabled', header: 'Email Reports', render: (item: AdminProfile) => (item.email_reports_enabled ? 'Yes' : 'No') },
    {
      key: 'default_jurisdictions',
      header: 'Default Jurisdictions',
      render: (item: AdminProfile) => (
        <div className="flex flex-wrap gap-1">
          {(Array.isArray(item.default_jurisdictions) ? item.default_jurisdictions : []).map((j) => (
            <JurisdictionBadge key={j} jurisdiction={j} showLabel={false} />
          ))}
        </div>
      ),
    },
    { key: 'auth_created_at', header: 'Joined', render: (item: AdminProfile) => new Date(item.auth_created_at).toLocaleDateString() },
  ];

  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <div className="mb-6 flex justify-between items-center">
        <Link to="/admin" className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Admin Dashboard
        </Link>
        <Button variant="primary" icon={<UserPlus className="h-4 w-4" />} onClick={() => setIsCreateUserModalOpen(true)}>
          Add New User
        </Button>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-6">Manage Users</h1>
      <p className="text-gray-700 mb-8">View and manage all user accounts registered in the system.</p>

      <AdminDataTable
        data={users}
        columns={columns}
        loading={loading}
        error={error}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {selectedUser && (
        <Modal isOpen={isEditModalOpen} onClose={handleEditModalClose} title={`Edit User: ${selectedUser.email}`}>
          <UserForm
            user={selectedUser}
            allSubscriptions={allSubscriptions} // ADDED
            onSubmit={handleFormSubmit}
            onCancel={handleEditModalClose}
            isSaving={isSaving}
            onGrantSingleUse={handleGrantSingleUse}
            onManageSubscription={handleManageSubscription} // MODIFIED
            onCreateCustomerPortal={handleCreateCustomerPortal}
          />
        </Modal>
      )}

      <Modal isOpen={isCreateUserModalOpen} onClose={handleCreateUserModalClose} title="Create New User">
        <CreateUserForm
          onSuccess={handleUserCreated}
          onCancel={handleCreateUserModalClose}
          allSubscriptions={allSubscriptions} // ADDED
        />
      </Modal>
    </div>
  );
};

export default AdminUsersPage;