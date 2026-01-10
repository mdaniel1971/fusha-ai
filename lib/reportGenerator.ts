import { supabase } from './supabase';
import { LearningObservation, ObservationType, SkillCategory } from './observationLogger';

// Report interfaces
export interface SkillDetail {
  name: string;
  frequency: number;
  examples: string[];
  confidence?: string;
}

export interface SkillBreakdown {
  category: string;
  skills: SkillDetail[];
}

export interface PatternInsight {
  pattern: string;
  frequency: number;
  impact: 'high' | 'medium' | 'low';
  explanation: string;
}

export interface Breakthrough {
  moment: string;
  timestamp: Date;
  context: string;
}

export interface StudyRecommendation {
  priority: number;
  skillArea: string;
  specificFocus: string;
  practicePrompt: string;
  estimatedTime: string;
}

export interface SessionSummary {
  timeSpent: number;
  totalInteractions: number;
  overallScore: number;
}

export interface LearningReport {
  sessionSummary: SessionSummary;
  strengths: SkillBreakdown[];
  weaknesses: SkillBreakdown[];
  patterns: PatternInsight[];
  breakthroughs: Breakthrough[];
  recommendations: StudyRecommendation[];
  generatedAt: Date;
}

// Category display names
const CATEGORY_NAMES: Record<SkillCategory, string> = {
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  pronunciation: 'Pronunciation',
  comprehension: 'Comprehension',
  fluency: 'Fluency',
};

// Impact weights for different skill categories
const CATEGORY_IMPACT: Record<SkillCategory, number> = {
  grammar: 5,        // Grammar affects everything
  vocabulary: 4,     // Core building blocks
  comprehension: 3,  // Understanding is key
  fluency: 2,        // Polish and flow
  pronunciation: 1,  // Important but less foundational
};

// Fetch observations for a session
// Note: learning_observations table doesn't exist - returns empty
// Future: consider integrating grammar_observations for reports
async function fetchSessionObservations(sessionId: string): Promise<LearningObservation[]> {
  // Table doesn't exist - return empty array
  // Grammar observations are now stored in grammar_observations table
  console.log('fetchSessionObservations called for session:', sessionId, '(table not available)');
  return [];
}

// Fetch session details for time calculation
async function fetchSessionDetails(sessionId: string): Promise<{ startedAt: Date | null; endedAt: Date | null }> {
  const { data, error } = await supabase
    .from('sessions')
    .select('started_at, ended_at')
    .eq('id', sessionId)
    .single();

  if (error || !data) {
    return { startedAt: null, endedAt: null };
  }

  return {
    startedAt: data.started_at ? new Date(data.started_at) : null,
    endedAt: data.ended_at ? new Date(data.ended_at) : null,
  };
}

// Group observations by category
function aggregateByCategory(
  observations: LearningObservation[],
  filterType: ObservationType
): SkillBreakdown[] {
  const categoryMap = new Map<SkillCategory, Map<string, { count: number; examples: string[] }>>();

  // Filter and group
  const filtered = observations.filter(obs => obs.observation_type === filterType);

  for (const obs of filtered) {
    const category = obs.skill_category;
    if (!categoryMap.has(category)) {
      categoryMap.set(category, new Map());
    }

    const skillMap = categoryMap.get(category)!;
    const skill = obs.specific_skill;

    if (!skillMap.has(skill)) {
      skillMap.set(skill, { count: 0, examples: [] });
    }

    const entry = skillMap.get(skill)!;
    entry.count++;
    if (obs.arabic_example && entry.examples.length < 3) {
      entry.examples.push(obs.arabic_example);
    } else if (obs.observed_behavior && entry.examples.length < 3) {
      entry.examples.push(obs.observed_behavior);
    }
  }

  // Convert to array format
  const result: SkillBreakdown[] = [];

  Array.from(categoryMap.entries()).forEach(([category, skillMap]) => {
    const skills: SkillDetail[] = [];

    Array.from(skillMap.entries()).forEach(([name, data]) => {
      skills.push({
        name,
        frequency: data.count,
        examples: data.examples,
      });
    });

    // Sort skills by frequency
    skills.sort((a, b) => b.frequency - a.frequency);

    result.push({
      category: CATEGORY_NAMES[category],
      skills,
    });
  });

  // Sort categories by total skill count
  result.sort((a, b) => {
    const aTotal = a.skills.reduce((sum, s) => sum + s.frequency, 0);
    const bTotal = b.skills.reduce((sum, s) => sum + s.frequency, 0);
    return bTotal - aTotal;
  });

  return result;
}

