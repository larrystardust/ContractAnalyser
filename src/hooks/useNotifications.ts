import { useEffect, useState, useCallback, useRef } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { Database } from '../types/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export type Notification = Database['public']['Tables']['notifications']['Row'];

export function useNotifications() {
  const supabase = useSupabaseClient<Database>();
  const session = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const notificationChannelRef = useRef<RealtimeChannel | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!session?.user?.id) {
      setNotifications([]);
      setLoading(false);
      console.log('DEBUG: fetchNotifications - No user ID, setting notifications to empty array.');
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

      console.log('DEBUG: fetchNotifications - Data received from Supabase:', JSON.stringify(data, null, 2));
      setNotifications(data || []);
      console.log('DEBUG: fetchNotifications - Notifications state after set (from fetch):', JSON.stringify(data || [], null, 2));

    } catch (err: any) {
      console.error('Error fetching notifications:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [supabase, session?.user?.id]);

  useEffect(() => {
    fetchNotifications();

    if (session?.user?.id) {
      const newNotificationChannel = supabase
        .channel('public:notifications')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` },
          (payload) => {
            console.log('DEBUG: Realtime INSERT event received. Payload.new:', JSON.stringify(payload.new, null, 2)); // ADDED LOG
            setNotifications((prev) => {
              console.log('DEBUG: Realtime INSERT - Previous notifications state:', JSON.stringify(prev, null, 2)); // ADDED LOG
              const updatedNotifications = [payload.new as Notification, ...prev];
              console.log('DEBUG: Realtime INSERT - New notifications state:', JSON.stringify(updatedNotifications, null, 2)); // ADDED LOG
              return updatedNotifications;
            });
          }
        )
        .subscribe();
      notificationChannelRef.current = newNotificationChannel;
    }

    return () => {
      const currentChannel = notificationChannelRef.current;
      if (currentChannel && (currentChannel.state === 'joined' || currentChannel.state === 'joining')) {
        supabase.removeChannel(currentChannel);
      }
      notificationChannelRef.current = null;
    };
  }, [fetchNotifications, session?.user?.id, supabase]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', session?.user?.id);

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
        .eq('user_id', session?.user?.id);

      if (deleteError) {
        throw deleteError;
      }

      setNotifications((prev) => prev.filter((notif) => notif.id !== notificationId));
    } catch (err: any) {
      console.error('Error deleting notification:', err);
      setError(err);
    }
  }, [supabase, session?.user?.id]);

  const unreadNotifications = notifications.filter(notif => {
    // Explicitly cast to boolean to ensure correct evaluation
    const isReadBoolean = Boolean(notif.is_read);
    console.log(`DEBUG: Filtering notification ID: ${notif.id}, is_read: ${notif.is_read}, isReadBoolean: ${isReadBoolean}, !isReadBoolean: ${!isReadBoolean}`);
    return !isReadBoolean;
  });
  const unreadCount = unreadNotifications.length;
  console.log('DEBUG: Filtered unread notifications array:', unreadNotifications);
  console.log('DEBUG: Calculated unreadCount:', unreadCount);


  return { notifications, loading, error, unreadCount, markAsRead, deleteNotification, fetchNotifications };
}