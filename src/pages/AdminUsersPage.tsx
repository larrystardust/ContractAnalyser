import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, UserPlus, Trash2 } from 'lucide-react'; // MODIFIED: Added Trash2
import AdminDataTable from '../components/admin/AdminDataTable';
import UserForm from '../components/admin/UserForm';
import CreateUserForm from '../components/admin/CreateUserForm';
import Modal from '../components/ui/Modal';
import adminService, { AdminProfile, AdminProfileUpdate, AvailableSubscription } from '../services/adminService';
import Button from '../components/ui/Button';
import { JurisdictionBadge } from '../components/ui/Badge';
import { Jurisdiction } from '../types';
import { useTranslation } from 'react-i18next'; // ADDED

const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<AdminProfile[]>([]);
  const [allSubscriptions, setAllSubscriptions] = useState<AvailableSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminProfile | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { t } = useTranslation(); // ADDED

  const fetchUsersAndSubscriptions = async () => {
    setLoading(true);
    setError(null);
    try {
      const { users: fetchedUsers, all_subscriptions: fetchedSubscriptions } = await adminService.getUsers();
      setUsers(fetchedUsers);
      setAllSubscriptions(fetchedSubscriptions);
    } catch (err: any) {
      console.error('Error fetching users and subscriptions:', err);
      setError(err.message || t('failed_to_load_users_subscriptions')); // MODIFIED
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndSubscriptions();
  }, []);

  const handleEdit = (user: AdminProfile) => {
    setSelectedUser(user);
    setIsEditModalOpen(true);
  };

  const handleDelete = async (user: AdminProfile) => {
    if (window.confirm(t('confirm_delete_user', { email: user.email }))) { // MODIFIED
      try {
        await adminService.deleteUser(user.id);
        alert(t('user_deleted_successfully')); // MODIFIED
        fetchUsersAndSubscriptions(); // Refresh the list
      } catch (err: any) {
        console.error('Error deleting user:', err);
        alert(t('failed_to_delete_user', { message: err.message })); // MODIFIED
      }
    }
  };

  const handleFormSubmit = async (updates: AdminProfileUpdate) => {
    if (!selectedUser) return;

    setIsSaving(true);
    try {
      await adminService.updateUser(selectedUser.id, updates);
      alert(t('user_profile_updated_successfully')); // MODIFIED
      setIsEditModalOpen(false);
      setSelectedUser(null);
      fetchUsersAndSubscriptions(); // Refresh the list
    } catch (err: any) {
      console.error('Error updating user:', err);
      alert(t('failed_to_update_user', { message: err.message })); // MODIFIED
    } finally {
      setIsSaving(false);
    }
  };

  const handleGrantSingleUse = async (userId: string) => {
    try {
      await adminService.grantSingleUseCredit(userId);
      alert(t('single_use_credit_granted_successfully')); // MODIFIED
      fetchUsersAndSubscriptions(); // Refresh the list to show updated credits
    } catch (err: any) {
      console.error('Error granting single-use credit:', err);
      alert(t('failed_to_grant_single_use_credit', { message: err.message })); // MODIFIED
    }
  };

  const handleManageSubscription = async (userId: string, priceId: string | null, role: 'owner' | 'member' | null) => {
    try {
      await adminService.manageUserSubscription(userId, priceId, role);
      alert(t('user_subscription_role_updated_successfully')); // MODIFIED
      fetchUsersAndSubscriptions(); // Refresh the list to show updated subscription/role
    } catch (err: any) {
      console.error('Error managing user subscription:', err);
      alert(t('failed_to_manage_user_subscription', { message: err.message })); // MODIFIED
    }
  };

  const handleCreateCustomerPortal = async (userId: string) => {
    try {
      const portalUrl = await adminService.createCustomerPortalForUser(userId);
      window.open(portalUrl, '_blank');
    } catch (err: any) {
      console.error('Error creating customer portal:', err);
      alert(t('failed_to_create_customer_portal', { message: err.message })); // MODIFIED
    }
  };

  const handleEditModalClose = () => {
    setIsEditModalOpen(false);
    setSelectedUser(null);
    fetchUsersAndSubscriptions(); // MODIFIED: Ensure data is refreshed when modal closes
  };

  const handleCreateUserModalClose = () => {
    setIsCreateUserModalOpen(false);
  };

  const handleUserCreated = () => {
    setIsCreateUserModalOpen(false);
    fetchUsersAndSubscriptions(); // Refresh the list after a new user is created
  };

  const columns = [
    { key: 'full_name', header: t('full_name_table') }, // MODIFIED
    { key: 'email', header: t('email_address') }, // MODIFIED
    { key: 'business_name', header: t('business_name_table') }, // MODIFIED
    { key: 'is_admin', header: t('admin_label'), render: (item: AdminProfile) => (item.is_admin ? t('yes') : t('no')) }, // MODIFIED
    {
      key: 'subscription_details',
      header: t('subscription_label'), // MODIFIED
      render: (item: AdminProfile) => {
        let subscriptionPlanString = '';
        let singleUseCreditsString = '';

        // Check for active subscription details
        if (item.subscription_details && (item.subscription_details.status === 'active' || item.subscription_details.status === 'trialing')) {
          const sub = allSubscriptions.find(s => s.subscription_id === item.subscription_details?.subscription_id);
          subscriptionPlanString = `${t(sub?.product_name || 'unknown_product')} (${t('status_' + item.subscription_details.status)})`;
        }

        // Check for single-use credits
        if (item.single_use_credits > 0) {
          singleUseCreditsString = t('single_use_credits_display', { credits: item.single_use_credits });
        }

        // Combine or return based on what's available
        if (subscriptionPlanString && singleUseCreditsString) {
          return (
            <>
              {subscriptionPlanString}
              <br />
              {singleUseCreditsString}
            </>
          );
        } else if (subscriptionPlanString) {
          return subscriptionPlanString;
        } else if (singleUseCreditsString) {
          return singleUseCreditsString;
        } else {
          return t('none');
        }
      },
    },
    {
      key: 'membership_details',
      header: t('role_label'), // MODIFIED
      render: (item: AdminProfile) => t('role_' + item.membership_details?.role) || t('n_a'), // MODIFIED: Translate role
    },
    { key: 'mobile_phone_number', header: t('phone_label') }, // MODIFIED
    { key: 'country_code', header: t('country_code_label') }, // MODIFIED
    { key: 'theme_preference', header: t('theme_label'), render: (item: AdminProfile) => t(item.theme_preference) }, // MODIFIED: Added t() for theme_preference
    { key: 'email_reports_enabled', header: t('email_reports_label'), render: (item: AdminProfile) => (item.email_reports_enabled ? t('yes') : t('no')) }, // MODIFIED
    {
      key: 'default_jurisdictions',
      header: t('default_jurisdictions_label'), // MODIFIED
      render: (item: AdminProfile) => (
        <div className="flex flex-wrap gap-1">
          {(Array.isArray(item.default_jurisdictions) ? item.default_jurisdictions : []).map((j) => (
            <JurisdictionBadge key={j} jurisdiction={j} showLabel={true} /> // MODIFIED: Changed to true
          ))}
        </div>
      ),
    },
    {
      key: 'notification_settings',
      header: t('notification_settings_label'), // MODIFIED
      render: (item: AdminProfile) => (
        <pre className="text-xs overflow-auto max-h-20">
          {item.notification_settings ? JSON.stringify(item.notification_settings, null, 2) : t('n_a')} {/* MODIFIED */}
        </pre>
      ),
    },
    { key: 'auth_created_at', header: t('joined_label'), render: (item: AdminProfile) => new Date(item.auth_created_at).toLocaleDateString() }, // MODIFIED
  ];

  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <div className="mb-6 flex justify-between items-center">
        <Link to="/admin" className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('back_to_admin_dashboard')} {/* MODIFIED */}
        </Link>
        <Button variant="primary" icon={<UserPlus className="h-4 w-4" />} onClick={() => setIsCreateUserModalOpen(true)}>
          {t('add_new_user')} {/* MODIFIED */}
        </Button>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-6">{t('manage_users')}</h1> {/* MODIFIED */}
      <p className="text-gray-700 mb-8">{t('view_edit_delete_users')}</p> {/* MODIFIED */}

      <AdminDataTable
        data={users}
        columns={columns}
        loading={loading}
        error={error}
        onEdit={handleEdit}
        onDelete={handleDelete}
        customActions={(contract: AdminProfile) => (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleEdit(contract)}
              icon={<UserPlus className="h-4 w-4" />}
            >
              {t('edit_button')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleDelete(contract)}
              icon={<Trash2 className="h-4 w-4" />}
            >
              {t('delete_button')}
            </Button>
          </>
        )}
      />

      {selectedUser && (
        <Modal isOpen={isEditModalOpen} onClose={handleEditModalClose} title={t('edit_user', { email: selectedUser.email })}> {/* MODIFIED */}
          <UserForm
            user={selectedUser}
            allSubscriptions={allSubscriptions}
            onSubmit={handleFormSubmit}
            onCancel={handleEditModalClose}
            isSaving={isSaving}
            onGrantSingleUse={handleGrantSingleUse}
            onManageSubscription={handleManageSubscription}
            onCreateCustomerPortal={handleCreateCustomerPortal}
          />
        </Modal>
      )}

      <Modal isOpen={isCreateUserModalOpen} onClose={handleCreateUserModalClose} title={t('create_new_user')}> {/* MODIFIED */}
        <CreateUserForm
          onSuccess={handleUserCreated}
          onCancel={handleCreateUserModalClose}
          allSubscriptions={allSubscriptions}
        />
      </Modal>
    </div>
  );
};

export default AdminUsersPage;