import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { Database } from '../types/supabase';
import Card, { CardBody, CardHeader } from '../components/ui/Card';
import { ArrowLeft, MessageSquare, Loader2, Calendar, Mail, User, Send, CheckCircle, AlertCircle } from 'lucide-react';
import Button from '../components/ui/Button';

interface Inquiry {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  subject: string;
  message: string;
  created_at: string;
}

interface InquiryReply {
  id: string;
  inquiry_id: string;
  admin_user_id: string; // Now explicitly a string
  reply_message: string;
  created_at: string;
  profiles?: { full_name: string | null } | null; // Optional profiles object for rendering
}

const AdminInquiriesPage: React.FC = () => {
  const supabase = useSupabaseClient<Database>();
  const session = useSession();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedInquiryId, setExpandedInquiryId] = useState<string | null>(null);

  // State for reply functionality
  const [replyMessage, setReplyMessage] = useState<Record<string, string>>({});
  const [replyLoading, setReplyLoading] = useState<Record<string, boolean>>({});
  const [replyError, setReplyError] = useState<Record<string, string | null>>({});
  const [replySuccess, setReplySuccess] = useState<Record<string, string | null>>({});
  const [adminFullName, setAdminFullName] = useState<string | null>(null);

  // State for fetched replies
  const [inquiryReplies, setInquiryReplies] = useState<InquiryReply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);

  useEffect(() => {
    const fetchInquiries = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('inquiries')
          .select('*')
          .order('created_at', { ascending: false });

        if (fetchError) {
          throw fetchError;
        }
        setInquiries(data || []);
      } catch (err: any) {
        console.error('Error fetching inquiries:', err);
        setError(err.message || 'Failed to load inquiries.');
      } finally {
        setLoading(false);
      }
    };

    const fetchAdminProfile = async () => {
      if (session?.user?.id) {
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', session.user.id)
          .maybeSingle();
        if (profileError) {
          console.error('Error fetching admin profile:', profileError);
        } else {
          setAdminFullName(data?.full_name || null);
        }
      }
    };

    fetchInquiries();
    fetchAdminProfile();
  }, [supabase, session]);

  const fetchRepliesForInquiry = async (inquiryId: string) => {
    setLoadingReplies(true);
    try {
      // First, fetch the replies without any joins
      const { data: repliesData, error: fetchError } = await supabase
        .from('inquiry_replies')
        .select('*')
        .eq('inquiry_id', inquiryId)
        .order('created_at', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      if (!repliesData || repliesData.length === 0) {
        setInquiryReplies([]);
        setLoadingReplies(false);
        return;
      }

      // Extract unique admin_user_ids
      const adminUserIds = [...new Set(repliesData.map(reply => reply.admin_user_id))];

      // Fetch profiles for these admin_user_ids
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', adminUserIds);

      if (profilesError) {
        throw profilesError;
      }

      const adminProfilesMap = new Map(profilesData.map(profile => [profile.id, profile.full_name]));

      // Map the replies to include the admin's full name
      const mappedReplies: InquiryReply[] = repliesData.map(reply => ({
        ...reply,
        profiles: {
          full_name: adminProfilesMap.get(reply.admin_user_id) || null,
        },
      }));

      setInquiryReplies(mappedReplies);
    } catch (err: any) {
      console.error('Error fetching inquiry replies:', err);
      setError(err.message || 'Failed to load replies.');
    } finally {
      setLoadingReplies(false);
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedInquiryId === id) {
      setExpandedInquiryId(null);
      setInquiryReplies([]); // Clear replies when collapsing
    } else {
      setExpandedInquiryId(id);
      fetchRepliesForInquiry(id); // Fetch replies when expanding
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const handleReply = async (inquiry: Inquiry) => {
    setReplyLoading(prev => ({ ...prev, [inquiry.id]: true }));
    setReplyError(prev => ({ ...prev, [inquiry.id]: null }));
    setReplySuccess(prev => ({ ...prev, [inquiry.id]: null }));

    if (!replyMessage[inquiry.id] || replyMessage[inquiry.id].trim() === '') {
      setReplyError(prev => ({ ...prev, [inquiry.id]: 'Reply message cannot be empty.' }));
      setReplyLoading(prev => ({ ...prev, [inquiry.id]: false }));
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('send-admin-reply-email', {
        body: {
          recipientEmail: inquiry.email,
          subject: `Re: ${inquiry.subject}`,
          message: replyMessage[inquiry.id],
          recipientName: `${inquiry.first_name} ${inquiry.last_name}`,
          adminName: adminFullName,
          replyType: 'inquiry', // Specify reply type
          entityId: inquiry.id, // Pass inquiry ID
        },
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      setReplySuccess(prev => ({ ...prev, [inquiry.id]: data.message || 'Reply sent successfully!' }));
      setReplyMessage(prev => ({ ...prev, [inquiry.id]: '' })); // Clear reply message
      fetchRepliesForInquiry(inquiry.id); // Refresh replies after sending
    } catch (err: any) {
      console.error('Error sending reply:', err);
      setReplyError(prev => ({ ...prev, [inquiry.id]: err.message || 'Failed to send reply.' }));
    } finally {
      setReplyLoading(prev => ({ ...prev, [inquiry.id]: false }));
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 mt-16 text-center">
        <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
        <p className="text-gray-500">Loading inquiries...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6 mt-16 text-center">
        <p className="text-red-600">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <div className="mb-6">
        <Link to="/admin" className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Admin Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-6">Manage Inquiries</h1>
      <p className="text-gray-700 mb-8">View messages submitted through the contact form.</p>

      {inquiries.length === 0 ? (
        <Card>
          <CardBody className="text-center py-8">
            <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No inquiries found.</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {inquiries.map((inquiry) => (
            <Card key={inquiry.id} className="border-l-4 border-indigo-500">
              <CardBody>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{inquiry.subject}</h3>
                    <div className="text-sm text-gray-600 flex items-center space-x-4 mb-2">
                      <span className="flex items-center">
                        <User className="h-4 w-4 mr-1" /> {inquiry.first_name} {inquiry.last_name}
                      </span>
                      <span className="flex items-center">
                        <Mail className="h-4 w-4 mr-1" /> {inquiry.email}
                      </span>
                      <span className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" /> {formatDate(inquiry.created_at)}
                      </span>
                    </div>
                    <p className="text-gray-700">
                      {expandedInquiryId === inquiry.id ? inquiry.message : `${inquiry.message.substring(0, 150)}...`}
                    </p>
                    <div className="flex items-center space-x-2 mt-3">
                      {inquiry.message.length > 150 && (
                        <button
                          onClick={() => toggleExpand(inquiry.id)}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          {expandedInquiryId === inquiry.id ? 'Show Less' : 'Read More'}
                        </button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => toggleExpand(inquiry.id)}
                        icon={<Send className="h-4 w-4" />}
                      >
                        Reply
                      </Button>
                    </div>

                    {expandedInquiryId === inquiry.id && (
                      <div className="mt-6 pt-4 border-t border-gray-200">
                        <h4 className="text-md font-semibold text-gray-800 mb-2">Reply History</h4>
                        {loadingReplies ? (
                          <div className="text-center py-2">
                            <Loader2 className="h-5 w-5 text-blue-500 animate-spin mx-auto" />
                            <p className="text-gray-500 text-sm">Loading replies...</p>
                          </div>
                        ) : inquiryReplies.length === 0 ? (
                          <p className="text-gray-500 text-sm mb-4">No replies yet.</p>
                        ) : (
                          <div className="space-y-3 mb-4">
                            {inquiryReplies.map(reply => (
                              <div key={reply.id} className="bg-gray-50 p-3 rounded-md border border-gray-200">
                                <div className="flex justify-between items-center text-xs text-gray-600 mb-1">
                                  <span>Replied by: {reply.profiles?.full_name || 'Admin'}</span>
                                  <span>{formatDate(reply.created_at)}</span>
                                </div>
                                <p className="text-sm text-gray-800">{reply.reply_message}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        <h4 className="text-md font-semibold text-gray-800 mb-2">Send New Reply</h4>
                        {replySuccess[inquiry.id] && (
                          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-3 flex items-center">
                            <CheckCircle className="h-5 w-5 mr-2" />
                            <span>{replySuccess[inquiry.id]}</span>
                          </div>
                        )}
                        {replyError[inquiry.id] && (
                          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-3 flex items-center">
                            <AlertCircle className="h-5 w-5 mr-2" />
                            <span>{replyError[inquiry.id]}</span>
                          </div>
                        )}
                        <textarea
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder={`Reply to ${inquiry.first_name} ${inquiry.last_name}...`}
                          value={replyMessage[inquiry.id] || ''}
                          onChange={(e) => setReplyMessage(prev => ({ ...prev, [inquiry.id]: e.target.value }))}
                          disabled={replyLoading[inquiry.id]}
                        ></textarea>
                        <div className="mt-3 flex justify-end">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleReply(inquiry)}
                            disabled={replyLoading[inquiry.id]}
                            icon={<Send className="h-4 w-4" />}
                          >
                            {replyLoading[inquiry.id] ? 'Sending...' : 'Send Reply'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminInquiriesPage;