import { supabaseServer } from '../supabase-server';

// ============================================================
// Types
// ============================================================

export type SubscriptionTier = 'student' | 'scholar' | 'dedicated';

export interface QuotaInfo {
  tier: SubscriptionTier;
  messageQuota: number;
  messagesUsed: number;
  messagesRemaining: number;
  tokenQuota: number;
  tokensUsed: number;
  tokensRemaining: number;
  resetDate: Date;
}

export interface CanSendResult {
  canSend: boolean;
  reason?: 'message_limit' | 'token_limit';
  messagesRemaining: number;
  tokensRemaining: number;
  resetDate: Date;
}

export interface UsageIncrementResult {
  messagesRemaining: number;
  tokensRemaining: number;
}

// ============================================================
// Tier Configuration
// ============================================================

export const TIER_LIMITS: Record<SubscriptionTier, { messages: number; tokens: number }> = {
  student: { messages: 100, tokens: 300000 },
  scholar: { messages: 250, tokens: 750000 },
  dedicated: { messages: 600, tokens: 1500000 },
};

// ============================================================
// Get or Create Profile
// ============================================================

/**
 * Gets an existing profile or creates a new one with default (student) tier.
 * Uses the database function for atomic operation.
 */
export async function getOrCreateProfile(userId: string, email?: string) {
  const { data, error } = await supabaseServer.rpc('get_or_create_profile', {
    user_id: userId,
    user_email: email || null,
  });

  if (error) {
    console.error('Error getting/creating profile:', error);
    // Fall back to direct query/insert
    return await getOrCreateProfileFallback(userId, email);
  }

  return data;
}

/**
 * Fallback if RPC doesn't exist yet (before migration is run)
 */
