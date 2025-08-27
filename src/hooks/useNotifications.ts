import { useEffect, useState, useCallback, useRef } from 'react'; // Import useRef
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { Database } from '../types/supabase'; // Assuming you have a supabase types file
import { RealtimeChannel } from '@supabase/supabase-js'; // Import RealtimeChannel type

export type Notification = Database['public']['Tables']['notifications']['Row'];

export function useNotifications() {
  const supabase = useSupabaseClient<Database>();
  const session = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const notificationChannelRef = useRef<RealtimeChannel | null>(null); // Use useRef for the channel

  const fetchNotifications = useCallback(async () => {
    if (!session?.user?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setNotifications(data || []);
    } catch (err: any) {
      console.error('Error fetching notifications:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [supabase, session?.user?.id]);

  useEffect(() => {
    fetchNotifications();

    // Optional: Realtime subscription for new notifications
    if (session?.user?.id) { // Only subscribe if user ID is available
      const newNotificationChannel = supabase
        .channel('public:notifications')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` },
          (payload) => {
            // Add new notification to the top of the list
            setNotifications((prev) => [payload.new as Notification, ...prev]);
          }
        )
        .subscribe();
      notificationChannelRef.current = newNotificationChannel; // Assign to ref
    }


    return () => {
      // Defensive check: Only remove if the channel is defined and still active
      const currentChannel = notificationChannelRef.current;
      if (currentChannel && (currentChannel.state === 'joined' || currentChannel.state === 'joining')) {
        supabase.removeChannel(currentChannel);
      }
      notificationChannelRef.current = null; // Clear the ref
    };
  }, [fetchNotifications, session?.user?.id, supabase]); // Added supabase to dependencies

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', session?.user?.id); // Ensure user can only mark their own

      if (updateError) {
        throw updateError;
      }

      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        )
      );
    } catch (err: any) {
      console.error('Error marking notification as read:', err);
      setError(err);
    }
  }, [supabase, session?.user?.id]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', session?.user?.id); // Ensure user can only delete their own

      if (deleteError) {
        throw deleteError;
      }

      setNotifications((prev) => prev.filter((notif) => notif.id !== notificationId));
    } catch (err: any) {
      console.error('Error deleting notification:', err);
      setError(err);
    }
  }, [supabase, session?.user?.id]);

  const unreadCount = notifications.filter(notif => !notif.is_read).length;

  return { notifications, loading, error, unreadCount, markAsRead, deleteNotification, fetchNotifications };
}