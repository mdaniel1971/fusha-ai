export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getQuotaInfo } from "@/lib/db";

/**
 * GET /api/quota?userId=xxx
 * Returns current quota status for a user.
 *
 * Note: Token info is intentionally not exposed to users - it's internal cost protection.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId query parameter is required" },
        { status: 400 },
      );
    }

    const quota = await getQuotaInfo(userId);

    // Return user-friendly quota info (no token details)
    return NextResponse.json({
      tier: quota.tier,
      messageQuota: quota.messageQuota,
      messagesUsed: quota.messagesUsed,
      messagesRemaining: quota.messagesRemaining,
      resetDate: quota.resetDate.toISOString(),
    });
  } catch (error) {
    console.error("Error getting quota info:", error);
    return NextResponse.json(
      { error: "Failed to get quota info" },
      { status: 500 },
    );
  }
}