// Detect recurring patterns
function detectPatterns(observations: LearningObservation[]): PatternInsight[] {
  const patterns: PatternInsight[] = [];
  const patternObs = observations.filter(obs => obs.observation_type === 'pattern');

  // Group by skill
  const skillCounts = new Map<string, { count: number; category: SkillCategory; description: string }>();

  for (const obs of patternObs) {
    const key = obs.specific_skill;
    if (!skillCounts.has(key)) {
      skillCounts.set(key, {
        count: 0,
        category: obs.skill_category,
        description: obs.observed_behavior,
      });
    }
    skillCounts.get(key)!.count++;
  }

  // Also detect patterns from repeated weaknesses
  const weaknessCounts = new Map<string, { count: number; category: SkillCategory; description: string }>();
  const weaknesses = observations.filter(obs => obs.observation_type === 'weakness');

  for (const obs of weaknesses) {
    const key = obs.specific_skill;
    if (!weaknessCounts.has(key)) {
      weaknessCounts.set(key, {
        count: 0,
        category: obs.skill_category,
        description: obs.observed_behavior,
      });
    }
    weaknessCounts.get(key)!.count++;
  }

  // Convert explicit patterns
  Array.from(skillCounts.entries()).forEach(([skill, data]) => {
    const categoryImpact = CATEGORY_IMPACT[data.category];
    const impact: 'high' | 'medium' | 'low' = categoryImpact >= 4 ? 'high' :
                   categoryImpact >= 2 ? 'medium' : 'low';

    patterns.push({
      pattern: skill,
      frequency: data.count,
      impact,
      explanation: data.description,
    });
  });

  // Add repeated weaknesses as patterns (if 2+ occurrences)
  Array.from(weaknessCounts.entries()).forEach(([skill, data]) => {
    if (data.count >= 2 && !skillCounts.has(skill)) {
      const categoryImpact = CATEGORY_IMPACT[data.category];
      const impact: 'high' | 'medium' | 'low' = categoryImpact >= 4 ? 'high' :
                     categoryImpact >= 2 ? 'medium' : 'low';

      patterns.push({
        pattern: `Recurring: ${skill}`,
        frequency: data.count,
        impact,
        explanation: `This issue appeared ${data.count} times: ${data.description}`,
      });
    }
  });

  // Sort by impact and frequency
  const impactOrder = { high: 3, medium: 2, low: 1 };
  patterns.sort((a, b) => {
    const impactDiff = impactOrder[b.impact] - impactOrder[a.impact];
    return impactDiff !== 0 ? impactDiff : b.frequency - a.frequency;
  });

  return patterns.slice(0, 5); // Top 5 patterns
}

// Extract breakthrough moments
function extractBreakthroughs(observations: LearningObservation[]): Breakthrough[] {
  return observations
    .filter(obs => obs.observation_type === 'breakthrough')
    .map(obs => ({
      moment: obs.specific_skill,
      timestamp: new Date(),
      context: obs.observed_behavior,
    }));
}

// Calculate overall score
function calculateScore(observations: LearningObservation[]): number {
  if (observations.length === 0) return 0;

  let score = 50; // Base score

  for (const obs of observations) {
    const categoryWeight = CATEGORY_IMPACT[obs.skill_category] || 1;

    switch (obs.observation_type) {
      case 'strength':
        score += 3 * categoryWeight;
        break;
      case 'weakness':
        score -= 2 * categoryWeight;
        break;
      case 'breakthrough':
        score += 5 * categoryWeight;
        break;
      case 'pattern':
        // Patterns are neutral - they're informational
        break;
    }
  }

  // Normalize to 0-100
  return Math.max(0, Math.min(100, score));
}

