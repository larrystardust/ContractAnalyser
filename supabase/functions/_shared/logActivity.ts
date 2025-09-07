import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

export async function logActivity(
  supabaseServiceRole: ReturnType<typeof createClient>,
  userId: string | null,
  eventType: string,
  description: string,
  metadata: object = {}
) {
  try {
    const { error } = await supabaseServiceRole
      .from('audit_logs')
      .insert({
        user_id: userId,
        event_type: eventType,
        description: description,
        metadata: metadata,
      });

    if (error) {
      console.error('Failed to log activity:', error);
    }
  } catch (e) {
    console.error('Error in logActivity helper:', e);
  }
}