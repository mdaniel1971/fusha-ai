export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';

export type PerformanceLevel = 'mastered' | 'emerging' | 'struggling';
export type ContextType = 'production' | 'correction_accepted' | 'correction_rejected' | 'identification';

export interface GrammarObservation {
  session_id: string;
  user_id?: string;
  word_id?: number;
  grammar_feature: string;
  grammar_value: string;
  performance_level: PerformanceLevel;
  context_type: ContextType;
  student_attempt?: string;
  correct_form?: string;
  error_type?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Support both single observation and batch
    const observations: GrammarObservation[] = Array.isArray(body) ? body : [body];

    // Validate required fields
    for (const obs of observations) {
      if (!obs.session_id || !obs.grammar_feature || !obs.grammar_value || !obs.performance_level || !obs.context_type) {
        return new Response(
          JSON.stringify({
            error: 'Missing required fields: session_id, grammar_feature, grammar_value, performance_level, context_type'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Validate performance_level
      if (!['mastered', 'emerging', 'struggling'].includes(obs.performance_level)) {
        return new Response(
          JSON.stringify({ error: 'Invalid performance_level. Must be: mastered, emerging, or struggling' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Validate context_type
      if (!['production', 'correction_accepted', 'correction_rejected', 'identification'].includes(obs.context_type)) {
        return new Response(
          JSON.stringify({ error: 'Invalid context_type. Must be: production, correction_accepted, correction_rejected, or identification' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Insert observations
    const { data, error } = await supabase
      .from('grammar_observations')
      .insert(observations)
      .select('id');

    if (error) {
      console.error('Failed to log grammar observations:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to log observations', details: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        logged: data?.length || observations.length,
        ids: data?.map(d => d.id) || []
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Grammar observation logging error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// GET endpoint to retrieve grammar observations for a session or user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const userId = searchParams.get('userId');
    const grammarFeature = searchParams.get('grammarFeature');
    const performanceLevel = searchParams.get('performanceLevel');
    const limit = parseInt(searchParams.get('limit') || '100');

    let query = supabase
      .from('grammar_observations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (grammarFeature) {
      query = query.eq('grammar_feature', grammarFeature);
    }

    if (performanceLevel) {
      query = query.eq('performance_level', performanceLevel);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch grammar observations:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch observations' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ observations: data || [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Grammar observation fetch error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
