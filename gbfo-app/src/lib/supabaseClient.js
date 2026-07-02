import { createClient } from "@supabase/supabase-js";

// Proyecto: garcia-blanco-family-office
const supabaseUrl = "https://mlbbbskhoficppzisfqo.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sYmJic2tob2ZpY3BwemlzZnFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMTQ3MTQsImV4cCI6MjA5ODU5MDcxNH0.gv8gDqDYP5-Eu391G5tXmxBP_Njs3AGm9rFebNIlbI8";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
