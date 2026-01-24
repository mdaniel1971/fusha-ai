import { supabaseServer } from '../supabase-server';

/**
 * Reset weekly quotas for all users whose reset date has passed.
 * This function should be called by a cron job every Sunday at 00:00 UTC.
 *
 * Options for scheduling:
 * 1. Supabase Edge Function with pg_cron
 * 2. Vercel Cron Jobs
 * 3. External service like EasyCron
 *
 * @returns Number of users whose quotas were reset
 */
export async function resetWeeklyQuotas(): Promise<{
  success: boolean;
  usersReset: number;
  error?: string;
}> {
  try {
    // Try using the database function first (more efficient)
    const { data: rpcResult, error: rpcError } = await supabaseServer.rpc('reset_weekly_quotas');

    if (!rpcError && typeof rpcResult === 'number') {
      console.log(`Weekly quota reset complete: ${rpcResult} users reset`);
      return { success: true, usersReset: rpcResult };
    }

    // Fallback to direct query if RPC doesn't exist
    console.log('RPC not available, using fallback reset method');

    const now = new Date().toISOString();
    const nextSunday = getNextSunday();

    const { data, error } = await supabaseServer
      .from('profiles')
      .update({
        weekly_messages_used: 0,
        weekly_tokens_used: 0,
        quota_reset_date: nextSunday,
      })
      .lte('quota_reset_date', now)
      .select('id');

    if (error) {
      console.error('Error resetting quotas:', error);
      return { success: false, usersReset: 0, error: error.message };
    }

    const usersReset = data?.length || 0;
    console.log(`Weekly quota reset complete: ${usersReset} users reset`);
    return { success: true, usersReset };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Weekly quota reset failed:', errorMessage);
    return { success: false, usersReset: 0, error: errorMessage };
  }
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

/**
 * Check if any quotas need to be reset.
 * Useful for monitoring.
 */
export async function getPendingResetCount(): Promise<number> {
  const now = new Date().toISOString();

  const { count, error } = await supabaseServer
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .lte('quota_reset_date', now);

  if (error) {
    console.error('Error checking pending resets:', error);
    return 0;
  }

  return count || 0;
}
