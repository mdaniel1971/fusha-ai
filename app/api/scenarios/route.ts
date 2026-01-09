import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data: scenarios, error } = await supabase
      .from('scenarios')
      .select('id, title, setup_arabic, setup_english')
      .order('id');

    if (error) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch scenarios' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ scenarios }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Scenarios fetch error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch scenarios' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
