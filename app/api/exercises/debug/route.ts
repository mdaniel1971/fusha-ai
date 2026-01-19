import { supabase } from '@/lib/supabase';

// Debug endpoint to check database content for a surah
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const surahId = parseInt(searchParams.get('surah_id') || '1');

  // Step 1: Get verses for this surah
  const { data: verses, error: versesError } = await supabase
    .from('verses')
    .select('id, surah_id, verse_number, text_arabic')
    .eq('surah_id', surahId)
    .order('verse_number', { ascending: true });

  if (versesError) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch verses', details: versesError.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Step 2: Get words for these verses
  const verseIds = verses?.map(v => v.id) || [];

  const { data: words, error: wordsError } = await supabase
    .from('words')
    .select('id, verse_id, word_position, text_arabic, translation_english, part_of_speech')
    .in('verse_id', verseIds)
    .order('verse_id', { ascending: true })
    .order('word_position', { ascending: true });

  if (wordsError) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch words', details: wordsError.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Step 3: Also check what verse IDs exist in words table that link to surah 1
  const { data: allWords, error: allWordsError } = await supabase
    .from('words')
    .select('id, verse_id, text_arabic, translation_english')
    .limit(50);

  // Step 4: Check the structure of verses table
  const { data: sampleVerses } = await supabase
    .from('verses')
    .select('*')
    .limit(10);

  return new Response(
    JSON.stringify({
      surah_id_queried: surahId,
      verses: {
        count: verses?.length || 0,
        data: verses,
      },
      words: {
        count: words?.length || 0,
        data: words,
      },
      sample_all_words: {
        count: allWords?.length || 0,
        data: allWords?.slice(0, 10),
      },
      sample_verses_structure: sampleVerses?.slice(0, 5),
    }, null, 2),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
