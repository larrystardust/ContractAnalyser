import { StripeProduct } from './stripe_product_types.ts';

export const stripeProducts: StripeProduct[] = [
  {
    id: 'prod_T2cDZNI5VjVdp5',
    name: 'product_name_single_use', // MODIFIED to translation key
    description: 'product_desc_single_use_5_credits', // MODIFIED: New description key
    mode: 'payment',
    fileRetentionPolicy: 'file_retention_policy_single_use_desc', // MODIFIED to translation key
    tier: 1,
    credits: 5, // ADDED: New credits property
    pricing: {
      one_time: {
        priceId: 'price_1S6WzTCgxsPALRL7PA3IsJcf',
        price: 9.99,
        interval: 'one_time',
      },
    },
  },
  {
    id: 'prod_T2cJ7cQzgeS3Ku',
    name: 'product_name_professional_use', // MODIFIED to translation key
    description: 'product_desc_professional_use', // MODIFIED to translation key
    mode: 'subscription',
    fileRetentionPolicy: 'file_retention_policy_subscription_desc', // MODIFIED to translation key
    maxFiles: 200,
    max_users: 2,
    tier: 2,
    pricing: {
      monthly: {
        priceId: 'price_1S6X58CgxsPALRL79XzfjR5o',
        price: 29.99,
        interval: 'month',
      },
      yearly: {
        priceId: 'price_1S6X8fCgxsPALRL72srcz1Sj',
        price: 299.90,
        interval: 'year',
      },
    },
  },
  {
    id: 'prod_T2cLOwJZatHP03',
    name: 'product_name_enterprise_use', // MODIFIED to translation key
    description: 'product_desc_enterprise_use', // MODIFIED to translation key
    mode: 'subscription',
    fileRetentionPolicy: 'file_retention_policy_subscription_desc', // MODIFIED to translation key
    maxFiles: 1000,
    max_users: 999999,
    tier: 3,
    pricing: {
      monthly: {
        priceId: 'price_1S6X75CgxsPALRL75wVzY9tJ',
        price: 299.99,
        interval: 'month',
      },
      yearly: {
        priceId: 'price_1S6X9gCgxsPALRL7c0O6Aipe',
        price: 2999.90,
        interval: 'year',
      },
    },
  },
  // New Admin-Assigned Free Plans
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
  // ADDED: New Advanced Subscription Plans
  {
    id: 'prod_AdvancedProfessional',
    name: 'product_name_professional_use_advanced',
    description: 'product_desc_professional_use_advanced',
    mode: 'subscription',
    fileRetentionPolicy: 'file_retention_policy_subscription_desc',
    maxFiles: 200,
    max_users: 2,
    tier: 4, // New tier for advanced professional
    pricing: {
      monthly: {
        priceId: 'price_1S6X58CgxsPALRL79XzfjR5o_advanced', // Placeholder, replace with actual Stripe Price ID
        price: 49.99,
        interval: 'month',
      },
      yearly: {
        priceId: 'price_1S6X8fCgxsPALRL72srcz1Sj_advanced', // Placeholder, replace with actual Stripe Price ID
        price: 499.90,
        interval: 'year',
      },
    },
  },
  {
    id: 'prod_AdvancedEnterprise',
    name: 'product_name_enterprise_use_advanced',
    description: 'product_desc_enterprise_use_advanced',
    mode: 'subscription',
    fileRetentionPolicy: 'file_retention_policy_subscription_desc',
    maxFiles: 1000,
    max_users: 999999,
    tier: 5, // New tier for advanced enterprise
    pricing: {
      monthly: {
        priceId: 'price_1S6X75CgxsPALRL75wVzY9tJ_advanced', // Placeholder, replace with actual Stripe Price ID
        price: 499.99,
        interval: 'month',
      },
      yearly: {
        priceId: 'price_1S6X9gCgxsPALRL7c0O6Aipe_advanced', // Placeholder, replace with actual Stripe Price ID
        price: 4999.90,
        interval: 'year',
      },
    },
  },
];