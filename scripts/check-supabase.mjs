#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

// Try to load .env.local if dotenv is installed. Fall back silently otherwise.
try {
  // dynamic import so script doesn't hard-depend on dotenv being installed
  const dotenv = await import('dotenv');
  dotenv.config({ path: '.env.local' });
  // eslint-disable-next-line no-console
  console.log('Loaded environment from .env.local');
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn(
    'dotenv not installed or .env.local not found; falling back to process.env. To enable .env.local support run: npm install dotenv'
  );
}

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  'https://rkatcucnaotrdunmnvue.supabase.co';
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_KEY ?? process.env.SUPABASE_KEY ?? '';

function fail(msg, code = 1) {
  // eslint-disable-next-line no-console
  console.error(msg);
  process.exit(code);
}

if (!SUPABASE_KEY) {
  fail(
    'Supabase key is not set. Set VITE_SUPABASE_KEY or SUPABASE_KEY in your environment before running this script.'
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

try {
  // lightweight probe: select 1 id from profiles
  const res = await supabase
    .from('profiles')
    .select('id')
    .limit(1)
    .maybeSingle();
  if (res.error) {
    fail(`Query error: ${res.error.message}`, 3);
  }
  // eslint-disable-next-line no-console
  console.log('Supabase probe OK. sample result:', res.data ?? null);
  process.exit(0);
} catch (e) {
  fail(`Supabase connection failed: ${e?.message ?? String(e)}`, 4);
}
