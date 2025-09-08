import React, { useState, useEffect } from 'react';
import Button from '../ui/Button';
import { Mail, User, Phone, Check as Checkbox, CreditCard, Users as UsersIcon, Sparkles, Briefcase } from 'lucide-react'; // ADDED Briefcase
import { AdminProfile, AdminProfileUpdate, AvailableSubscription } from '../../services/adminService';
import { getAllJurisdictions } from '../../utils/jurisdictionUtils';
import { Jurisdiction } from '../../types';
import { stripeProducts } from '../../../supabase/functions/_shared/stripe_products_data';

// A simplified list of country codes for demonstration.
const countryCodes = [
  { code: '+1', name: 'US/Canada' },
  { code: '+44', name: 'United Kingdom' },
  { code: '+91', name: 'India' },
  { code: '+61', name: 'Australia' },
  { code: '+64', name: 'New Zealand' },
  { code: '+49', name: 'Germany' },
  { code: '+33', name: 'France' },
  { code: '+81', name: 'Japan' },
  { code: '+86', name: 'China' },
  { code: '+55', name: 'Brazil' },
  { code: '+27', name: 'South Africa' },
  { code: '+353', name: 'Ireland' },
  { code: '+356', name: 'Malta' },
  { code: '+357', name: 'Cyprus' },
  { code: '+34', name: 'Spain' },
  { code: '+39', name: 'Italy' },
  { code: '+7', name: 'Russia/Kazakhstan' },
  { code: '+20', name: 'Egypt' },
  { code: '+971', name: 'United Arab Emirates' },
  { code: '+966', 'name': 'Saudi Arabia' },
  { code: '+65', name: 'Singapore' },
  { code: '+60', name: 'Malaysia' },
  { code: '+62', name: 'Indonesia' },
  { code: '+63', name: 'Philippines' },
  { code: '+66', name: 'Thailand' },
  { code: '+82', name: 'South Korea' },
  { code: '+84', name: 'Vietnam' },
  { code: '+90', name: 'Turkey' },
  { code: '+52', name: 'Mexico' },  
  { code: '+46', name: 'Sweden' },
  { code: '+47', name: 'Norway' },
  { code: '+45', name: 'Denmark' },
  { code: '+358', name: 'Finland' },
  { code: '+41', name: 'Switzerland' },
  { code: '+43', name: 'Austria' },
  { code: '+32', name: 'Belgium' },
  { code: '+31', name: 'Netherlands' },
  { code: '+30', name: 'Greece' },
  { code: '+351', name: 'Portugal' },
  { code: '+48', name: 'Poland' },
  { code: '+420', name: 'Czech Republic' },
  { code: '+36', name: 'Hungary' },
  { code: '+40', name: 'Romania' },
  { code: '+380', name: 'Ukraine' },  
  { code: '+994', name: 'Azerbaijan' },
  { code: '+995', name: 'Georgia' },
  { code: '+998', name: 'Uzbekistan' },
  { code: '+972', name: 'Israel' },
  { code: '+962', name: 'Jordan' },
  { code: '+961', name: 'Lebanon' },
  { code: '+965', name: 'Kuwait' },
  { code: '+974', name: 'Qatar' },
  { code: '+973', name: 'Bahrain' },
  { code: '+968', name: 'Oman' },
  { code: '+960', name: 'Maldives' },
  { code: '+977', name: 'Nepal' },
  { code: '+94', name: 'Sri Lanka' },
  { code: '+880', name: 'Bangladesh' },
  { code: '+95', name: 'Myanmar' },
  { code: '+855', name: 'Cambodia' },
  { code: '+856', name: 'Laos' },
  { code: '+853', name: 'Macau' },
  { code: '+852', name: 'Hong Kong' },
  { code: '+886', name: 'Taiwan' },
  { code: '+673', name: 'Brunei' },
  { code: '+675', name: 'Papua New Guinea' },
  { code: '+679', name: 'Fiji' },
  { code: '+685', name: 'Samoa' },
  { code: '+676', name: 'Tonga' },
  { code: '+678', name: 'Vanuatu' },
  { code: '+687', name: 'New Caledonia' },
  { code: '+689', name: 'French Polynesia' },
  { code: '+691', name: 'Micronesia' },
  { code: '+692', name: 'Marshall Islands' },
  { code: '+680', name: 'Palau' },
  { code: '+677', name: 'Solomon Islands' },
  { code: '+686', name: 'Kiribati' },
  { code: '+690', name: 'Tokelau' },
  { code: '+688', name: 'Tuvalu' },
  { code: '+682', name: 'Niue' },
  { code: '+683', name: 'Nauru' },
  { code: '+681', name: 'American Samoa' },
  { code: '+684', name: 'Northern Mariana Islands' },
  { code: '+671', name: 'Guam' },
];

