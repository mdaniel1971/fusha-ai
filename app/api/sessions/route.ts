import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, surah_id, level } = body;

    if (!id) {
      return new Response(
        JSON.stringify({ error: 'Session ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create session record (user_id is nullable for anonymous users)
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        id,
        surah_id: surah_id || 1, // Default to Al-Fatiha
        // user_id is left null for anonymous sessions
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to create session:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to create session', details: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, sessionId: data.id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Session creation error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Update session (e.g., to mark as ended)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ended_at, tokens_used } = body;

    if (!id) {
      return new Response(
        JSON.stringify({ error: 'Session ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (ended_at) updateData.ended_at = ended_at;
    if (tokens_used !== undefined) updateData.tokens_used = tokens_used;

    const { error } = await supabase
      .from('sessions')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Failed to update session:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to update session', details: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Session update error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