// Generate prioritized recommendations
function prioritizeRecommendations(
  weaknesses: SkillBreakdown[],
  patterns: PatternInsight[]
): StudyRecommendation[] {
  const recommendations: StudyRecommendation[] = [];
  let priority = 1;

  // First, address high-impact patterns
  for (const pattern of patterns) {
    if (pattern.impact === 'high' && priority <= 5) {
      recommendations.push({
        priority: priority++,
        skillArea: pattern.pattern.replace('Recurring: ', ''),
        specificFocus: pattern.explanation,
        practicePrompt: generatePracticePrompt(pattern.pattern, pattern.explanation),
        estimatedTime: '10-15 minutes',
      });
    }
  }

  // Then, most frequent weaknesses by category
  for (const category of weaknesses) {
    for (const skill of category.skills) {
      if (priority > 5) break;
      if (skill.frequency >= 1) {
        recommendations.push({
          priority: priority++,
          skillArea: `${category.category}: ${skill.name}`,
          specificFocus: skill.examples[0] || skill.name,
          practicePrompt: generatePracticePrompt(skill.name, skill.examples[0] || ''),
          estimatedTime: skill.frequency > 2 ? '15-20 minutes' : '5-10 minutes',
        });
      }
    }
    if (priority > 5) break;
  }

  return recommendations;
}

// Generate practice prompts
function generatePracticePrompt(skill: string, example: string): string {
  const skillLower = skill.toLowerCase();

  if (skillLower.includes('preposition') || skillLower.includes('في') || skillLower.includes('على')) {
    return `Practice using في (in), على (on), and إلى (to) in 5 different location sentences.`;
  }

  if (skillLower.includes('verb') || skillLower.includes('conjugat')) {
    return `Conjugate 3 verbs in past, present, and command forms. Focus on the patterns.`;
  }

  if (skillLower.includes('case') || skillLower.includes('marfu') || skillLower.includes('mansub')) {
    return `Identify the grammatical case of nouns in 5 Quranic verses and explain why.`;
  }

  if (skillLower.includes('root')) {
    return `Find 5 words that share the same three-letter root and compare their meanings.`;
  }

  if (skillLower.includes('word order') || skillLower.includes('adjective')) {
    return `Practice noun-adjective pairs: write 5 phrases with the adjective after the noun.`;
  }

  // Generic prompt
  return `Practice this skill with 3 different examples: ${example || skill}`;
}

// Main report generation function
export async function generateReport(sessionId: string): Promise<LearningReport | null> {
  try {
    // Fetch data in parallel
    const [observations, sessionDetails] = await Promise.all([
      fetchSessionObservations(sessionId),
      fetchSessionDetails(sessionId),
    ]);

    if (observations.length === 0) {
      // Return a minimal report if no observations
      return {
        sessionSummary: {
          timeSpent: 0,
          totalInteractions: 0,
          overallScore: 50,
        },
        strengths: [],
        weaknesses: [],
        patterns: [],
        breakthroughs: [],
        recommendations: [],
        generatedAt: new Date(),
      };
    }

    // Calculate time spent
    let timeSpent = 0;
    if (sessionDetails.startedAt) {
      const endTime = sessionDetails.endedAt || new Date();
      timeSpent = Math.round((endTime.getTime() - sessionDetails.startedAt.getTime()) / 60000);
    }

    // Count interactions (each observation roughly = 1 exchange)
    const totalInteractions = Math.ceil(observations.length / 2);

    // Generate report components
    const strengths = aggregateByCategory(observations, 'strength');
    const weaknesses = aggregateByCategory(observations, 'weakness');
    const patterns = detectPatterns(observations);
    const breakthroughs = extractBreakthroughs(observations);
    const overallScore = calculateScore(observations);
    const recommendations = prioritizeRecommendations(weaknesses, patterns);

    return {
      sessionSummary: {
        timeSpent,
        totalInteractions,
        overallScore,
      },
      strengths,
      weaknesses,
      patterns,
      breakthroughs,
      recommendations,
      generatedAt: new Date(),
    };
  } catch (error) {
    console.error('Failed to generate report:', error);
    return null;
  }
}

// Get a motivational message based on score
export function getMotivationalMessage(score: number): string {
  if (score >= 90) {
    return "Outstanding! You're mastering Arabic at an incredible pace!";
  } else if (score >= 75) {
    return "Excellent progress! Your dedication is really showing!";
  } else if (score >= 60) {
    return "Great work! You're building a strong foundation!";
  } else if (score >= 40) {
    return "Good effort! Every challenge is a learning opportunity!";
  } else {
    return "Keep going! The best learners embrace the struggle!";
  }
}
