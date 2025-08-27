export interface StripeProduct {
  id: string;
  name: string;
  description: string;
  mode: 'subscription' | 'payment';
  fileRetentionPolicy?: string;
  maxFiles?: number; // Maximum number of files allowed for this plan
  tier: number; // ADDED: Numerical tier for comparison (e.g., 1 for single, 2 for professional, 3 for enterprise)
  pricing: {
    monthly?: { priceId: string; price: number; interval: 'month' };
    yearly?: { priceId: string; price: number; interval: 'year' };
    one_time?: { priceId: string; price: number; interval: 'one_time' };
  };
}

export const stripeProducts: StripeProduct[] = [
  {
    id: 'prod_SuPs2GtzhJZTZi',
    name: 'ContractAnalyser Single Use',
    description: 'For one time use only',
    mode: 'payment',
    fileRetentionPolicy: 'Files are retained for 30 days.',
    tier: 1, // ADDED
    pricing: {
      one_time: {
        priceId: 'price_1Ryb2XChzNpNrJcahj0azZL0',
        price: 9.99,
        interval: 'one_time',
      },
    },
  },
  {
    id: 'prod_SuPkz2RKm6alku',
    name: 'ContractAnalyser Professional Use',
    description: 'Professional Subscription Plan (For only two users)',
    mode: 'subscription',
    fileRetentionPolicy: 'Files are retained for the duration of your active subscription plus a 30 day grace period.',
    maxFiles: 200, // Quota for Professional plan
    tier: 2, // ADDED
    pricing: {
      monthly: {
        priceId: 'price_1Ryav2ChzNpNrJcaRaDaHs0c',
        price: 29.99,
        interval: 'month',
      },
      yearly: {
        priceId: 'price_1RyaxmChzNpNrJcacFHIf4Lb', // Placeholder for yearly price ID
        price: 299.90,
        interval: 'year',
      },
    },
  },
  {
    id: 'prod_SuPptFOAtUB0Ve',
    name: 'ContractAnalyser Enterprise Use',
    description: 'Enterprise Subscription Plan (For unlimited users)',
    mode: 'subscription',
    fileRetentionPolicy: 'Files are retained for the duration of your active subscription plus a 30 day grace period.',
    maxFiles: 1000, // Quota for Enterprise plan
    tier: 3, // ADDED
    pricing: {
      monthly: {
        priceId: 'price_1RyazYChzNpNrJcaR6MzfRuJ',
        price: 299.99,
        interval: 'month',
      },
      yearly: {
        priceId: 'price_1Ryb0qChzNpNrJcaL40z6Mlc', // Placeholder for yearly price ID
        price: 2999.90,
        interval: 'year',
      },
    },
  },
];