interface UserFormProps {
  user: AdminProfile;
  allSubscriptions: AvailableSubscription[];
  onSubmit: (updates: AdminProfileUpdate) => void;
  onCancel: () => void;
  isSaving: boolean;
  onGrantSingleUse: (userId: string) => Promise<void>;
  onManageSubscription: (userId: string, subscriptionId: string | null, role: 'owner' | 'member' | null) => Promise<void>;
  onCreateCustomerPortal: (userId: string) => Promise<void>;
}

const UserForm: React.FC<UserFormProps> = ({
  user,
  allSubscriptions,
  onSubmit,
  onCancel,
  isSaving,
  onGrantSingleUse,
  onManageSubscription,
  onCreateCustomerPortal
}) => {
  const [formData, setFormData] = useState<AdminProfileUpdate>({
    full_name: user.full_name || '',
    business_name: user.business_name || '', // ADDED: Initialize business_name
    mobile_phone_number: user.mobile_phone_number || '',
    country_code: user.country_code || countryCodes[0].code,
    is_admin: user.is_admin || false,
    theme_preference: user.theme_preference,
    email_reports_enabled: user.email_reports_enabled,
    default_jurisdictions: user.default_jurisdictions,
    notification_settings: user.notification_settings,
  });
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string | null>(user.membership_details?.subscription_id || null);
  const [selectedRole, setSelectedRole] = useState<'owner' | 'member' | null>(user.membership_details?.role || null);

  const [isGrantingCredit, setIsGrantingCredit] = useState(false);
  const [isManagingSubscription, setIsManagingSubscription] = useState(false);
  const [isCreatingPortal, setIsCreatingPortal] = useState(false);

  useEffect(() => {
    setFormData({
      full_name: user.full_name || '',
      business_name: user.business_name || '', // ADDED: Update business_name on user change
      mobile_phone_number: user.mobile_phone_number || '',
      country_code: user.country_code || countryCodes[0].code,
      is_admin: user.is_admin || false,
      theme_preference: user.theme_preference,
      email_reports_enabled: user.email_reports_enabled,
      default_jurisdictions: user.default_jurisdictions,
      notification_settings: user.notification_settings,
    });
    setSelectedSubscriptionId(user.membership_details?.subscription_id || null);
    setSelectedRole(user.membership_details?.role || null);
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleJurisdictionToggle = (jurisdiction: Jurisdiction) => {
    setFormData(prev => {
      const currentJurisdictions = (prev.default_jurisdictions || []) as Jurisdiction[];
      const updatedJurisdictions = currentJurisdictions.includes(jurisdiction)
        ? currentJurisdictions.filter(j => j !== jurisdiction)
        : [...currentJurisdictions, jurisdiction];
      return {
        ...prev,
        default_jurisdictions: updatedJurisdictions,
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData); // Submit profile updates
  };

  const handleSubscriptionChange = async () => {
    setIsManagingSubscription(true);
    try {
      await onManageSubscription(user.id, selectedSubscriptionId, selectedRole);
      alert('User subscription updated successfully!');
      onCancel(); // Close modal and trigger refresh
    } catch (error: any) {
      alert(`Failed to update subscription: ${error.message}`);
    } finally {
      setIsManagingSubscription(false);
    }
  };

  const handleRoleDropdownChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRole(e.target.value as 'owner' | 'member');
  };

  const handleGrantCredit = async () => {
    setIsGrantingCredit(true);
    try {
      await onGrantSingleUse(user.id);
      alert('Single-use credit granted successfully!');
      onCancel(); // Close modal and trigger refresh
    } catch (error: any) {
      alert(`Failed to grant credit: ${error.message}`);
    } finally {
      setIsGrantingCredit(false);
    }
  };

  const handleCreatePortal = async () => {
    setIsCreatingPortal(true);
    try {
      const portalUrl = await onCreateCustomerPortal(user.id);
      window.open(portalUrl, '_blank'); // Open in new tab
    } catch (error) {
      alert(`Failed to open customer portal: ${error.message}`);
    } finally {
      setIsCreatingPortal(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Profile Information */}
      <h3 className="text-lg font-medium text-gray-900 flex items-center mb-2">
        <User className="h-5 w-5 text-blue-900 mr-2" /> Profile Information
      </h3>
      <div>
        <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            id="full_name"
            name="full_name"
            value={formData.full_name || ''}
            onChange={handleChange}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
      </div>

      {/* Business Name Input */}
      <div>
        <label htmlFor="business_name" className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
        <div className="relative">
          <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            id="business_name"
            name="business_name"
            value={formData.business_name || ''}
            onChange={handleChange}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="email"
            id="email"
            name="email"
            value={user.email} // Email is read-only, comes from auth.users
            readOnly
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 cursor-not-allowed sm:text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor="mobile_phone_number" className="block text-sm font-medium text-gray-700 mb-1">Mobile Phone Number</label>
        <div className="relative flex">
          <select
            id="country_code"
            name="country_code"
            value={formData.country_code || countryCodes[0].code}
            onChange={handleChange}
            className="flex-shrink-0 w-24 pl-3 pr-8 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            {countryCodes.map((country) => (
              <option key={country.code} value={country.code}>
                {country.code}
              </option>
            ))}
          </select>
          <div className="relative flex-grow">
            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              id="mobile_phone_number"
              name="mobile_phone_number"
              type="tel"
              value={formData.mobile_phone_number || ''}
              onChange={handleChange}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-r-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="is_admin" className="flex items-center text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            id="is_admin"
            name="is_admin"
            checked={formData.is_admin || false}
            onChange={handleChange}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="ml-2">Is Admin</span>
        </label>
      </div>

      {/* Theme Preference */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Theme Preference</label>
        <select
          id="theme_preference"
          name="theme_preference"
          value={formData.theme_preference || 'system'}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </div>

      {/* Email Reports Enabled */}
      <div>
        <label htmlFor="email_reports_enabled" className="flex items-center text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            id="email_reports_enabled"
            name="email_reports_enabled"
            checked={formData.email_reports_enabled || false}
            onChange={handleChange}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="ml-2">Email Reports Enabled</span>
        </label>
      </div>

      {/* Default Jurisdictions */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Default Jurisdictions</label>
        <div className="flex flex-wrap gap-2">
          {getAllJurisdictions().map((jurisdiction) => (
            <button
              key={jurisdiction}
              type="button"
              onClick={() => handleJurisdictionToggle(jurisdiction)}
              className={`py-1 px-3 rounded-full text-xs font-medium transition-colors
                ${(formData.default_jurisdictions || []).includes(jurisdiction)
                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                  : 'bg-gray-100 text-gray-800 border border-gray-200 hover:bg-gray-200'
                }`}
            >
              {jurisdiction}
            </button>
          ))}
        </div>
      </div>

      {/* Subscription & Role Management */}
      <h3 className="text-lg font-medium text-gray-900 flex items-center mb-2 pt-4 border-t border-gray-200">
        <CreditCard className="h-5 w-5 text-blue-900 mr-2" /> Subscription & Role
      </h3>
      <div className="space-y-3">
        <div>
          <label htmlFor="subscription_id" className="block text-sm font-medium text-gray-700 mb-1">Assign Subscription:</label>
          <select
            id="subscription_id"
            name="subscription_id"
            value={selectedSubscriptionId || ''}
            onChange={(e) => setSelectedSubscriptionId(e.target.value === '' ? null : e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            disabled={isManagingSubscription}
          >
            <option value="">-- No Subscription --</option>
            {allSubscriptions.map((sub) => (
              <option key={sub.subscription_id} value={sub.subscription_id}>
                {sub.product_name} - Max Users: {sub.max_users === 999999 ? 'Unlimited' : sub.max_users} {/* MODIFIED */}
              </option>
            ))}
          </select>
        </div>

        {selectedSubscriptionId && (
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">Role in Subscription:</label>
            <select
              id="role"
              name="role"
              value={selectedRole || ''}
              onChange={handleRoleDropdownChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              disabled={isManagingSubscription}
            >
              <option value="owner">Owner</option>
              <option value="member">Member</option>
            </select>
          </div>
        )}

        <div className="flex flex-col space-y-2">
          <Button
            type="button"
            variant="primary"
            onClick={handleSubscriptionChange}
            disabled={isManagingSubscription || (selectedSubscriptionId !== null && selectedRole === null)}
            icon={<UsersIcon className="h-4 w-4" />}
          >
            {isManagingSubscription ? 'Updating Subscription...' : 'Update Subscription'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleGrantCredit}
            disabled={isGrantingCredit}
            icon={<Sparkles className="h-4 w-4" />}
          >
            {isGrantingCredit ? 'Granting Credit...' : 'Grant Single-Use Credit'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleCreatePortal}
            disabled={isCreatingPortal || !user.customer_id}
            icon={<CreditCard className="h-4 w-4" />}
          >
            {isCreatingPortal ? 'Opening Portal...' : 'Manage Subscription in Stripe'}
          </Button>
          {!user.customer_id && (
            <p className="text-xs text-gray-500">User has no associated Stripe customer ID.</p>
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-3 mt-6">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={isSaving}>
          {isSaving ? 'Saving Profile...' : 'Save Profile Changes'}
        </Button>
      </div>
    </form>
  );
};

export default UserForm;