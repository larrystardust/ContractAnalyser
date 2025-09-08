import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

// Initialize Supabase client with service role key for elevated privileges
// This client is used within Edge Functions, so it needs to be created here.
const supabaseServiceRole = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

export async function insertNotification(userId: string, title: string, message: string, type: string) {
  const { error: notificationError } = await supabaseServiceRole.from('notifications').insert({
    user_id: userId,
    title: title,
    message: message,
    type: type,
  });
  if (notificationError) {
    console.error('Error inserting notification:', notificationError);
  }
}