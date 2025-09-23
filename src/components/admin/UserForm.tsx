import React, { useState, useEffect } from 'react';
import Button from '../ui/Button';
import { Mail, User, Phone, Check as Checkbox, CreditCard, Users as UsersIcon, Sparkles, Briefcase } from 'lucide-react';
import { AdminProfile, AdminProfileUpdate, AvailableSubscription } from '../../services/adminService';
import { getAllJurisdictions, getJurisdictionLabel } from '../../utils/jurisdictionUtils'; // MODIFIED: Import getJurisdictionLabel
import { Jurisdiction } from '../../types';
import { stripeProducts } from '../../../supabase/functions/_shared/stripe_products_data'; // ADDED: Import stripeProducts
import { useTranslation } from 'react-i18next'; // ADDED

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
  allSubscriptions: AvailableSubscription[]; // This prop is still passed but its content is not used for plan selection
  onSubmit: (updates: AdminProfileUpdate) => void;
  onCancel: () => void;
  isSaving: boolean;
  onGrantSingleUse: (userId: string) => Promise<void>;
  onManageSubscription: (userId: string, priceId: string | null, role: 'owner' | 'member' | null) => Promise<void>; // MODIFIED: priceId instead of subscriptionId
  onCreateCustomerPortal: (userId: string) => Promise<void>;
}

