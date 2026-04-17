import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://ccwaysefralvvcanfyck.supabase.co'
const SUPABASE_KEY = 'sb_publishable_CkQMEYmO3PMnHS8NbtDd9A_En8pvV6W'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
