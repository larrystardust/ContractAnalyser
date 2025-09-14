import React, { useState, useEffect } from 'react';
import Button from '../ui/Button';
import { Mail, MessageSquare, Tag, AlertCircle, CheckCircle, User } from 'lucide-react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { Database } from '../../types/supabase';
import { useTranslation } from 'react-i18next'; // ADDED

const SupportTicketForm: React.FC = () => {
  const supabase = useSupabaseClient<Database>();
  const session = useSession();
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    priority: 'medium',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [loadingUserName, setLoadingUserName] = useState(true);
  const { t } = useTranslation(); // ADDED

  useEffect(() => {
    const fetchUserName = async () => {
      if (!session?.user?.id) {
        setLoadingUserName(false);
        return;
      }
      try {
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileError) {
          console.error('Error fetching user profile:', profileError);
          setUserName(t('n_a')); // MODIFIED
        } else {
          setUserName(data?.full_name || '');
        }
      } catch (err) {
        console.error('Unexpected error fetching user profile:', err);
        setUserName(t('n_a')); // MODIFIED
      } finally {
        setLoadingUserName(false);
      }
    };

    fetchUserName();
  }, [session?.user?.id, supabase, t]); // MODIFIED: Added t to dependency array

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    if (!session?.user?.id) {
      setError(t('must_be_logged_in_to_submit_ticket')); // MODIFIED
      setLoading(false);
      return;
    }

    try {
      const { error: insertError } = await supabase
        .from('support_tickets')
        .insert({
          user_id: session.user.id,
          subject: formData.subject,
          description: formData.description,
          priority: formData.priority,
          status: 'open',
        });

      if (insertError) {
        throw insertError;
      }

      setSuccess(true);
      setFormData({
        subject: '',
        description: '',
        priority: 'medium',
      });
    } catch (err: any) {
      console.error('Error submitting support ticket:', err);
      setError(err.message || t('failed_to_submit_ticket')); // MODIFIED
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative flex items-center">
          <CheckCircle className="h-5 w-5 mr-2" />
          <span>{t('your_ticket_submitted')}</span> {/* MODIFIED */}
        </div>
      )}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span>{error}</span>
        </div>
      )}

      {/* ADDED: User Name Field */}
      <div>
        <label htmlFor="userName" className="sr-only">{t('your_name_field')}</label> {/* MODIFIED */}
        <div className="relative">
          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            id="userName"
            name="userName"
            placeholder={t('your_name_field')} {/* MODIFIED */}
            value={loadingUserName ? t('loading') : userName} {/* MODIFIED */}
            readOnly
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-100 cursor-not-allowed"
          />
        </div>
      </div>

      <div>
        <label htmlFor="subject" className="sr-only">{t('subject')}</label> {/* MODIFIED */}
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            id="subject"
            name="subject"
            placeholder={t('subject')} {/* MODIFIED */}
            value={formData.subject}
            onChange={handleChange}
            required
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor="description" className="sr-only">{t('describe_issue')}</label> {/* MODIFIED */}
        <textarea
          id="description"
          name="description"
          rows={5}
          placeholder={t('describe_issue')} {/* MODIFIED */}
          value={formData.description}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        ></textarea>
      </div>

      <div>
        <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">{t('priority')}</label> {/* MODIFIED */}
        <div className="relative">
          <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <select
            id="priority"
            name="priority"
            value={formData.priority}
            onChange={handleChange}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="low">{t('low')}</option> {/* MODIFIED */}
            <option value="medium">{t('medium')}</option> {/* MODIFIED */}
            <option value="high">{t('high')}</option> {/* MODIFIED */}
            <option value="urgent">{t('urgent')}</option> {/* MODIFIED */}
          </select>
        </div>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={loading}
      >
        {loading ? t('submitting_ticket') : t('submit_ticket_button')} {/* MODIFIED */}
      </Button>
    </form>
  );
};

export default SupportTicketForm;