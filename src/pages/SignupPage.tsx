import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSupabaseClient, useSessionContext } from '@supabase/auth-helpers-react';
import Button from '../components/ui/Button';
import Card, { CardBody, CardHeader } => '../components/ui/Card';
import { Mail, Lock, User, Phone, Eye, EyeOff, Briefcase } from 'lucide-react';

// A simplified list of country codes for demonstration.
// For a comprehensive list of over 80 countries, you would typically import from a library
// or a larger data file.
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
  const [invitationToken, setInvitationToken] = useState<string | null>(null); // State to store invitation token

  useEffect(() => {
    // Check for invitation_token in URL query parameters
    const tokenFromUrl = searchParams.get('invitation_token');
    if (tokenFromUrl) {
      setInvitationToken(tokenFromUrl);
      // Optionally, remove it from URL to keep it clean, but ensure it's stored
      // navigate(location.pathname, { replace: true }); // This would remove it from the URL
    }
  }, [searchParams]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    // Start building the emailRedirectTo URL
    let emailRedirectToUrl = `${import.meta.env.VITE_APP_BASE_URL}/auth/callback`;
    let redirectParamForEmailSentPage = ''; // This will hold the final redirect param for EmailSentPage

    const originalRedirectParam = searchParams.get('redirect');
    
    let targetRedirectPath = '';

    // Prioritize invitation token redirect if it exists
    if (invitationToken) {
      targetRedirectPath = `/accept-invitation?token=${encodeURIComponent(invitationToken)}`;
    }

    // If there's an original redirect, combine it with the invitation redirect if both exist
    // Otherwise, use the original redirect as the target
    if (originalRedirectParam) {
      if (targetRedirectPath) {
        // If both exist, chain them. The AuthCallbackPage will handle this.
        // Example: /original-path?param=value&redirect=/accept-invitation?token=xyz
        targetRedirectPath = `${originalRedirectParam}&redirect=${encodeURIComponent(targetRedirectPath)}`;
      } else {
        targetRedirectPath = originalRedirectParam;
      }
    }

    // Append the constructed targetRedirectPath to the emailRedirectToUrl
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
      // Navigate to EmailSentPage, passing the correctly constructed redirectParamForEmailSentPage
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
          <h2 className="text-2xl font-bold text-gray-900">Create Your Account</h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign up to start analyzing your legal contracts.
          </p>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSignup} className="space-y-6">
            {/* Full Name Input */}
            <div>
              <label htmlFor="fullName" className="sr-only">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  autoComplete="name"
                  required
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Full Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>

            {/* Business Name Input */}
            <div>
              <label htmlFor="businessName" className="sr-only">Business Name</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  id="businessName"
                  name="businessName"
                  autoComplete="organization"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Business Name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="sr-only">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  autoComplete="email"
                  required
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Mobile Phone Number Input with Country Code */}
            <div>
              <label htmlFor="mobilePhoneNumber" className="sr-only">Mobile Phone Number</label>
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
                      {country.code} ({country.name})
                    </option>
                  ))}
                </select>
                <div className="relative flex-grow">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="mobilePhoneNumber"
                    name="mobilePhoneNumber"
                    type="tel"
                    autoComplete="tel"
                    required
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-r-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Mobile Phone Number"
                    value={mobilePhoneNumber}
                    onChange={(e) => setMobilePhoneNumber(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  autoComplete="new-password"
                  required
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Password"
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
              <label htmlFor="confirm-password" className="sr-only">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirm-password"
                  name="confirm-password"
                  autoComplete="new-password"
                  required
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Confirm Password"
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
                {loading ? 'Signing Up...' : 'Sign Up'}
              </Button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to={loginLink} className="font-medium text-blue-600 hover:text-blue-500">
                Log In
              </Link>
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default SignupPage;