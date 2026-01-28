import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function syncMustafaRefined() {
  const content = fs.readFileSync("docs/quran-morphology.txt", "utf-8");
  const lines = content.split("\n");

  console.log("⏳ Fetching Verse Mappings (Global IDs)...");
  const { data: verses } = await supabase
    .from("verses")
    .select("id, surah_id, verse_number");

  console.log("🚀 Syncing Roots & Lemmas (Mustafa v0.5)...");

  for (const line of lines) {
    if (!line.trim() || line.startsWith("#")) continue;

    const parts = line.split("\t");
    if (parts.length < 4) continue;

    const loc = parts[0].split(":");
    const s = parseInt(loc[0]);
    const v = parseInt(loc[1]);
    const w = parseInt(loc[2]);

    // Focus on Fatiha (1) and Juz Amma (78-114)
    if (s !== 1 && (s < 78 || s > 114)) continue;

    const rootMatch = parts[3].match(/ROOT:([^|]+)/);
    const lemMatch = parts[3].match(/LEM:([^|]+)/);

    if (rootMatch || lemMatch) {
      const globalVerseId = verses?.find(
        (vr) => vr.surah_id === s && vr.verse_number === v,
      )?.id;
      if (!globalVerseId) continue;

      const updateData: any = {};
      if (rootMatch) {
        // Formats root with spaces (e.g. "سمو" -> "س م و")
        updateData.root_arabic = rootMatch[1].split("").join(" ");
      }
      if (lemMatch) {
        updateData.lemma_clean = lemMatch[1];
      }

      const { error } = await supabase
        .from("quran_words")
        .update(updateData)
        .match({
          surah_id: s,
          verse_id: globalVerseId,
          word_position: w,
        });

      if (!error) {
        console.log(
          `✅ Updated ${s}:${v}:${w} -> ${updateData.root_arabic || "N/A"}`,
        );
      }
    }
  }
  console.log("🏁 Sync Complete!");
}

syncMustafaRefined();
