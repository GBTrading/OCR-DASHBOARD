import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js@2';

// Use environment variables with fallback for development
const supabaseUrl = process.env.SUPABASE_URL || 'https://gidcaqjahzuvmmqlaohj.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpZGNhcWphaHp1dm1tcWxhb2hqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzM2NTksImV4cCI6MjA3MDA0OTY1OX0.kQ5byHNhr7uqaKmwXqRZy43jwdN9liMZVy5iLjL8wt0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);