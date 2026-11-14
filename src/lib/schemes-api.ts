import { supabase } from './supabase'
import {
  defaultProgressSettings,
  mergeProgressSettings,
} from './progress-settings'
import type {
  SchemeListItem,
  SchemeRow,
  UserProgressRow,
  UserProgressSettings,
} from '../types/database'

export async function listSchemesWithProgress(userId: string) {
  const { data: schemes, error: schemesError } = await supabase
    .from('schemes')
    .select('id, title, preview_path, width, height')
    .order('title', { ascending: true })

  if (schemesError) throw schemesError

  const { data: progress, error: progressError } = await supabase
    .from('user_progress')
    .select('scheme_id, done')
    .eq('user_id', userId)

  if (progressError) throw progressError

  const doneByScheme = new Map<string, number>()
  for (const row of progress ?? []) {
    const done = Array.isArray(row.done) ? row.done.length : 0
    doneByScheme.set(row.scheme_id, done)
  }

  return (schemes as SchemeListItem[] | null)?.map((scheme) => {
    const total = scheme.width * scheme.height
    const done = doneByScheme.get(scheme.id) ?? 0
    const percent = total === 0 ? 0 : Math.round((done / total) * 100)
    return { ...scheme, done, total, percent }
  }) ?? []
}

export async function fetchScheme(schemeId: string) {
  const { data, error } = await supabase
    .from('schemes')
    .select('*')
    .eq('id', schemeId)
    .maybeSingle()

  if (error) throw error
  return data as SchemeRow | null
}

export async function ensureUserProgress(
  userId: string,
  schemeId: string,
): Promise<UserProgressRow> {
  const { data: existing, error: selectError } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('scheme_id', schemeId)
    .maybeSingle()

  if (selectError) throw selectError
  if (existing) {
    return {
      ...(existing as UserProgressRow),
      settings: mergeProgressSettings(
        (existing as UserProgressRow).settings,
      ),
      done: Array.isArray((existing as UserProgressRow).done)
        ? (existing as UserProgressRow).done
        : [],
    }
  }

  const settings = defaultProgressSettings()
  const { data: created, error: insertError } = await supabase
    .from('user_progress')
    .insert({
      user_id: userId,
      scheme_id: schemeId,
      done: [],
      settings,
      last_done_index: null,
    })
    .select('*')
    .single()

  if (insertError) throw insertError
  return created as UserProgressRow
}

export async function saveUserProgress(options: {
  progressId: string
  done: number[]
  settings: UserProgressSettings
  lastDoneIndex: number | null
}) {
  const { error } = await supabase
    .from('user_progress')
    .update({
      done: options.done,
      settings: options.settings,
      last_done_index: options.lastDoneIndex,
      updated_at: new Date().toISOString(),
    })
    .eq('id', options.progressId)

  if (error) throw error
}