const UserForm: React.FC<UserFormProps> = ({
  user,
  allSubscriptions, // Keep this prop, but we'll use stripeProducts for plan selection
  onSubmit,
  onCancel,
  isSaving,
  onGrantSingleUse,
  onManageSubscription,
  onCreateCustomerPortal
}) => {
  const { t } = useTranslation(); // ADDED

  const [formData, setFormData] = useState<AdminProfileUpdate>({
    full_name: user.full_name || '',
    business_name: user.business_name || '',
    mobile_phone_number: user.mobile_phone_number || '',
    country_code: user.country_code || countryCodes[0].code,
    is_admin: user.is_admin || false,
    theme_preference: user.theme_preference,
    email_reports_enabled: user.email_reports_enabled,
    default_jurisdictions: user.default_jurisdictions,
    notification_settings: user.notification_settings,
  });

  // MODIFIED: Use priceId for selection, initialize based on user's current price_id if available
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(() => {
    if (user.subscription_details?.price_id) {
      return user.subscription_details.price_id;
    }
    return null;
  });
  const [selectedRole, setSelectedRole] = useState<'owner' | 'member' | null>(user.membership_details?.role || null);

  const [isGrantingCredit, setIsGrantingCredit] = useState(false);
  const [isManagingSubscription, setIsManagingSubscription] = useState(false);
  const [isCreatingPortal, setIsCreatingPortal] = useState(false);

  useEffect(() => {
    setFormData({
      full_name: user.full_name || '',
      business_name: user.business_name || '',
      mobile_phone_number: user.mobile_phone_number || '',
      country_code: user.country_code || countryCodes[0].code,
      is_admin: user.is_admin || false,
      theme_preference: user.theme_preference,
      email_reports_enabled: user.email_reports_enabled,
      default_jurisdictions: user.default_jurisdictions,
      notification_settings: user.notification_settings,
    });

    // MODIFIED: Update selectedPriceId on user change
    setSelectedPriceId(user.subscription_details?.price_id || null);
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
    console.log('UserForm: handleSubscriptionChange triggered.');
    setIsManagingSubscription(true);
    try {
      // MODIFIED: Pass selectedPriceId instead of selectedSubscriptionId
      console.log('UserForm: Calling onManageSubscription with:', user.id, selectedPriceId, selectedRole);
      await onManageSubscription(user.id, selectedPriceId, selectedRole);
      alert(t('user_subscription_updated_successfully')); // MODIFIED
      onCancel();
    } catch (error: any) {
      console.error('UserForm: Error in handleSubscriptionChange:', error);
      alert(t('failed_to_update_subscription', { message: error.message })); // MODIFIED
    } finally {
      setIsManagingSubscription(false);
    }
  };

  const handleRoleDropdownChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRole(e.target.value === '' ? null : e.target.value as 'owner' | 'member');
  };

  const handleGrantCredit = async () => {
    setIsGrantingCredit(true);
    try {
      await onGrantSingleUse(user.id);
      alert(t('single_use_credit_granted_successfully')); // MODIFIED
      onCancel();
    } catch (error: any) {
      alert(t('failed_to_grant_credit', { message: error.message })); // MODIFIED
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
      alert(t('failed_to_open_customer_portal', { message: error.message })); // MODIFIED
    } finally {
      setIsCreatingPortal(false);
    }
  };

  // Helper function to get simplified product name for display
  const getSimplifiedProductName = (productName: string) => {
    return productName
      .replace('ContractAnalyser ', '')
      .replace(' (Admin Free)', '');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Profile Information */}
      <h3 className="text-lg font-medium text-gray-900 flex items-center mb-2">
        <User className="h-5 w-5 text-blue-900 mr-2" /> {t('profile_information')} {/* MODIFIED */}
      </h3>
      <div>
        <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">{t('full_name')}</label> {/* MODIFIED */}
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
        <label htmlFor="business_name" className="block text-sm font-medium text-gray-700 mb-1">{t('business_name')}</label> {/* MODIFIED */}
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
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">{t('email')}</label> {/* MODIFIED */}
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
        <label htmlFor="mobile_phone_number" className="block text-sm font-medium text-gray-700 mb-1">{t('mobile_phone_number')}</label> {/* MODIFIED */}
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
          <span className="ml-2">{t('is_admin')}</span> {/* MODIFIED */}
        </label>
      </div>

      {/* Theme Preference */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('theme_preference')}</label> {/* MODIFIED */}
        <select
          id="theme_preference"
          name="theme_preference"
          value={formData.theme_preference || 'system'}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        >
          <option value="light">{t('light')}</option> {/* MODIFIED */}
          <option value="dark">{t('dark')}</option> {/* MODIFIED */}
          <option value="system">{t('system')}</option> {/* MODIFIED */}
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
          <span className="ml-2">{t('email_reports_enabled')}</span> {/* MODIFIED */}
        </label>
      </div>

      {/* Default Jurisdictions */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('default_jurisdictions')}</label> {/* MODIFIED */}
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
              {t(getJurisdictionLabel(jurisdiction))} {/* MODIFIED: Use getJurisdictionLabel for consistency */}
            </button>
          ))}
        </div>
      </div>

      {/* Subscription & Role Management */}
      <h3 className="text-lg font-medium text-gray-900 flex items-center mb-2 pt-4 border-t border-gray-200">
        <CreditCard className="h-5 w-5 text-blue-900 mr-2" /> {t('subscription_role')} {/* MODIFIED */}
      </h3>
      <div className="space-y-3">
        <div>
          <label htmlFor="subscription_plan" className="block text-sm font-medium text-gray-700 mb-1">{t('assign_subscription_plan')}:</label> {/* MODIFIED */}
          <select
            id="subscription_plan"
            name="subscription_plan"
            value={selectedPriceId || ''} // MODIFIED: Use selectedPriceId
            onChange={(e) => setSelectedPriceId(e.target.value === '' ? null : e.target.value)} // MODIFIED: Set selectedPriceId
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            disabled={isManagingSubscription}
          >
            <option value="">{t('no_subscription')}</option> {/* MODIFIED */}
            {stripeProducts
              .filter(product => product.mode === 'admin_assigned') // Filter for admin_assigned products only
              .map((product) => (
                <React.Fragment key={product.id}>
                  {product.pricing.monthly && ( // Assuming admin_assigned plans only have a 'monthly' priceId for internal use
                    <option value={product.pricing.monthly.priceId}>
                      {getSimplifiedProductName(t(product.name))} {/* MODIFIED: Translate product.name */}
                    </option>
                  )}
                </React.Fragment>
              ))}
          </select>
        </div>

        {selectedPriceId && ( // Only show role if a priceId is selected
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">{t('role_in_subscription')}:</label> {/* MODIFIED */}
            <select
              id="role"
              name="role"
              value={selectedRole || ''}
              onChange={handleRoleDropdownChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              disabled={isManagingSubscription}
            >
              <option value="">{t('select_role')}</option> {/* MODIFIED */}
              <option value="owner">{t('owner')}</option> {/* MODIFIED */}
              <option value="member">{t('member')}</option> {/* MODIFIED */}
            </select>
          </div>
        )}

        <div className="flex flex-col space-y-2">
          <Button
            type="button"
            variant="primary"
            onClick={handleSubscriptionChange}
            // MODIFIED: Disable if no priceId selected or role is null when priceId is selected
            disabled={isManagingSubscription || (selectedPriceId !== null && selectedRole === null)}
            icon={<UsersIcon className="h-4 w-4" />}
          >
            {isManagingSubscription ? t('updating_subscription') : t('assign_update_subscription')} {/* MODIFIED */}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleGrantCredit}
            disabled={isGrantingCredit}
            icon={<Sparkles className="h-4 w-4" />}
          >
            {isGrantingCredit ? t('granting_credit') : t('grant_single_use_credit')} {/* MODIFIED */}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleCreatePortal}
            disabled={isCreatingPortal || !user.customer_id}
            icon={<CreditCard className="h-4 w-4" />}
          >
            {isCreatingPortal ? t('opening_portal') : t('manage_subscription_stripe')} {/* MODIFIED */}
          </Button>
          {!user.customer_id && (
            <p className="text-xs text-gray-500">{t('no_stripe_customer_id')}</p> 
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-3 mt-6">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>
          {t('cancel')} {/* MODIFIED */}
        </Button>
        <Button type="submit" variant="primary" disabled={isSaving}>
          {isSaving ? t('saving_profile') : t('save_profile_changes')} {/* MODIFIED */}
        </Button>
      </div>
    </form>
  );
};

export default UserForm;