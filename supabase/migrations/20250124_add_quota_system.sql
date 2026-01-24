-- Migration: Add Message-Based Quota System
-- Run this in Supabase SQL Editor

-- ============================================================
-- 1. Create profiles table if it doesn't exist
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. Add quota columns to profiles
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  subscription_tier TEXT DEFAULT 'student' CHECK (subscription_tier IN ('student', 'scholar', 'dedicated'));

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  weekly_message_quota INTEGER DEFAULT 100;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  weekly_messages_used INTEGER DEFAULT 0;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  weekly_token_quota INTEGER DEFAULT 300000;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  weekly_tokens_used INTEGER DEFAULT 0;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  quota_reset_date TIMESTAMPTZ DEFAULT (DATE_TRUNC('week', NOW()) + INTERVAL '7 days');

-- Index for efficient quota reset queries
CREATE INDEX IF NOT EXISTS idx_profiles_quota_reset ON profiles(quota_reset_date);

-- ============================================================
-- 3. Add quota tracking to lessons table
-- ============================================================
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS
  messages_count INTEGER DEFAULT 0;

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS
  tokens_used INTEGER DEFAULT 0;

-- ============================================================
-- 4. Function to set quotas based on subscription tier
-- ============================================================
CREATE OR REPLACE FUNCTION set_quotas_from_tier()
RETURNS TRIGGER AS $$
BEGIN
  CASE NEW.subscription_tier
    WHEN 'student' THEN
      NEW.weekly_message_quota := 100;
      NEW.weekly_token_quota := 300000;
    WHEN 'scholar' THEN
      NEW.weekly_message_quota := 250;
      NEW.weekly_token_quota := 750000;
    WHEN 'dedicated' THEN
      NEW.weekly_message_quota := 600;
      NEW.weekly_token_quota := 1500000;
  END CASE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-set quotas when tier changes
DROP TRIGGER IF EXISTS update_quotas ON profiles;
CREATE TRIGGER update_quotas
  BEFORE INSERT OR UPDATE OF subscription_tier ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_quotas_from_tier();

-- ============================================================
-- 5. Function to reset weekly quotas (called by cron)
-- ============================================================
CREATE OR REPLACE FUNCTION reset_weekly_quotas()
RETURNS INTEGER AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  UPDATE profiles
  SET
    weekly_messages_used = 0,
    weekly_tokens_used = 0,
    quota_reset_date = quota_reset_date + INTERVAL '7 days'
  WHERE quota_reset_date <= NOW();

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6. RLS Policies for profiles table
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile (except subscription_tier - that's admin only)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Service role can do everything (for backend operations)
DROP POLICY IF EXISTS "Service role full access" ON profiles;
CREATE POLICY "Service role full access" ON profiles
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 7. Helper function to get or create profile
-- ============================================================
CREATE OR REPLACE FUNCTION get_or_create_profile(user_id UUID, user_email TEXT DEFAULT NULL)
RETURNS profiles AS $$
DECLARE
  profile_record profiles;
BEGIN
  -- Try to get existing profile
  SELECT * INTO profile_record FROM profiles WHERE id = user_id;

  -- If not found, create one
  IF NOT FOUND THEN
    INSERT INTO profiles (id, email, subscription_tier)
    VALUES (user_id, user_email, 'student')
    RETURNING * INTO profile_record;
  END IF;

  RETURN profile_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
