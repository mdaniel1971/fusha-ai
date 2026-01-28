import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

async function enrichQuranData() {
  console.log("--- Starting Precise Linguistic Enrichment ---");

  const { data, error } = await supabase
    .from("quran_words")
    .select(
      `
      id, text_arabic, word_position,
      verses (verse_number, surahs (surah_number))
    `,
    )
    .is("root_arabic", null)
    .order("id", { ascending: true })
    .limit(10);

  if (error || !data || data.length === 0) {
    console.log(
      error ? `DB Error: ${error.message}` : "✅ All words enriched!",
    );
    return;
  }

  const words = data as any[];
  const promptData = words.map((w) => {
    const v = Array.isArray(w.verses) ? w.verses[0] : w.verses;
    const s = v && Array.isArray(v.surahs) ? v.surahs[0] : v?.surahs;
    return {
      db_id: w.id,
      text: w.text_arabic,
      context: `Surah ${s?.surah_number}:${v?.verse_number} Word ${w.word_position}`,
    };
  });

  try {
    const msg = await anthropic.messages.create({
      model: "claude-opus-4-5-20251101",
      max_tokens: 2000,
      system: `You are a Quranic Morphological Analyst. 
      Analyze the provided Arabic words. 
      
      EXAMPLES OF QUALITY WORK:
      - "الرَّحْمَٰنِ" -> root: "ر ح م", root_translit: "R-H-M", lemma: "رَحْمَٰن"
      - "الْعَالَمِينَ" -> root: "ع ل م", root_translit: "A-L-M", lemma: "عَالَم"
      - "يَتَسَآءَلُونَ" -> root: "س أ ل", root_translit: "S-A-L", lemma: "تَسَاءَلَ"
      
      RULES:
      1. Every Noun and Verb MUST have a 3-letter root.
      2. Only particles (بِ, لِ, فِي, وَ) get root: null.
      3. Return ONLY a raw JSON array of objects with: db_id, root, root_translit, lemma.`,
      messages: [{ role: "user", content: JSON.stringify(promptData) }],
    });

    const content = msg.content[0].type === "text" ? msg.content[0].text : "";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array found");
    const results = JSON.parse(jsonMatch[0]);

    for (const res of results) {
      await supabase
        .from("quran_words")
        .update({
          root_arabic: res.root,
          root_transliteration: res.root_translit,
          lemma_clean: res.lemma,
        })
        .eq("id", res.db_id);

      console.log(
        `✅ ID ${res.db_id}: [${res.root || "Particle"}] for "${words.find((w) => w.id === res.db_id)?.text_arabic}"`,
      );
    }
  } catch (err) {
    console.error("Batch Error:", err);
  }
}

enrichQuranData();
