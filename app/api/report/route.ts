import { NextRequest, NextResponse } from 'next/server';
import { generateReport, getMotivationalMessage } from '@/lib/reportGenerator';

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const report = await generateReport(sessionId);

    if (!report) {
      return NextResponse.json(
        { error: 'Failed to generate report' },
        { status: 500 }
      );
    }

    // Add motivational message
    const motivationalMessage = getMotivationalMessage(report.sessionSummary.overallScore);

    return NextResponse.json({
      ...report,
      motivationalMessage,
    });
  } catch (error) {
    console.error('Report generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
