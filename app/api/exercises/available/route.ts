import { getAvailableExercises } from '@/lib/exercise-vocab';

export async function GET() {
  try {
    const exercises = await getAvailableExercises();

    // Format exercise names for display
    const formatted = exercises.map(ex => ({
      exercise_name: ex.exercise_name,
      exercise_order: ex.exercise_order,
      display_label: ex.exercise_name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
    }));

    return new Response(
      JSON.stringify({ success: true, exercises: formatted }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching exercises:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch exercises' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
