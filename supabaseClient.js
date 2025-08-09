import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// IMPORTANT: Replace with your actual Supabase URL and Anon Key
const supabaseUrl = 'https://gidcaqjahzuvmmqlaohj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpZGNhcWphaHp1dm1tcWxhb2hqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzM2NTksImV4cCI6MjA3MDA0OTY1OX0.kQ5byHNhr7uqaKmwXqRZy43jwdN9liMZVy5iLjL8wt0';

// Create and export the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);