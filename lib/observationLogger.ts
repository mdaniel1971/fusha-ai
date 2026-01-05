import { supabase } from './supabase';

// Type definitions
export type ObservationType = 'strength' | 'weakness' | 'pattern' | 'breakthrough';
export type SkillCategory = 'vocabulary' | 'grammar' | 'pronunciation' | 'comprehension' | 'fluency';
export type ConfidenceLevel = 'emerging' | 'developing' | 'strong' | 'mastered';

export interface LearningObservation {
  session_id: string;
  user_id?: string;
  ayah_id?: number;
  vocabulary_id?: number;
  observation_type: ObservationType;
  skill_category: SkillCategory;
  specific_skill: string;
  student_response?: string;
  observed_behavior: string;
  teaching_note?: string;
  confidence_level?: ConfidenceLevel;
  context?: string;
  arabic_example?: string;
}

// Regex to extract observations from Claude's response
const OBS_REGEX = /\[OBS:(strength|weakness|pattern|breakthrough)\|(vocabulary|grammar|pronunciation|comprehension|fluency)\|([^|]+)\|([^\]]+)\]/g;

// Extract Arabic text from a string
export function extractArabic(text: string): string | null {
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g;
  const matches = text.match(arabicRegex);
  return matches ? matches.join(' ') : null;
}

// Parse observation tags from Claude's response
export function parseObservations(text: string, sessionId: string, userId?: string): {
  observations: LearningObservation[];
  cleanedText: string;
} {
  const observations: LearningObservation[] = [];
  let match;

  // Reset regex state
  OBS_REGEX.lastIndex = 0;

  while ((match = OBS_REGEX.exec(text)) !== null) {
    const [, observationType, skillCategory, specificSkill, description] = match;

    observations.push({
      session_id: sessionId,
      user_id: userId,
      observation_type: observationType as ObservationType,
      skill_category: skillCategory as SkillCategory,
      specific_skill: specificSkill.trim(),
      observed_behavior: description.trim(),
      arabic_example: extractArabic(description) || undefined,
    });
  }

  // Remove all OBS tags from the text
  const cleanedText = text.replace(OBS_REGEX, '').trim();

  return { observations, cleanedText };
}

// Log a single observation to the database
export async function logObservation(observation: LearningObservation): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('learning_observations')
      .insert(observation);

    if (error) {
      console.error('Failed to log observation:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Error logging observation:', err);
    return { success: false, error: String(err) };
  }
}

// Log multiple observations in a batch
export async function logMultipleObservations(
  observations: LearningObservation[]
): Promise<{ success: boolean; logged: number; errors: string[] }> {
  if (observations.length === 0) {
    return { success: true, logged: 0, errors: [] };
  }

  const errors: string[] = [];
  let logged = 0;

  try {
    const { error, data } = await supabase
      .from('learning_observations')
      .insert(observations)
      .select();

    if (error) {
      console.error('Failed to log observations:', error);
      errors.push(error.message);
    } else {
      logged = data?.length || observations.length;
    }
  } catch (err) {
    console.error('Error logging observations:', err);
    errors.push(String(err));
  }

  return {
    success: errors.length === 0,
    logged,
    errors,
  };
}

// Get observations for a session
export async function getSessionObservations(sessionId: string): Promise<LearningObservation[]> {
  const { data, error } = await supabase
    .from('learning_observations')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch observations:', error);
    return [];
  }

  return data || [];
}

// Get observations for a user across all sessions
export async function getUserObservations(userId: string, limit = 100): Promise<LearningObservation[]> {
  const { data, error } = await supabase
    .from('learning_observations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch user observations:', error);
    return [];
  }

  return data || [];
}

// Get observation counts by type for a session
export async function getObservationStats(sessionId: string): Promise<{
  strengths: number;
  weaknesses: number;
  patterns: number;
  breakthroughs: number;
  total: number;
}> {
  const observations = await getSessionObservations(sessionId);

  const stats = {
    strengths: 0,
    weaknesses: 0,
    patterns: 0,
    breakthroughs: 0,
    total: observations.length,
  };

  for (const obs of observations) {
    switch (obs.observation_type) {
      case 'strength':
        stats.strengths++;
        break;
      case 'weakness':
        stats.weaknesses++;
        break;
      case 'pattern':
        stats.patterns++;
        break;
      case 'breakthrough':
        stats.breakthroughs++;
        break;
    }
  }

  return stats;
}
