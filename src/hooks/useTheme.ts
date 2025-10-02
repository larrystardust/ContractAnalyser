// src/hooks/useTheme.ts
import { useEffect, useRef } from 'react'; // Import useRef
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { Database } from '../types/supabase';
import { RealtimeChannel } from '@supabase/supabase-js'; // Import RealtimeChannel type

export function useTheme() {
  const supabase = useSupabaseClient<Database>();
  const session = useSession();
  const channelRef = useRef<RealtimeChannel | null>(null); // Use useRef for the channel

  // Helper function to apply theme classes to the HTML element and save to localStorage
  const applyThemeToHtmlAndSave = (themePreference: 'light' | 'dark' | 'system') => {
    document.documentElement.classList.remove('light', 'dark'); // Remove existing theme classes
    if (themePreference === 'system') {
      // Apply dark class if system prefers dark mode
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      }
    } else {
      // Apply specific light or dark class
      document.documentElement.classList.add(themePreference);
    }
    localStorage.setItem('theme-preference', themePreference); // Save to localStorage
  };

  // Function to fetch theme from DB and apply it
  const fetchAndApplyTheme = async () => {
    // 1. Try to get theme from localStorage first for immediate application
    const localTheme = localStorage.getItem('theme-preference') as 'light' | 'dark' | 'system' | null;
    if (localTheme) {
      applyThemeToHtmlAndSave(localTheme);
    } else {
      // If no local storage, apply system default initially
      applyThemeToHtmlAndSave('system');
    }

    if (!session?.user?.id) {
      // If no user session, ensure system theme is applied and return
      applyThemeToHtmlAndSave('system');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('theme_preference')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST116') {
          // No profile found, which is expected for new users. Handle silently.
          applyThemeToHtmlAndSave('system');
        } else {
          console.error('Error fetching theme preference:', error);
          applyThemeToHtmlAndSave('system'); // Fallback to system theme on other errors
        }
        return;
      }

      // Get theme preference from fetched data, default to 'system'
      const themePreference = (data?.theme_preference as 'light' | 'dark' | 'system') || 'system';
      // Apply and save the fetched theme (this might cause a slight flicker if different from localTheme)
      applyThemeToHtmlAndSave(themePreference);
    } catch (err) {
      console.error('Unexpected error applying theme:', err);
      applyThemeToHtmlAndSave('system'); // Fallback to system theme on unexpected error
    }
  };

  useEffect(() => {
    // 1. Initial fetch and apply of the theme when the component mounts or session changes
    fetchAndApplyTheme();

    // 2. Set up real-time listener for profile changes for the current user
    if (session?.user?.id) {
      const newChannel = supabase
        .channel(`profile_theme_changes:${session.user.id}`) // Unique channel for each user
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${session.user.id}`, // Listen only for changes to the current user's profile
          },
          (payload) => {
            // console.log('Realtime update detected for theme_preference:', payload.new.theme_preference); // REMOVED
            // Immediately apply the new theme from the real-time payload and save to localStorage
            applyThemeToHtmlAndSave(payload.new.theme_preference as 'light' | 'dark' | 'system');
          }
        )
        .subscribe();
      channelRef.current = newChannel; // Assign the new channel to the ref
    }

    // 3. Cleanup function: Unsubscribe from the real-time channel when the component unmounts
    return () => {
      // Defensive check: Only remove if the channel is defined and still active
      const currentChannel = channelRef.current;
      if (currentChannel && (currentChannel.state === 'joined' || currentChannel.state === 'joining')) {
        supabase.removeChannel(currentChannel);
      }
      channelRef.current = null; // Clear the ref
    };
  }, [session?.user?.id, supabase]); // Re-run effect if user session or supabase client changes
}