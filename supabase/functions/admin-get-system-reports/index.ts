import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

function corsResponse(body: string | object | null, status = 200) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
    'Content-Type': 'application/json',
  };
  if (status === 204) {
    return new Response(null, { status, headers });
  }
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsResponse(null, 204);
  }

  if (req.method !== 'POST') {
    return corsResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsResponse({ error: 'Authorization header missing' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return corsResponse({ error: 'Unauthorized: Invalid or missing user token' }, 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      return corsResponse({ error: 'Forbidden: User is not an administrator' }, 403);
    }

    // Calculate date ranges for "last 7 days" and "last 30 days"
    const now = new Date();
    const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7)).toISOString();
    const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30)).toISOString(); // Recalculate now for 30 days

    // --- User Statistics ---
    const { count: totalUsers } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
    const { count: newUsersLast7Days } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo);
    const { count: activeUsersLast30Days } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('login_at', thirtyDaysAgo);

    // --- Contract Usage ---
    const { count: totalContracts } = await supabase.from('contracts').select('id', { count: 'exact', head: true });
    const { count: completedContracts } = await supabase.from('contracts').select('id', { count: 'exact', head: true }).eq('status', 'completed');
    const { count: failedContracts } = await supabase.from('contracts').select('id', { count: 'exact', head: true }).eq('status', 'failed');
    const { count: contractsUploadedLast7Days } = await supabase.from('contracts').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo);

    // --- Support & Inquiries ---
    const { count: totalInquiries } = await supabase.from('inquiries').select('id', { count: 'exact', head: true });
    const { count: newInquiriesLast7Days } = await supabase.from('inquiries').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo);
    const { count: totalSupportTickets } = await supabase.from('support_tickets').select('id', { count: 'exact', head: true });
    const { count: newSupportTicketsLast7Days } = await supabase.from('support_tickets').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo);
    const { count: openSupportTickets } = await supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open');

    // --- Subscription Overview ---
    const { count: activeSubscriptions } = await supabase.from('stripe_subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active');
    const { count: singleUsePurchases } = await supabase.from('stripe_orders').select('id', { count: 'exact', head: true }).eq('status', 'completed').eq('payment_status', 'paid');

    return corsResponse({
      user_stats: {
        total_users: totalUsers,
        new_users_last_7_days: newUsersLast7Days,
        active_users_last_30_days: activeUsersLast30Days,
      },
      contract_stats: {
        total_contracts: totalContracts,
        completed_contracts: completedContracts,
        failed_contracts: failedContracts,
        contracts_uploaded_last_7_days: contractsUploadedLast7Days,
      },
      support_stats: {
        total_inquiries: totalInquiries,
        new_inquiries_last_7_days: newInquiriesLast7Days,
        total_support_tickets: totalSupportTickets,
        new_support_tickets_last_7_days: newSupportTicketsLast7Days,
        open_support_tickets: openSupportTickets,
      },
      subscription_stats: {
        active_subscriptions: activeSubscriptions,
        single_use_purchases: singleUsePurchases,
      },
    });

  } catch (error: any) {
    console.error('Error in admin-get-system-reports Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});