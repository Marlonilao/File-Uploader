const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

console.log('SUPABASE_BUCKET:', process.env.SUPABASE_BUCKET);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
);

module.exports = { supabase };
