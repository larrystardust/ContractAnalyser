export interface StripeProduct {
  id: string;
  name: string;
  description: string;
  mode: 'subscription' | 'payment' | 'admin_assigned'; // Added 'admin_assigned'
  fileRetentionPolicy?: string;
  maxFiles?: number; // Maximum number of files allowed for this plan
  tier: number; // Numerical tier for comparison (e.g., 1 for single, 2 for professional, 3 for enterprise)
  pricing: {
    monthly?: { priceId: string; price: number; interval: 'month' };
    yearly?: { priceId: string; price: number; interval: 'year' };
    one_time?: { priceId: string; price: number; interval: 'one_time' };
  };
}