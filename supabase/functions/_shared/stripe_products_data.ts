import { StripeProduct } from './stripe_product_types.ts';

export const stripeProducts: StripeProduct[] = [
  {
    id: 'prod_SuPs2GtzhJZTZi',
    name: 'ContractAnalyser Single Use',
    description: 'For one time use only',
    mode: 'payment',
    fileRetentionPolicy: 'Files are retained for 30 days.',
    tier: 1,
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
    description: 'Professional Subscription Plan (Unlimited use for only two(2) users)',
    mode: 'subscription',
    fileRetentionPolicy: 'Files are retained for the duration of your active subscription plus a 30 day grace period.',
    maxFiles: 200,
    tier: 2,
    pricing: {
      monthly: {
        priceId: 'price_1Ryav2ChzNpNrJcaRaDaHs0c',
        price: 29.99,
        interval: 'month',
      },
      yearly: {
        priceId: 'price_1RyaxmChzNpNrJcacFHIf4Lb',
        price: 299.90,
        interval: 'year',
      },
    },
  },
  {
    id: 'prod_SuPptFOAtUB0Ve',
    name: 'ContractAnalyser Enterprise Use',
    description: 'Enterprise Subscription Plan (Unlimited use for unlimited users)',
    mode: 'subscription',
    fileRetentionPolicy: 'Files are retained for the duration of your active subscription plus a 30 day grace period.',
    maxFiles: 1000,
    tier: 3,
    pricing: {
      monthly: {
        priceId: 'price_1RyazYChzNpNrJcaR6MzfRuJ',
        price: 299.99,
        interval: 'month',
      },
      yearly: {
        priceId: 'price_1Ryb0qChzNpNrJcaL40z6Mlc',
        price: 2999.90,
        interval: 'year',
      },
    },
  },
  // New Admin-Assigned Free Plans
  {
    id: 'prod_AdminFreeProfessional', // Unique ID for admin-assigned free professional
    name: 'ContractAnalyser Professional Use (Admin Free)',
    description: 'Professional Subscription Plan (Admin Assigned - Free)',
    mode: 'admin_assigned', // New mode
    fileRetentionPolicy: 'Files are retained indefinitely for admin-assigned plans.',
    maxFiles: 200,
    tier: 2,
    pricing: {
      monthly: { // Using monthly for consistency, but it's not a real Stripe price
        priceId: 'price_admin_professional_free', // Unique ID, not a real Stripe price ID
        price: 0.00,
        interval: 'month',
      },
    },
  },
  {
    id: 'prod_AdminFreeEnterprise', // Unique ID for admin-assigned free enterprise
    name: 'ContractAnalyser Enterprise Use (Admin Free)',
    description: 'Enterprise Subscription Plan (Admin Assigned - Free)',
    mode: 'admin_assigned', // New mode
    fileRetentionPolicy: 'Files are retained indefinitely for admin-assigned plans.',
    maxFiles: 1000,
    tier: 3,
    pricing: {
      monthly: { // Using monthly for consistency, but it's not a real Stripe price
        priceId: 'price_admin_enterprise_free', // Unique ID, not a real Stripe price ID
        price: 0.00,
        interval: 'month',
      },
    },
  },
];