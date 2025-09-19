import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSupabaseClient, useSessionContext } from '@supabase/auth-helpers-react';
import Button from '../components/ui/Button';
import Card, { CardBody, CardHeader } from '../components/ui/Card';
import { Mail, Lock, User, Phone, Eye, EyeOff, Briefcase } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// A simplified list of country codes for demonstration.
// For a comprehensive list of over 80 countries, you would typically import from a library
// or a larger data file.
const countryCodes = [
  { code: '+1', name_key: 'country_us_canada' },
  { code: '+44', name_key: 'country_united_kingdom' },
  { code: '+91', name_key: 'country_india' },
  { code: '+61', name_key: 'country_australia' },
  { code: '+64', name_key: 'country_new_zealand' },
  { code: '+49', name_key: 'country_germany' },
  { code: '+33', name_key: 'country_france' },
  { code: '+81', name_key: 'country_japan' },
  { code: '+86', name_key: 'country_china' },
  { code: '+55', name_key: 'country_brazil' },
  { code: '+27', name_key: 'country_south_africa' },
  { code: '+353', name_key: 'country_ireland' },
  { code: '+356', name_key: 'country_malta' },
  { code: '+357', name_key: 'country_cyprus' },
  { code: '+34', name_key: 'country_spain' },
  { code: '+39', name_key: 'country_italy' },
  { code: '+7', name_key: 'country_russia_kazakhstan' },
  { code: '+20', name_key: 'country_egypt' },
  { code: '+971', name_key: 'country_united_arab_emirates' },
  { code: '+966', name_key: 'country_saudi_arabia' },
  { code: '+65', name_key: 'country_singapore' },
  { code: '+60', name_key: 'country_malaysia' },
  { code: '+62', name_key: 'country_indonesia' },
  { code: '+63', name_key: 'country_philippines' },
  { code: '+66', name_key: 'country_thailand' },
  { code: '+82', name_key: 'country_south_korea' },
  { code: '+84', name_key: 'country_vietnam' },
  { code: '+90', name_key: 'country_turkey' },
  { code: '+52', name_key: 'country_mexico' },  
  { code: '+46', name_key: 'country_sweden' },
  { code: '+47', name_key: 'country_norway' },
  { code: '+45', name_key: 'country_denmark' },
  { code: '+358', name_key: 'country_finland' },
  { code: '+41', name_key: 'country_switzerland' },
  { code: '+43', name_key: 'country_austria' },
  { code: '+32', name_key: 'country_belgium' },
  { code: '+31', name_key: 'country_netherlands' },
  { code: '+30', name_key: 'country_greece' },
  { code: '+351', name_key: 'country_portugal' },
  { code: '+48', name_key: 'country_poland' },
  { code: '+420', name_key: 'country_czech_republic' },
  { code: '+36', name_key: 'country_hungary' },
  { code: '+40', name_key: 'country_romania' },
  { code: '+380', name_key: 'country_ukraine' },  
  { code: '+994', name_key: 'country_azerbaijan' },
  { code: '+995', name_key: 'country_georgia' },
  { code: '+998', name_key: 'country_uzbekistan' },
  { code: '+972', name_key: 'country_israel' },
  { code: '+962', name_key: 'country_jordan' },
  { code: '+961', name_key: 'country_lebanon' },
  { code: '+965', name_key: 'country_kuwait' },
  { code: '+974', name_key: 'country_qatar' },
  { code: '+973', name_key: 'country_bahrain' },
  { code: '+968', name_key: 'country_oman' },
  { code: '+960', name_key: 'country_maldives' },
  { code: '+977', name_key: 'country_nepal' },
  { code: '+94', name_key: 'country_sri_lanka' },
  { code: '+880', name_key: 'country_bangladesh' },
  { code: '+95', name_key: 'country_myanmar' },
  { code: '+855', name_key: 'country_cambodia' },
  { code: '+856', name_key: 'country_laos' },
  { code: '+853', name_key: 'country_macau' },
  { code: '+852', name_key: 'country_hong_kong' },
  { code: '+886', name_key: 'country_taiwan' },
  { code: '+673', name_key: 'country_brunei' },
  { code: '+675', name_key: 'country_papua_new_guinea' },
  { code: '+679', name_key: 'country_fiji' },
  { code: '+685', name_key: 'country_samoa' },
  { code: '+676', name_key: 'country_tonga' },
  { code: '+678', name_key: 'country_vanuatu' },
  { code: '+687', name_key: 'country_new_caledonia' },
  { code: '+689', name_key: 'country_french_polynesia' },
  { code: '+691', name_key: 'country_micronesia' },
  { code: '+692', name_key: 'country_marshall_islands' },
  { code: '+680', name_key: 'country_palau' },
  { code: '+677', name_key: 'country_solomon_islands' },
  { code: '+686', name_key: 'country_kiribati' },
  { code: '+690', name_key: 'country_tokelau' },
  { code: '+688', name_key: 'country_tuvalu' },
  { code: '+682', name_key: 'country_niue' },
  { code: '+683', name_key: 'country_nauru' },
  { code: '+681', name_key: 'country_american_samoa' },
  { code: '+684', name_key: 'country_northern_mariana_islands' },
  { code: '+671', name_key: 'country_guam' },
];


