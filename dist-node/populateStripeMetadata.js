import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { stripeProducts } from './supabase/functions/_shared/stripe_products_data.js'; // MODIFIED: Added .js extension
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL) {
    throw new Error('SUPABASE_URL environment variable is not set.');
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is not set.');
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
async function populateStripeProductMetadata() {
    // console.log('Starting population of stripe_product_metadata table...'); // REMOVED
    for (const product of stripeProducts) {
        const productData = [];
        if (product.pricing.monthly) {
            productData.push({
                price_id: product.pricing.monthly.priceId,
                product_id: product.id,
                max_users: product.max_users || null, // MODIFIED: Use product.max_users directly
                max_files: product.maxFiles || null, // MODIFIED: Use product.maxFiles directly
                credits: product.credits || null,
                tier: product.tier || null, // ADDED: Include tier
            });
        }
        if (product.pricing.yearly) {
            productData.push({
                price_id: product.pricing.yearly.priceId,
                product_id: product.id,
                max_users: product.max_users || null, // MODIFIED: Use product.max_users directly
                max_files: product.maxFiles || null, // MODIFIED: Use product.maxFiles directly
                credits: product.credits || null,
                tier: product.tier || null, // ADDED: Include tier
            });
        }
        if (product.pricing.one_time) {
            productData.push({
                price_id: product.pricing.one_time.priceId,
                product_id: product.id,
                max_users: null, // One-time products don't have max_users
                max_files: null, // One-time products don't have max_files
                credits: product.credits || null,
                tier: product.tier || null, // ADDED: Include tier
            });
        }
        for (const data of productData) {
            const { error } = await supabase
                .from('stripe_product_metadata')
                .upsert(data, { onConflict: 'price_id' });
            if (error) {
                console.error(`Error upserting data for price_id ${data.price_id}:`, error.message);
            }
            else {
                // console.log(`Successfully upserted data for price_id: ${data.price_id}`); // REMOVED
            }
        }
    }
    // console.log('Population process completed.'); // REMOVED
}
populateStripeProductMetadata().catch(console.error);
