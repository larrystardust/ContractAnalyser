import React, { useState, useEffect } from 'react';
import Button from '../ui/Button';
import { Mail, User, MessageSquare, AlertCircle, CheckCircle, Loader2, Lock } from 'lucide-react'; // ADDED Lock and Loader2
import ReCAPTCHA from 'react-google-recaptcha';

const ContactForm: React.FC = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    subject: '',
    message: '',
  });
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OTP states
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);

  // Reset OTP status if email changes
  useEffect(() => {
    setOtpSent(false);
    setOtpCode('');
    setIsEmailVerified(false);
    setOtpError(null);
    setOtpMessage(null);
  }, [formData.email]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRecaptchaChange = (token: string | null) => {
    setRecaptchaToken(token);
  };

  const handleSendOtp = async () => {
    setOtpLoading(true);
    setOtpError(null);
    setOtpMessage(null);

    if (!formData.email) {
      setOtpError('Please enter your email address.');
      setOtpLoading(false);
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: formData.email }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send OTP.');
      }

      setOtpSent(true);
      setOtpMessage('OTP sent to your email. Please check your inbox.');
    } catch (err: any) {
      setOtpError(err.message || 'An error occurred while sending OTP.');
      console.error('Send OTP error:', err);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setOtpLoading(true);
    setOtpError(null);
    setOtpMessage(null);

    if (!otpCode) {
      setOtpError('Please enter the OTP.');
      setOtpLoading(false);
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-email-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: formData.email, otp_code: otpCode }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to verify OTP.');
      }

      setIsEmailVerified(true);
      setOtpMessage('Email verified successfully!');
    } catch (err: any) {
      setOtpError(err.message || 'An error occurred while verifying OTP.');
      console.error('Verify OTP error:', err);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    if (!recaptchaToken) {
      setError('Please complete the reCAPTCHA verification.');
      setLoading(false);
      return;
    }

    if (!isEmailVerified) {
      setError('Please verify your email address first.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-inquiry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email,
          subject: formData.subject,
          message: formData.message,
          recaptcha_token: recaptchaToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit inquiry.');
      }

      setSuccess(true);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        subject: '',
        message: '',
      });
      setRecaptchaToken(null);
      setOtpSent(false);
      setOtpCode('');
      setIsEmailVerified(false);
      setOtpError(null);
      setOtpMessage(null);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      console.error('Inquiry submission error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative flex items-center">
          <CheckCircle className="h-5 w-5 mr-2" />
          <span>Your message has been sent successfully! We will get back to you soon.</span>
        </div>
      )}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className="sr-only">First Name</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              id="firstName"
              name="firstName"
              placeholder="First Name"
              value={formData.firstName}
              onChange={handleChange}
              required
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
        </div>
        <div>
          <label htmlFor="lastName" className="sr-only">Last Name</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              id="lastName"
              name="lastName"
              placeholder="Last Name"
              value={formData.lastName}
              onChange={handleChange}
              required
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="email" className="sr-only">Email</label>
        <div className="relative flex items-center">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="email"
            id="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            disabled={otpSent || isEmailVerified} // Disable email input after OTP sent or verified
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleSendOtp}
            disabled={otpLoading || otpSent || !formData.email || isEmailVerified}
            className="ml-2 rounded-r-md"
          >
            {otpLoading && !otpSent ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify Email'}
          </Button>
        </div>
        {otpError && (
          <p className="text-sm text-red-600 mt-1">{otpError}</p>
        )}
        {otpMessage && (
          <p className="text-sm text-green-600 mt-1">{otpMessage}</p>
        )}
      </div>

      {otpSent && !isEmailVerified && (
        <div>
          <label htmlFor="otpCode" className="sr-only">OTP Code</label>
          <div className="relative flex items-center">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              id="otpCode"
              name="otpCode"
              placeholder="Enter OTP"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              required
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              disabled={otpLoading}
            />
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleVerifyOtp}
              disabled={otpLoading || !otpCode}
              className="ml-2 rounded-r-md"
            >
              {otpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify OTP'}
            </Button>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="subject" className="sr-only">Subject</label>
        <div className="relative">
          <MessageSquare className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            id="subject"
            name="subject"
            placeholder="Subject"
            value={formData.subject}
            onChange={handleChange}
            required
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor="message" className="sr-only">Message</label>
        <textarea
          id="message"
          name="message"
          rows={5}
          placeholder="Your Message"
          value={formData.message}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        ></textarea>
      </div>

      {/* reCAPTCHA v2 Checkbox */}
      <div className="flex justify-center">
        <ReCAPTCHA
          sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY || "YOUR_RECAPTCHA_SITE_KEY"}
          onChange={handleRecaptchaChange}
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={loading || !recaptchaToken || !isEmailVerified} // Disable if not verified
      >
        {loading ? 'Sending Message...' : 'Send Message'}
      </Button>
    </form>
  );
};

export default ContactForm;