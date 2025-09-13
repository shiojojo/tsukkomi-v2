#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

try {
  const dotenv = await import('dotenv');
  dotenv.config({ path: '.env.local' });
  // eslint-disable-next-line no-console
  console.log('Loaded environment from .env.local');
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn(
    'dotenv not installed or .env.local not found; falling back to process.env.'
  );
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY ?? process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  // eslint-disable-next-line no-console
  console.error(
    'Supabase URL or Key missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_KEY or SUPABASE_KEY.'
  );
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

try {
  // Find topics with NULL image
  const { data: nullRows, error: selectError } = await supabase
    .from('topics')
    .select('id, title, image')
    .is('image', null);
  if (selectError) {
    throw selectError;
  }

  if (!nullRows || nullRows.length === 0) {
    // eslint-disable-next-line no-console
    console.log('No topics with NULL image found.');
    // show all topics count
    const { data: all, error: allErr } = await supabase
      .from('topics')
      .select('id')
      .limit(1);
    if (allErr) console.warn('Could not fetch topics count:', allErr.message);
    process.exit(0);
  }

  // print rows
  // eslint-disable-next-line no-console
  console.log(`Found ${nullRows.length} topic(s) with NULL image:`);
  nullRows.forEach(r => console.log(r));

  // Update them to empty string
  const { error: updateError, count } = await supabase
    .from('topics')
    .update({ image: '' })
    .is('image', null);

  if (updateError) throw updateError;
  // eslint-disable-next-line no-console
  console.log('Updated topics: set image = "" where image IS NULL');
  process.exit(0);
} catch (e) {
  // eslint-disable-next-line no-console
  console.error('Error during topic image normalization:', e?.message ?? e);
  process.exit(3);
}