const SignupPage: React.FC = () => {
  console.log('SignupPage: Component rendered. Current URL:', window.location.href);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [mobilePhoneNumber, setMobilePhoneNumber] = useState('');
  const [selectedCountryCode, setSelectedCountryCode] = useState(countryCodes[0].code);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = useSupabaseClient();
  const navigate = useNavigate();
  const { isLoading } = useSessionContext();
  const [searchParams] = useSearchParams();
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const tokenFromUrl = searchParams.get('invitation_token');
    if (tokenFromUrl) {
      setInvitationToken(tokenFromUrl);
    }
  }, [searchParams]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError(t('passwords_do_not_match'));
      setLoading(false);
      return;
    }

    const phoneRegex = /^[0-9]+$/;
    if (mobilePhoneNumber && !phoneRegex.test(mobilePhoneNumber)) {
      setError(t('mobile_phone_number_digits_only'));
      setLoading(false);
      return;
    }

    let emailRedirectToUrl = `${import.meta.env.VITE_APP_BASE_URL}/auth/callback`;
    let redirectParamForEmailSentPage = '';

    const originalRedirectParam = searchParams.get('redirect');
    
    let targetRedirectPath = '';

    if (invitationToken) {
      targetRedirectPath = `/accept-invitation?token=${encodeURIComponent(invitationToken)}`;
    }

    if (originalRedirectParam) {
      if (targetRedirectPath) {
        targetRedirectPath = `${originalRedirectParam}&redirect=${encodeURIComponent(targetRedirectPath)}`;
      } else {
        targetRedirectPath = originalRedirectParam;
      }
    }

    if (targetRedirectPath) {
      emailRedirectToUrl += `?redirect=${encodeURIComponent(targetRedirectPath)}`;
      redirectParamForEmailSentPage = `?redirect=${encodeURIComponent(targetRedirectPath)}`;
    }

    console.log('SignupPage: Options passed to supabase.auth.signUp:', {
      emailRedirectTo: emailRedirectToUrl,
      data: {
        full_name: fullName,
        business_name: businessName,
        mobile_phone_number: mobilePhoneNumber,
        country_code: selectedCountryCode,
      },
    });

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: emailRedirectToUrl,
        data: {
          full_name: fullName,
          business_name: businessName,
          mobile_phone_number: mobilePhoneNumber,
          country_code: selectedCountryCode,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
    } else {
      if (signUpData.user) {
        try {
          await supabase.functions.invoke('create-user-profile', {
            body: {
              userId: signUpData.user.id,
              fullName: fullName,
              businessName: businessName,
              mobilePhoneNumber: mobilePhoneNumber,
              countryCode: selectedCountryCode,
            },
          });
          console.log('Profile creation initiated from SignupPage.');
        } catch (profileError) {
          console.error('Error initiating profile creation from SignupPage:', profileError);
        }
      }
      localStorage.setItem('signup_email', email);
      navigate(`/auth/email-sent${redirectParamForEmailSentPage}`);
    }
    
    setLoading(false);
  };

  if (isLoading) {
    return null;
  }

  const loginLink = searchParams.get('redirect') ? `/login?redirect=${encodeURIComponent(searchParams.get('redirect')!)}` : '/login';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">{t('create_your_account')}</h2>
          <p className="mt-2 text-sm text-gray-600">
            {t('start_analyzing')}
          </p>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSignup} className="space-y-6">
            {/* Full Name Input */}
            <div>
              <label htmlFor="fullName" className="sr-only">{t('full_name')}</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  autoComplete="name"
                  required
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder={t('full_name')}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>

            {/* Business Name Input */}
            <div>
              <label htmlFor="businessName" className="sr-only">{t('business_name')}</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  id="businessName"
                  name="businessName"
                  autoComplete="organization"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder={t('business_name')}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="sr-only">{t('email_address')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  autoComplete="email"
                  required
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder={t('email_address')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Mobile Phone Number Input with Country Code */}
            <div>
              <label htmlFor="mobilePhoneNumber" className="sr-only">{t('mobile_phone_number')}</label>
              <div className="relative flex">
                <select
                  id="countryCode"
                  name="countryCode"
                  value={selectedCountryCode}
                  onChange={(e) => setSelectedCountryCode(e.target.value)}
                  className="flex-shrink-0 w-24 pl-3 pr-8 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  {countryCodes.map((country) => (
                    <option key={country.code} value={country.code}>
                      {t(country.name_key)} {/* MODIFIED */}
                    </option>
                  ))}
                </select>
                <div className="relative flex-grow">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="mobilePhoneNumber"
                    name="mobilePhoneNumber"
                    type="tel"
                    pattern="[0-9]*"
                    autoComplete="tel"
                    required
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-r-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder={t('mobile_phone_number')}
                    value={mobilePhoneNumber}
                    onChange={(e) => setMobilePhoneNumber(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="password" className="sr-only">{t('password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  autoComplete="new-password"
                  required
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder={t('password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="sr-only">{t('confirm_password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirm-password"
                  name="confirm-password"
                  autoComplete="new-password"
                  required
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder={t('confirm_password')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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

            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}

            <div>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={loading}
              >
                {loading ? t('signing_up') : t('signup')}
              </Button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {t('already_have_account')}{' '}
              <Link to={loginLink} className="font-medium text-blue-600 hover:text-blue-500">
                {t('login')}
              </Link>
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default SignupPage;