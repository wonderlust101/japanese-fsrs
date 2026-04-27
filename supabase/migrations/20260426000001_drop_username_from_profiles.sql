-- Display name is stored in auth.users user_metadata (raw_user_meta_data->>'display_name')
-- and set at signup via supabase.auth.signUp options.data. A separate username column
-- in profiles is redundant and creates a sync problem, so it is dropped here.

ALTER TABLE profiles DROP COLUMN IF EXISTS username;
