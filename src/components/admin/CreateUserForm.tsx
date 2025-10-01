import React, { useState } from 'react';
import Button from '../ui/Button';
import { Mail, Lock, User, Phone, Checkbox, AlertCircle, CheckCircle, Users as UsersIcon, Eye, EyeOff, Briefcase, Sparkles } from 'lucide-react';
import adminService, { AvailableSubscription } from '../../services/adminService';
import { getAllJurisdictions, getJurisdictionLabel } from '../../utils/jurisdictionUtils';
import { Jurisdiction } from '../../types';
import { stripeProducts } from '../../../supabase/functions/_shared/stripe_products_data';
import { useTranslation } from 'react-i18next';

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

interface CreateUserFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  allSubscriptions: AvailableSubscription[];
}

const CreateUserForm: React.FC<CreateUserFormProps> = ({ onSuccess, onCancel, allSubscriptions }) => {
  const { t, i18n } = useTranslation();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    business_name: '',
    mobile_phone_number: '',
    country_code: countryCodes[0].code,
    is_admin: false, // ADDED: Initialize is_admin
    default_jurisdictions: [] as Jurisdiction[], // ADDED: Initialize default_jurisdictions
    send_invitation_email: true,
  });
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<'owner' | 'member' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [grantSingleUseCredit, setGrantSingleUseCredit] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target;
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

  const handleSubscriptionDropdownChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPriceId(e.target.value === '' ? null : e.target.value);
    if (e.target.value !== '' && selectedRole === null) {
      setSelectedRole('member');
    } else if (e.target.value === '') {
      setSelectedRole(null);
    }
  };

  const handleRoleDropdownChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRole(e.target.value as 'owner' | 'member');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (formData.password !== formData.confirmPassword) {
      setError(t('passwords_do_not_match'));
      setLoading(false);
      return;
    }

    if (selectedPriceId && !selectedRole) {
      setError(t('select_role_for_assigned_subscription'));
      setLoading(false);
      return;
    }

    try {
      const { userId } = await adminService.createUser({
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        business_name: formData.business_name,
        mobile_phone_number: formData.mobile_phone_number,
        country_code: formData.country_code,
        is_admin: formData.is_admin, // ADDED: Pass is_admin
        default_jurisdictions: formData.default_jurisdictions, // ADDED: Pass default_jurisdictions
        email_confirm: true,
        price_id: selectedPriceId, // ADDED: Pass selectedPriceId
        role: selectedRole, // ADDED: Pass selectedRole
        send_invitation_email: formData.send_invitation_email,
        initial_password: formData.password,
        adminLanguage: i18n.language, // MODIFIED: Re-added this line
      });

      if (grantSingleUseCredit) {
        await adminService.grantSingleUseCredit(userId);
      }

      setMessage(t('user_created_successfully'));
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
        full_name: '',
        business_name: '',
        mobile_phone_number: '',
        country_code: countryCodes[0].code,
        is_admin: false,
        default_jurisdictions: [],
        send_invitation_email: true,
      });
      setSelectedPriceId(null);
      setSelectedRole(null);
      setGrantSingleUseCredit(false);
      onSuccess();
    } catch (err: any) {
      console.error('Error creating user:', err);
      setError(err.message || t('failed_to_create_user'));
    } finally {
      setLoading(false);
    }
  };

  const getSimplifiedProductName = (productName: string) => {
    return productName
      .replace('ContractAnalyser ', '')
      .replace(' (Admin Free)', '');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {message && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative flex items-center">
          <CheckCircle className="h-5 w-5 mr-2" />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">{t('email_address')}</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
      </div>

      {/* Password Input */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">{t('password')}</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type={showPassword ? 'text' : 'password'}
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Confirm Password Input */}
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">{t('confirm_password')}</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">{t('full_name')}</label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            id="full_name"
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor="business_name" className="block text-sm font-medium text-gray-700 mb-1">{t('business_name')}</label>
        <div className="relative">
          <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            id="business_name"
            name="business_name"
            value={formData.business_name}
            onChange={handleChange}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor="mobile_phone_number" className="block text-sm font-medium text-gray-700 mb-1">{t('mobile_phone_number')}</label>
        <div className="relative flex">
          <select
            id="country_code"
            name="country_code"
            value={formData.country_code}
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
              value={formData.mobile_phone_number}
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
            checked={formData.is_admin}
            onChange={handleChange}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="ml-2">{t('grant_admin_privileges')}</span>
        </label>
      </div>

      {/* Send Invitation Email Checkbox */}
      <div>
        <label htmlFor="send_invitation_email" className="flex items-center text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            id="send_invitation_email"
            name="send_invitation_email"
            checked={formData.send_invitation_email}
            onChange={handleChange}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="ml-2">{t('send_invitation_email')}</span>
        </label>
      </div>

      <div>
        <label htmlFor="grant_single_use_credit" className="flex items-center text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            id="grant_single_use_credit"
            name="grant_single_use_credit"
            checked={grantSingleUseCredit}
            onChange={(e) => setGrantSingleUseCredit(e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="ml-2 flex items-center">
            {t('grant_single_use_credit')} <Sparkles className="h-4 w-4 ml-1 text-yellow-500" />
          </span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('default_jurisdictions')}</label>
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
              {t(getJurisdictionLabel(jurisdiction))}
            </button>
          ))}
        </div>
      </div>

      <h3 className="text-lg font-medium text-gray-900 flex items-center mb-2 pt-4 border-t border-gray-200">
        <UsersIcon className="h-5 w-5 text-blue-900 mr-2" /> {t('assign_subscription')}
      </h3>
      <div>
        <label htmlFor="assign_subscription" className="block text-sm font-medium text-gray-700 mb-1">{t('assign_to_subscription')}:</label>
        <select
          id="assign_subscription"
          name="assign_subscription"
          value={selectedPriceId || ''}
          onChange={handleSubscriptionDropdownChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          disabled={loading}
        >
          <option value="">{t('no_subscription')}</option>
          {stripeProducts
            .filter(product => product.mode === 'admin_assigned')
            .map((product) => (
              <React.Fragment key={product.id}>
                {product.pricing.monthly && (
                  <option value={product.pricing.monthly.priceId}>
                    {getSimplifiedProductName(t(product.name))}
                  </option>
                )}
              </React.Fragment>
            ))}
        </select>
      </div>

      {selectedPriceId && (
        <div>
          <label htmlFor="assign_role" className="block text-sm font-medium text-gray-700 mb-1">{t('role_in_subscription')}:</label>
          <select
            id="assign_role"
            name="assign_role"
            value={selectedRole || ''}
            onChange={handleRoleDropdownChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            required={selectedPriceId !== null}
            disabled={loading}
          >
            <option value="">{t('select_role')}</option>
            <option value="owner">{t('owner')}</option>
            <option value="member">{t('member')}</option>
          </select>
        </div>
      )}

      <div className="flex justify-end space-x-3 mt-6">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          {t('cancel_button')}
        </Button>
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? t('creating_user_button') : t('create_user_button')}
        </Button>
      </div>
    </form>
  );
};

export default CreateUserForm;