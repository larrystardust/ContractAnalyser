import { supabase } from '../lib/supabase'; // Assuming you have your Supabase client initialized here
import { Database } from '../types/supabase'; // Import your Supabase database types
import { StripeProduct } from '../stripe-config'; // ADDED: Import StripeProduct type
import { stripeProducts } from '../stripe-config'; // ADDED: Import stripeProducts array
import { SubscriptionMembership } from '../hooks/useSubscription'; // ADDED: Import SubscriptionMembership
import { Contract, AnalysisResult, Finding } from '../types'; // ADDED: Import Contract, AnalysisResult, Finding

// ADDED: Define types for subscription and order details
type StripeSubscriptionRow = Database['public']['Tables']['stripe_subscriptions']['Row'];
type StripeOrderRow = Database['public']['Tables']['stripe_orders']['Row'];

// Define types for admin user data
export type AdminProfile = Database['public']['Tables']['profiles']['Row'] & {
  email: string;
  auth_created_at: string;
  customer_id: string | null;
  subscription_details: (StripeSubscriptionRow & { product_info?: StripeProduct }) | null;
  membership_details: SubscriptionMembership | null;
  single_use_credits: number;
};

// ADDED: Type for all available subscriptions fetched from backend
export type AvailableSubscription = Pick<StripeSubscriptionRow, 'subscription_id' | 'price_id' | 'status' | 'max_users'> & {
  product_name?: string; // Human-readable name for the product
};

// MODIFIED: Add business_name to AdminProfileUpdate
export type AdminProfileUpdate = Partial<Omit<AdminProfile, 'id' | 'email' | 'auth_created_at' | 'customer_id' | 'subscription_details' | 'membership_details' | 'single_use_credits'>>;

// ADDED: Type for AdminContract
export type AdminContract = Contract & {
  user_full_name: string;
  user_email: string;
  marked_for_deletion_by_admin: boolean | null;
  analysisResult: (AnalysisResult & { findings: Finding[] }) | null;
};

const adminService = {
  async getUsers(): Promise<{ users: AdminProfile[]; all_subscriptions: AvailableSubscription[] }> {
    const session = await supabase.auth.getSession();
    if (!session.data.session) {
      throw new Error('User not authenticated.');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.data.session.access_token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch users.');
    }

    const data = await response.json();

    // Map product names to subscriptions for easier display on frontend
    const allSubscriptions: AvailableSubscription[] = data.all_subscriptions.map((sub: StripeSubscriptionRow) => {
      const product = stripeProducts.find(p =>
        p.pricing.monthly?.priceId === sub.price_id ||
        p.pricing.yearly?.priceId === sub.price_id ||
        p.pricing.one_time?.priceId === sub.price_id
      );
      return {
        ...sub,
        product_name: product ? product.name : 'Unknown Product',
      };
    });

    return { users: data.users, all_subscriptions: allSubscriptions };
  },

  async createUser(userData: {
    email: string;
    password?: string;
    full_name?: string;
    business_name?: string; // ADDED
    mobile_phone_number?: string;
    country_code?: string;
    is_admin?: boolean;
    email_confirm?: boolean;
    subscription_id?: string | null;
    role?: 'owner' | 'member';
  }): Promise<{ userId: string }> {
    const session = await supabase.auth.getSession();
    if (!session.data.session) {
      throw new Error('User not authenticated.');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.data.session.access_token}`,
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create user.');
    }

    const data = await response.json();
    return data;
  },

  async updateUser(userId: string, updates: AdminProfileUpdate): Promise<AdminProfile> {
    const session = await supabase.auth.getSession();
    if (!session.data.session) {
      throw new Error('User not authenticated.');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-update-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.data.session.access_token}`,
      },
      body: JSON.stringify({ userId, updates }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update user.');
    }

    const data = await response.json();
    return data.user;
  },

  async deleteUser(userId: string): Promise<void> {
    const session = await supabase.auth.getSession();
    if (!session.data.session) {
      throw new Error('User not authenticated.');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.data.session.access_token}`,
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete user.');
    }
  },

  async grantSingleUseCredit(userId: string): Promise<void> {
    const session = await supabase.auth.getSession();
    if (!session.data.session) {
      throw new Error('User not authenticated.');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-grant-single-use-credit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.data.session.access_token}`,
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to grant single-use credit.');
    }
  },

  // MODIFIED: This function will now call the new admin-manage-subscription Edge Function
  async manageUserSubscription(userId: string, subscriptionId: string | null, role: 'owner' | 'member' | null): Promise<void> {
    const session = await supabase.auth.getSession();
    if (!session.data.session) {
      throw new Error('User not authenticated.');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manage-subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.data.session.access_token}`,
      },
      body: JSON.stringify({ userId, subscriptionId, role }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to manage user subscription.');
    }
  },

  async createCustomerPortalForUser(userId: string): Promise<string> {
    const session = await supabase.auth.getSession();
    if (!session.data.session) {
      throw new Error('User not authenticated.');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-customer-portal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.data.session.access_token}`,
      },
      body: JSON.stringify({ target_user_id: userId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create customer portal session.');
    }

    const data = await response.json();
    return data.url;
  },

  // ADDED: New function to fetch all contracts for admin
  async getAllContractsForAdmin(): Promise<AdminContract[]> {
    const session = await supabase.auth.getSession();
    if (!session.data.session) {
      throw new Error('User not authenticated.');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-all-contracts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.data.session.access_token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch all contracts.');
    }

    const data = await response.json();
    return data.contracts;
  },

  // ADDED: New function to delete a contract as admin
  async deleteContractAsAdmin(contractId: string): Promise<void> {
    const session = await supabase.auth.getSession();
    if (!session.data.session) {
      throw new Error('User not authenticated.');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-contract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.data.session.access_token}`,
      },
      body: JSON.stringify({ contractId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete contract as admin.');
    }
  },

  // ADDED: New function to mark a contract for deletion by admin
  async markContractForDeletionAsAdmin(contractId: string, markedForDeletion: boolean): Promise<void> {
    const session = await supabase.auth.getSession();
    if (!session.data.session) {
      throw new Error('User not authenticated.');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-mark-contract-for-deletion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.data.session.access_token}`,
      },
      body: JSON.stringify({ contractId, markedForDeletion }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to mark contract for deletion as admin.');
    }
  },
};

export default adminService;