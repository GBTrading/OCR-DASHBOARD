import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js@2';

// These values are public and safe to be exposed in a browser
// Security is managed by Row Level Security (RLS) policies in Supabase
const supabaseUrl = 'https://gidcaqjahzuvmmqlaohj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpZGNhcWphaHp1dm1tcWxhb2hqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzM2NTksImV4cCI6MjA3MDA0OTY1OX0.kQ5byHNhr7uqaKmwXqRZy43jwdN9liMZVy5iLjL8wt0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);