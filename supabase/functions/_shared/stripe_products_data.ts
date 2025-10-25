import { StripeProduct } from './stripe_product_types.js';

export const stripeProducts: StripeProduct[] = [
  {
    id: 'prod_SuPs2GtzhJZTZi',
    name: 'product_name_single_use', // MODIFIED to translation key
    description: 'product_desc_single_use_5_credits', // MODIFIED: New description key
    mode: 'payment',
    fileRetentionPolicy: 'file_retention_policy_single_use_desc', // MODIFIED to translation key
    tier: 1,
    credits: 5, // ADDED: New credits property
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
    name: 'product_name_professional_use', // MODIFIED to translation key
    description: 'product_desc_professional_use', // MODIFIED to translation key
    mode: 'subscription',
    fileRetentionPolicy: 'file_retention_policy_subscription_desc', // MODIFIED to translation key
    maxFiles: 200,
    max_users: 2,
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
  // ADDED: New Advanced Subscription Plans - Professional Use (Advanced)
  {
    id: 'prod_TIeiCbtx4Hg7xk',
    name: 'product_name_professional_use_advanced',
    description: 'product_desc_professional_use_advanced',
    mode: 'subscription',
    fileRetentionPolicy: 'file_retention_policy_subscription_desc',
    maxFiles: 200,
    max_users: 2,
    tier: 4, // New tier for advanced professional
    pricing: {
      monthly: {
        priceId: 'price_1SM3OfChzNpNrJcaqVjHjwyW', // Placeholder, replace with actual Stripe Price ID
        price: 49.99,
        interval: 'month',
      },
      yearly: {
        priceId: 'price_1SM3TAChzNpNrJcaCmaGd25u', // Placeholder, replace with actual Stripe Price ID
        price: 499.90,
        interval: 'year',
      },
    },
  },
  {
    id: 'prod_SuPptFOAtUB0Ve',
    name: 'product_name_enterprise_use', // MODIFIED to translation key
    description: 'product_desc_enterprise_use', // MODIFIED to translation key
    mode: 'subscription',
    fileRetentionPolicy: 'file_retention_policy_subscription_desc', // MODIFIED to translation key
    maxFiles: 1000,
    max_users: 999999,
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
  // ADDED: New Advanced Subscription Plans - Enterprise Use (Advanced)
  {
    id: 'prod_TIekueXHffn0wz',
    name: 'product_name_enterprise_use_advanced',
    description: 'product_desc_enterprise_use_advanced',
    mode: 'subscription',
    fileRetentionPolicy: 'file_retention_policy_subscription_desc',
    maxFiles: 1000,
    max_users: 999999,
    tier: 5, // New tier for advanced enterprise
    pricing: {
      monthly: {
        priceId: 'price_1SM3QnChzNpNrJcagCz4k2Ze', // Placeholder, replace with actual Stripe Price ID
        price: 499.99,
        interval: 'month',
      },
      yearly: {
        priceId: 'price_1SM3VMChzNpNrJcaiorgUkYw', // Placeholder, replace with actual Stripe Price ID
        price: 4999.90,
        interval: 'year',
      },
    },
  },
  // New Admin-Assigned Free Plans (these remain at the end as they are filtered out for public display)
  {
    id: 'prod_AdminFreeProfessional',
    name: 'product_name_admin_free_professional', // MODIFIED to translation key
    description: 'product_desc_admin_free_professional', // MODIFIED to translation key
    mode: 'admin_assigned',
    fileRetentionPolicy: 'file_retention_policy_admin_assigned_desc', // MODIFIED to translation key
    maxFiles: 200,
    max_users: 2,
    tier: 2,
    pricing: {
      monthly: {
        priceId: 'price_admin_professional_free',
        price: 0.00,
        interval: 'month',
      },
    },
  },
  {
    id: 'prod_AdminFreeEnterprise',
    name: 'product_name_admin_free_enterprise', // MODIFIED to translation key
    description: 'product_desc_admin_free_enterprise', // MODIFIED to translation key
    mode: 'admin_assigned',
    fileRetentionPolicy: 'file_retention_policy_admin_assigned_desc', // MODIFIED to translation key
    maxFiles: 1000,
    max_users: 10,
    tier: 3,
    pricing: {
      monthly: {
        priceId: 'price_admin_enterprise_free',
        price: 0.00,
        interval: 'month',
      },
    },
  },
];