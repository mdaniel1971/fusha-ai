import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scenarioId = parseInt(params.id);

    if (isNaN(scenarioId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid scenario ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch scenario metadata
    const { data: scenario, error: scenarioError } = await supabase
      .from('scenarios')
      .select('*')
      .eq('id', scenarioId)
      .single();

    if (scenarioError || !scenario) {
      return new Response(
        JSON.stringify({ error: 'Scenario not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch scenario_words with word data
    const { data: scenarioWords, error: swError } = await supabase
      .from('scenario_words')
      .select('id, word_id, position_top, position_left, scene_number')
      .eq('scenario_id', scenarioId);

    if (swError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch scenario words' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get word details
    const wordIds = scenarioWords?.map(sw => sw.word_id) || [];
    const { data: words, error: wordsError } = await supabase
      .from('words')
      .select('id, text_arabic, transliteration, translation_english, part_of_speech')
      .in('id', wordIds);

    if (wordsError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch words' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Combine scenario_words with word details
    const wordsMap = new Map(words?.map(w => [w.id, w]) || []);
    const allWords = scenarioWords?.map(sw => {
      const word = wordsMap.get(sw.word_id);
      return {
        id: sw.id,
        wordId: sw.word_id,
        sceneNumber: sw.scene_number || null,
        position: sw.scene_number ? {
          top: sw.position_top || '50%',
          left: sw.position_left || '50%',
        } : null,
        arabic: word?.text_arabic || '',
        transliteration: word?.transliteration || '',
        english: word?.translation_english || '',
        partOfSpeech: word?.part_of_speech || '',
      };
    }) || [];

    return new Response(
      JSON.stringify({
        id: scenario.id,
        title: scenario.title,
        titleArabic: scenario.setup_arabic,
        description: scenario.setup_english,
        sceneCount: 3, // Fixed at 3 scenes for now
        words: allWords,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Scenario fetch error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch scenario' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Update word placement (scene, position)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { wordId, sceneNumber, position } = await request.json();

    if (!wordId) {
      return new Response(
        JSON.stringify({ error: 'Word ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updateData: Record<string, unknown> = {
      scene_number: sceneNumber,
    };

    if (position) {
      updateData.position_top = position.top;
      updateData.position_left = position.left;
    }

    const { error } = await supabase
      .from('scenario_words')
      .update(updateData)
      .eq('id', wordId);

    if (error) {
      console.error('Failed to update word:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to update word placement' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Word placement update error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update word placement' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
