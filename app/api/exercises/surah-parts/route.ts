import { getAvailableSurahParts } from '@/lib/exercise-vocab';
import { ALL_SURAHS } from '@/lib/surahs-data';

export async function GET() {
  try {
    const surahParts = await getAvailableSurahParts();

    // Enrich with surah names
    const enriched = surahParts.map(sp => {
      const surah = ALL_SURAHS.find(s => s.id === sp.surah_id);
      return {
        surah_id: sp.surah_id,
        surah_part: sp.surah_part,
        surah_name_arabic: surah?.nameArabic || '',
        surah_name_english: surah?.nameEnglish || '',
        surah_transliteration: surah?.transliteration || `Surah ${sp.surah_id}`,
        display_label: `${surah?.transliteration || `Surah ${sp.surah_id}`} - Part ${sp.surah_part}`,
      };
    });

    return new Response(
      JSON.stringify({ success: true, surah_parts: enriched }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching surah parts:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch surah parts' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
