import React, { useState, useEffect } from 'react';
import { UserPlus, Users, Mail, CheckCircle, XCircle, AlertCircle, Trash2 } from 'lucide-react';
import Button from '../ui/Button';
import Card, { CardBody, CardHeader } from '../ui/Card';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { useSubscription, SubscriptionMembership } from '../../hooks/useSubscription';
import { Database } from '../../types/supabase';

// Extended type for local use with email and full_name
interface ExtendedSubscriptionMembership extends SubscriptionMembership {
  email?: string;
  full_name?: string;
}

const MembersSettings: React.FC = () => {
  const supabase = useSupabaseClient<Database>();
  const session = useSession();
  const { subscription, membership, loading: loadingSubscription, error: subscriptionError } = useSubscription();

  const [invitedEmail, setInvitedEmail] = useState('');
  const [members, setMembers] = useState<ExtendedSubscriptionMembership[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  const isOwner = membership?.role === 'owner' && membership?.status === 'active';
  const currentMembersCount = members.filter(m => m.status === 'active' || m.status === 'invited').length;
  const maxUsers = subscription?.max_users || 0;
  const canInvite = isOwner && (maxUsers === 999999 || currentMembersCount < maxUsers);

  const fetchMembers = async () => {
    if (!subscription?.subscription_id) {
      setMembers([]);
      setLoadingMembers(false);
      return;
    }

    setLoadingMembers(true);
    try {
      // Directly query the subscription_memberships table.
      // RLS policies should allow owners to select all members of their subscription.
      const { data: membershipsData, error: membershipsError } = await supabase
        .from('subscription_memberships')
        .select(`
          *,
          users!subscription_memberships_user_id_fkey (email, profiles (full_name)) // Explicitly use the user_id foreign key
        `) // Correctly specifies traversal: subscription_memberships -> users -> profiles
        .eq('subscription_id', subscription.subscription_id)
        .order('created_at', { ascending: true });

      if (membershipsError) {
        console.error('Error fetching members directly:', membershipsError);
        setInviteError(membershipsError.message || 'Failed to fetch members.');
        setMembers([]);
        return;
      }

      // Map the data to the ExtendedSubscriptionMembership type
      const fetchedMembers: ExtendedSubscriptionMembership[] = membershipsData.map(m => ({
        ...m,
        // Prioritize auth.users email if user_id exists, otherwise use invited_email_address
        email: (m.users as { email: string } | null)?.email || m.invited_email_address || null,
        full_name: (m.profiles as { full_name: string } | null)?.full_name || null,
      }));
      
      setMembers(fetchedMembers);
    } catch (err: any) {
      console.error('Unexpected error fetching members:', err);
      setInviteError(err.message || 'Failed to fetch members.');
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    // Only fetch members if there's an active subscription
    if (subscription?.subscription_id) {
      fetchMembers();
    } else {
      setMembers([]);
      setLoadingMembers(false);
    }
  }, [subscription?.subscription_id, session?.user?.id]); // Re-fetch if subscription or user changes

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteError(null);
    setInviteSuccess(null);

    if (!invitedEmail) {
      setInviteError('Please enter an email address.');
      setInviteLoading(false);
      return;
    }

    if (!isOwner) {
      setInviteError('You must be the subscription owner to invite users.');
      setInviteLoading(false);
      return;
    }

    if (!canInvite) {
      setInviteError(`You have reached the maximum number of users (${maxUsers}) for your plan.`);
      setInviteLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: {
          invited_email: invitedEmail,
          role: 'member',
        },
        headers: {
          'Authorization': `Bearer ${session?.access_token}`, // Pass current user's token
        },
      });

      if (error) {
        // More robust error parsing for FunctionsHttpError
        let displayErrorMessage = 'Failed to send invitation. Please try again.';
        if (error.name === 'FunctionsHttpError' && (error as any).context) {
          const errorContext = (error as any).context;
          if (errorContext.body instanceof ReadableStream) {
            // If the body is a ReadableStream, consume it as text
            const reader = errorContext.body.getReader();
            const decoder = new TextDecoder();
            let result = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              result += decoder.decode(value);
            }
            try {
              const parsedBody = JSON.parse(result);
              if (parsedBody.error) displayErrorMessage = parsedBody.error;
              else if (parsedBody.message) displayErrorMessage = parsedBody.message;
            } catch (parseError) {
              console.warn('Could not parse Edge Function error stream as JSON:', parseError);
            }
          } else if (typeof errorContext.body === 'string') {
            // If the body is already a string, try to parse it
            try {
              const parsedBody = JSON.parse(errorContext.body);
              if (parsedBody.error) displayErrorMessage = parsedBody.error;
              else if (parsedBody.message) displayErrorMessage = parsedBody.message;
            } catch (parseError) {
              console.warn('Could not parse Edge Function error string as JSON:', parseError);
            }
          } else {
            console.warn('Unexpected type for Edge Function error body:', errorContext.body);
          }
        } else if (error.message) {
          displayErrorMessage = error.message;
        }
        setInviteError(displayErrorMessage);
        throw error; // Re-throw to stop execution
      }

      setInviteSuccess(data.message || 'Invitation sent successfully!');
      setInvitedEmail('');
      fetchMembers(); // Re-fetch members to update the list
    } catch (err: any) {
      console.error('Full error object received:', err); // This will now log the full error object
      // The error state is already set by the try-catch block above, no need to set it again here
    } finally {
      setInviteLoading(false);
    }
  };

  const handleDeleteMember = async (memberId: string, userId: string | null) => {
    if (!isOwner) {
      alert('You must be the subscription owner to remove users.');
      return;
    }
    if (!window.confirm('Are you sure you want to remove this member from your subscription?')) {
      return;
    }

    setDeleteLoading(memberId);
    setInviteError(null); // Clear previous errors
    setInviteSuccess(null); // Clear previous success messages
    try {
      const { error } = await supabase
        .from('subscription_memberships')
        .delete()
        .eq('id', memberId);

      if (error) {
        throw error;
      }

      setInviteSuccess('Member removed successfully.');
      fetchMembers(); // Re-fetch members to update the list
    } catch (err: any) {
      console.error('Error deleting member:', err);
      setInviteError(err.message || 'Failed to remove member.');
    } finally {
      setDeleteLoading(null);
    }
  };

  if (loadingSubscription) {
    return (
      <Card>
        <CardBody className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900 mx-auto"></div>
          <p className="text-gray-500 mt-2">Loading subscription details...</p>
        </CardBody>
      </Card>
    );
  }

  if (subscriptionError) {
    return (
      <Card>
        <CardBody className="text-center py-8">
          <p className="text-red-600">Error: {subscriptionError.message}</p>
          <p className="text-gray-500 mt-2">Please try again later or contact support.</p>
        </CardBody>
      </Card>
    );
  }

  if (!subscription || !subscription.subscription_id) {
    return (
      <Card>
        <CardBody className="text-center py-8">
          <p className="text-gray-600 mb-4">You do not have an active subscription that supports multiple users.</p>
          <Link to="/pricing"> {/* Changed to Link component */}
            <Button variant="primary" type="button"> {/* type="button" is good practice for buttons inside Link */}
              View Plans
            </Button>
          </Link>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Invite New Member */}
      <Card>
        <CardHeader>
          <div className="flex items-center">
            <UserPlus className="h-5 w-5 text-blue-900 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Invite New Member</h3>
          </div>
        </CardHeader>
        <CardBody>
          {!isOwner && (
            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4" role="alert">
              <p className="font-bold">Permission Denied</p>
              <p>Only the subscription owner can invite new members.</p>
            </div>
          )}
          {inviteSuccess && (
            <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4" role="alert">
              <p className="font-bold">Success!</p>
              <p>{inviteSuccess}</p>
            </div>
          )}
          {inviteError && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
              <p className="font-bold">Error!</p>
              <p>{inviteError}</p>
            </div>
          )}
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label htmlFor="invitedEmail" className="sr-only">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  id="invitedEmail"
                  name="invitedEmail"
                  placeholder="Member's Email Address"
                  value={invitedEmail}
                  onChange={(e) => setInvitedEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  disabled={inviteLoading || !canInvite || !isOwner}
                />
              </div>
            </div>
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full"
              disabled={inviteLoading || !canInvite || !isOwner}
            >
              {inviteLoading ? 'Sending Invitation...' : 'Send Invitation'}
            </Button>
            {!canInvite && isOwner && maxUsers !== 999999 && (
              <p className="text-sm text-red-600 mt-2">
                You have reached the maximum number of users ({maxUsers}) for your plan.
              </p>
            )}
          </form>
        </CardBody>
      </Card>

      {/* Current Members */}
      <Card>
        <CardHeader>
          <div className="flex items-center">
            <Users className="h-5 w-5 text-blue-900 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Current Members</h3>
            <span className="ml-3 px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
              {currentMembersCount} / {maxUsers === 999999 ? 'Unlimited' : maxUsers}
            </span>
          </div>
        </CardHeader>
        <CardBody>
          {loadingMembers ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading members...</p>
            </div>
          ) : members.length === 0 ? (
            <p className="text-gray-600">No members found for this subscription yet.</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {members.map((member) => (
                <li key={member.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {member.full_name || member.email || 'N/A'}
                      {member.user_id === session?.user?.id && <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">You</span>}
                    </p>
                    {member.full_name && member.email && (
                      <p className="text-xs text-gray-500">{member.email}</p>
                    )}
                    <p className="text-xs text-gray-500">Role: {member.role.charAt(0).toUpperCase() + member.role.slice(1)}</p>
                    <p className="text-xs text-gray-500">Status: {member.status.charAt(0).toUpperCase() + member.status.slice(1)}</p>
                  </div>
                  {isOwner && member.user_id !== session?.user?.id && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteMember(member.id, member.user_id)}
                      disabled={deleteLoading === member.id}
                      icon={<Trash2 className="h-4 w-4" />}
                    >
                      {deleteLoading === member.id ? 'Removing...' : 'Remove'}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default MembersSettings;