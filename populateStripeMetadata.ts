import 'dotenv/config'; // Import dotenv/config directly for ESM
import { createClient } from '@supabase/supabase-js';
import { stripeProducts } from './src/stripe-config.js'; // MODIFIED: Added .js extension

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate that environment variables are set
if (!SUPABASE_URL) {
  throw new Error('SUPABASE_URL environment variable is not set.');
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is not set.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function populateStripeProductMetadata() {
  console.log('Starting population of stripe_product_metadata table...');

  for (const product of stripeProducts) {
    const productData = [];

    // Handle monthly pricing
    if (product.pricing.monthly) {
      productData.push({
        price_id: product.pricing.monthly.priceId,
        product_id: product.id,
        max_users: product.name.includes('Professional Use') ? 2 : (product.name.includes('Enterprise Use') ? 999999 : null),
        max_files: product.maxFiles || null,
      });
    }

    // Handle yearly pricing
    if (product.pricing.yearly) {
      productData.push({
        price_id: product.pricing.yearly.priceId,
        product_id: product.id,
        max_users: product.name.includes('Professional Use') ? 2 : (product.name.includes('Enterprise Use') ? 999999 : null),
        max_files: product.maxFiles || null,
      });
    }

    // Handle one-time pricing
    if (product.pricing.one_time) {
      productData.push({
        price_id: product.pricing.one_time.priceId,
        product_id: product.id,
        max_users: null, // Single use typically doesn't have a user limit
        max_files: null, // Single use typically doesn't have a file limit
      });
    }

    for (const data of productData) {
      const { error } = await supabase
        .from('stripe_product_metadata')
        .upsert(data, { onConflict: 'price_id' }); // Use upsert to insert or update

      if (error) {
        console.error(`Error upserting data for price_id ${data.price_id}:`, error.message);
      } else {
        console.log(`Successfully upserted data for price_id: ${data.price_id}`);
      }
    }
  }

  console.log('Population process completed.');
}

populateStripeProductMetadata().catch(console.error);