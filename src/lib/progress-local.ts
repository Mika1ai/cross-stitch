import { mergeProgressSettings } from './progress-settings'
import type { UserProgressSettings } from '../types/database'

export type ProgressContent = {
  done: number[]
  settings: UserProgressSettings
  lastDoneIndex: number | null
}

export type ProgressDiff = {
  localDoneCount: number
  remoteDoneCount: number
  doneDiffers: boolean
  settingsDiffer: boolean
}

export type LocalProgressSnapshot = ProgressContent & {
  updatedAt: string
  dirty: boolean
  lastSyncedAt: string | null
  /** Последний успешно сверенный с сервером снимок (для описаний leave / sign-out). */
  lastSynced: ProgressContent | null
}

export function progressContentOf(
  snapshot: ProgressContent,
): ProgressContent {
  return {
    done: snapshot.done,
    settings: snapshot.settings,
    lastDoneIndex: snapshot.lastDoneIndex,
  }
}

export function diffProgress(
  local: ProgressContent,
  remote: ProgressContent,
): ProgressDiff {
  const localDone = [...local.done].sort((a, b) => a - b)
  const remoteDone = [...remote.done].sort((a, b) => a - b)
  const doneDiffers =
    JSON.stringify(localDone) !== JSON.stringify(remoteDone) ||
    local.lastDoneIndex !== remote.lastDoneIndex
  const settingsDiffer =
    JSON.stringify(local.settings) !== JSON.stringify(remote.settings)
  return {
    localDoneCount: local.done.length,
    remoteDoneCount: remote.done.length,
    doneDiffers,
    settingsDiffer,
  }
}

export function progressLocalKey(userId: string, schemeId: string) {
  return `cross-stitch.progress.${userId}.${schemeId}`
}

export function progressFingerprint(snapshot: ProgressContent) {
  const done = [...snapshot.done].sort((a, b) => a - b)
  return JSON.stringify({
    done,
    settings: snapshot.settings,
    lastDoneIndex: snapshot.lastDoneIndex,
  })
}

function readProgressContent(
  value: Partial<ProgressContent> | null | undefined,
): ProgressContent | null {
  if (!value || typeof value !== 'object') return null
  return {
    done: Array.isArray(value.done)
      ? value.done.filter((n): n is number => typeof n === 'number')
      : [],
    settings: mergeProgressSettings(value.settings),
    lastDoneIndex:
      typeof value.lastDoneIndex === 'number' ? value.lastDoneIndex : null,
  }
}

export function readLocalProgress(
  userId: string,
  schemeId: string,
): LocalProgressSnapshot | null {
  try {
    const raw = localStorage.getItem(progressLocalKey(userId, schemeId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LocalProgressSnapshot>
    if (!parsed || typeof parsed !== 'object') return null
    const content = readProgressContent(parsed)
    if (!content) return null
    return {
      ...content,
      updatedAt:
        typeof parsed.updatedAt === 'string'
          ? parsed.updatedAt
          : new Date().toISOString(),
      dirty: Boolean(parsed.dirty),
      lastSyncedAt:
        typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : null,
      lastSynced: readProgressContent(
        (parsed as { lastSynced?: Partial<ProgressContent> }).lastSynced,
      ),
    }
  } catch {
    return null
  }
}

export function writeLocalProgress(
  userId: string,
  schemeId: string,
  snapshot: LocalProgressSnapshot,
) {
  localStorage.setItem(
    progressLocalKey(userId, schemeId),
    JSON.stringify(snapshot),
  )
}

export function listDirtyProgress(userId: string) {
  const prefix = `cross-stitch.progress.${userId}.`
  const out: { schemeId: string; snapshot: LocalProgressSnapshot }[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith(prefix)) continue
    const schemeId = key.slice(prefix.length)
    if (!schemeId) continue
    const snapshot = readLocalProgress(userId, schemeId)
    if (snapshot?.dirty) out.push({ schemeId, snapshot })
  }
  return out
}

export function hasAnyDirtyProgress(userId: string) {
  return listDirtyProgress(userId).length > 0
}
