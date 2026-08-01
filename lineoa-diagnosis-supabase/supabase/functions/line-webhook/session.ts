import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

export interface Session {
  user_id: string;
  state: string; // 'IDLE' | 'QUIZ' | 'DONE'
  quiz_index: number; // 目前問到第幾題（0-based）
  quiz_answers: Record<number, number | null>; // { questionId: value|null }
}

export async function getSession(userId: string): Promise<Session | null> {
  const { data, error } = await supabase.from('line_sessions').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data as Session | null;
}

export async function createSession(userId: string): Promise<Session> {
  const { data, error } = await supabase
    .from('line_sessions')
    .insert({ user_id: userId, state: 'IDLE', quiz_index: 0, quiz_answers: {} })
    .select()
    .single();
  if (error) throw error;
  return data as Session;
}

export async function updateSession(userId: string, patch: Partial<Session>): Promise<Session> {
  const { data, error } = await supabase
    .from('line_sessions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data as Session;
}

export async function saveDiagnosisResult(params: {
  userId: string;
  worstCategory: string | null;
  overallPct: number | null;
  answers: Record<number, number | null>;
}) {
  const { error } = await supabase.from('line_diagnosis_results').insert({
    user_id: params.userId,
    primary_category: params.worstCategory,
    selected_tags: null,
    answers: { overall_pct: params.overallPct, quiz_answers: params.answers },
  });
  if (error) throw error;
}
