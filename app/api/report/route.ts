import { NextRequest } from 'next/server';
import { generateReport, getMotivationalMessage } from '@/lib/reportGenerator';

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Session ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const report = await generateReport(sessionId);

    if (!report) {
      return new Response(
        JSON.stringify({ error: 'Failed to generate report' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const motivationalMessage = getMotivationalMessage(report.sessionSummary.overallScore);

    return new Response(
      JSON.stringify({
        ...report,
        motivationalMessage,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Report error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate report' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}