async function getOrCreateProfileFallback(userId: string, email?: string) {
  // Try to get existing
  const { data: existing } = await supabaseServer
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (existing) return existing;

  // Create new profile
  const { data: newProfile, error } = await supabaseServer
    .from('profiles')
    .insert({
      id: userId,
      email: email || null,
      subscription_tier: 'student',
      weekly_message_quota: 100,
      weekly_messages_used: 0,
      weekly_token_quota: 300000,
      weekly_tokens_used: 0,
      quota_reset_date: getNextSunday(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating profile:', error);
    throw new Error('Failed to create user profile');
  }

  return newProfile;
}

/**
 * Get next Sunday at 00:00 UTC
 */
function getNextSunday(): string {
  const now = new Date();
  const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7;
  const nextSunday = new Date(now);
  nextSunday.setUTCDate(now.getUTCDate() + daysUntilSunday);
  nextSunday.setUTCHours(0, 0, 0, 0);
  return nextSunday.toISOString();
}

// ============================================================
// Check Quota
// ============================================================

/**
 * Check if user can send a message.
 * Returns quota status and reason if blocked.
 */
export async function canSendMessage(userId: string): Promise<CanSendResult> {
  const profile = await getOrCreateProfile(userId);

  // Check if quota reset is due
  const resetDate = new Date(profile.quota_reset_date);
  if (resetDate <= new Date()) {
    // Reset is due - reset counters
    await resetUserQuota(userId);
    return {
      canSend: true,
      messagesRemaining: profile.weekly_message_quota,
      tokensRemaining: profile.weekly_token_quota,
      resetDate: new Date(getNextSunday()),
    };
  }

  const messagesRemaining = profile.weekly_message_quota - profile.weekly_messages_used;
  const tokensRemaining = profile.weekly_token_quota - profile.weekly_tokens_used;

  // Check message limit first (more common)
  if (messagesRemaining <= 0) {
    return {
      canSend: false,
      reason: 'message_limit',
      messagesRemaining: 0,
      tokensRemaining,
      resetDate,
    };
  }

  // Check token limit (rare - catches abuse)
  if (tokensRemaining <= 0) {
    return {
      canSend: false,
      reason: 'token_limit',
      messagesRemaining,
      tokensRemaining: 0,
      resetDate,
    };
  }

  return {
    canSend: true,
    messagesRemaining,
    tokensRemaining,
    resetDate,
  };
}

// ============================================================
// Get Quota Info
// ============================================================

/**
 * Get full quota information for a user.
 * Used for displaying quota status in UI.
 */
export async function getQuotaInfo(userId: string): Promise<QuotaInfo> {
  const profile = await getOrCreateProfile(userId);

  // Check if quota reset is due
  let resetDate = new Date(profile.quota_reset_date);
  let messagesUsed = profile.weekly_messages_used;
  let tokensUsed = profile.weekly_tokens_used;

  if (resetDate <= new Date()) {
    // Reset is due
    await resetUserQuota(userId);
    messagesUsed = 0;
    tokensUsed = 0;
    resetDate = new Date(getNextSunday());
  }

  return {
    tier: profile.subscription_tier as SubscriptionTier,
    messageQuota: profile.weekly_message_quota,
    messagesUsed,
    messagesRemaining: profile.weekly_message_quota - messagesUsed,
    tokenQuota: profile.weekly_token_quota,
    tokensUsed,
    tokensRemaining: profile.weekly_token_quota - tokensUsed,
    resetDate,
  };
}

// ============================================================
// Increment Usage
// ============================================================

/**
 * Increment usage counters after a successful message exchange.
 * Updates both user profile and lesson counters.
 */
export async function incrementUsage(
  userId: string,
  lessonId: string,
  tokensUsed: number
): Promise<UsageIncrementResult> {
  // Update user profile
  const { data: profile, error: profileError } = await supabaseServer
    .from('profiles')
    .update({
      weekly_messages_used: supabaseServer.rpc('increment_int', {
        row_id: userId,
        table_name: 'profiles',
        column_name: 'weekly_messages_used',
        amount: 1,
      }),
      weekly_tokens_used: supabaseServer.rpc('increment_int', {
        row_id: userId,
        table_name: 'profiles',
        column_name: 'weekly_tokens_used',
        amount: tokensUsed,
      }),
    })
    .eq('id', userId)
    .select()
    .single();

  // Fallback: Use raw SQL increment if RPC doesn't exist
  if (profileError) {
    await incrementUsageFallback(userId, lessonId, tokensUsed);
    const updatedProfile = await getOrCreateProfile(userId);
    return {
      messagesRemaining: updatedProfile.weekly_message_quota - updatedProfile.weekly_messages_used,
      tokensRemaining: updatedProfile.weekly_token_quota - updatedProfile.weekly_tokens_used,
    };
  }

  // Update lesson counters
  await supabaseServer
    .from('lessons')
    .update({
      messages_count: supabaseServer.rpc('increment_int', {
        row_id: lessonId,
        table_name: 'lessons',
        column_name: 'messages_count',
        amount: 1,
      }),
      tokens_used: supabaseServer.rpc('increment_int', {
        row_id: lessonId,
        table_name: 'lessons',
        column_name: 'tokens_used',
        amount: tokensUsed,
      }),
    })
    .eq('id', lessonId);

  return {
    messagesRemaining: profile.weekly_message_quota - profile.weekly_messages_used,
    tokensRemaining: profile.weekly_token_quota - profile.weekly_tokens_used,
  };
}

/**
 * Fallback increment using separate queries (less efficient but works without RPC)
 */
async function incrementUsageFallback(
  userId: string,
  lessonId: string,
  tokensUsed: number
): Promise<void> {
  // Get current values
  const { data: profile } = await supabaseServer
    .from('profiles')
    .select('weekly_messages_used, weekly_tokens_used')
    .eq('id', userId)
    .single();

  if (profile) {
    await supabaseServer
      .from('profiles')
      .update({
        weekly_messages_used: profile.weekly_messages_used + 1,
        weekly_tokens_used: profile.weekly_tokens_used + tokensUsed,
      })
      .eq('id', userId);
  }

  // Update lesson
  const { data: lesson } = await supabaseServer
    .from('lessons')
    .select('messages_count, tokens_used')
    .eq('id', lessonId)
    .single();

  if (lesson) {
    await supabaseServer
      .from('lessons')
      .update({
        messages_count: (lesson.messages_count || 0) + 1,
        tokens_used: (lesson.tokens_used || 0) + tokensUsed,
      })
      .eq('id', lessonId);
  }
}

// ============================================================
// Reset Quota
// ============================================================

/**
 * Reset a single user's quota (when their reset date has passed)
 */
async function resetUserQuota(userId: string): Promise<void> {
  const nextResetDate = getNextSunday();

  await supabaseServer
    .from('profiles')
    .update({
      weekly_messages_used: 0,
      weekly_tokens_used: 0,
      quota_reset_date: nextResetDate,
    })
    .eq('id', userId);
}

/**
 * Reset all users whose quota reset date has passed.
 * Called by cron job every Sunday.
 */
export async function resetAllExpiredQuotas(): Promise<number> {
  const { data, error } = await supabaseServer.rpc('reset_weekly_quotas');

  if (error) {
    console.error('Error resetting quotas via RPC:', error);
    // Fallback to direct update
    return await resetAllExpiredQuotasFallback();
  }

  return data || 0;
}

/**
 * Fallback reset function if RPC doesn't exist
 */
async function resetAllExpiredQuotasFallback(): Promise<number> {
  const now = new Date().toISOString();

  const { data, error } = await supabaseServer
    .from('profiles')
    .update({
      weekly_messages_used: 0,
      weekly_tokens_used: 0,
      quota_reset_date: getNextSunday(),
    })
    .lte('quota_reset_date', now)
    .select();

  if (error) {
    console.error('Error resetting quotas:', error);
    return 0;
  }

  return data?.length || 0;
}

// ============================================================
// Update Subscription Tier
// ============================================================

/**
 * Update a user's subscription tier.
 * The database trigger will automatically update their quotas.
 */
export async function updateSubscriptionTier(
  userId: string,
  newTier: SubscriptionTier
): Promise<QuotaInfo> {
  const { data, error } = await supabaseServer
    .from('profiles')
    .update({ subscription_tier: newTier })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating subscription tier:', error);
    throw new Error('Failed to update subscription tier');
  }

  return {
    tier: data.subscription_tier,
    messageQuota: data.weekly_message_quota,
    messagesUsed: data.weekly_messages_used,
    messagesRemaining: data.weekly_message_quota - data.weekly_messages_used,
    tokenQuota: data.weekly_token_quota,
    tokensUsed: data.weekly_tokens_used,
    tokensRemaining: data.weekly_token_quota - data.weekly_tokens_used,
    resetDate: new Date(data.quota_reset_date),
  };
}
