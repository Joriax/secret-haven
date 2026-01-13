-- Add username column to vault_users table
ALTER TABLE public.vault_users 
ADD COLUMN username TEXT UNIQUE;

-- Create index for faster username lookups
CREATE INDEX idx_vault_users_username ON public.vault_users(username);

-- Make username NOT NULL for new users (existing users will need to have it set via admin)
-- We don't add NOT NULL constraint to avoid breaking existing data
-- Admin will need to set usernames for existing users

COMMENT ON COLUMN public.vault_users.username IS 'Unique username for login, can only be changed by admins';