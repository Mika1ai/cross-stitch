import type { ProgressDiff } from './progress-local'

type Translate = (key: string, values?: Record<string, unknown>) => string

/** Собирает описание расхождений + финальный вопрос для confirm/conflict. */
export function formatSyncDiffMessage(
  t: Translate,
  diffs: ProgressDiff[],
  askKey: string,
) {
  const lines: string[] = []

  if (diffs.length === 0) {
    lines.push(t(askKey))
    return lines.join('\n')
  }

  if (diffs.length === 1) {
    lines.push(...formatOneDiff(t, diffs[0]!))
  } else {
    lines.push(t('sync.diffSeveral', { count: diffs.length }))
    for (const diff of diffs) {
      const inline = formatOneDiffInline(t, diff)
      if (inline) lines.push(`• ${inline}`)
    }
  }

  lines.push(t(askKey))
  return lines.join('\n')
}

function formatOneDiff(t: Translate, diff: ProgressDiff) {
  const lines: string[] = []
  if (diff.doneDiffers) {
    lines.push(
      t('sync.diffStitches', {
        local: diff.localDoneCount,
        server: diff.remoteDoneCount,
      }),
    )
  }
  if (diff.settingsDiffer) {
    lines.push(t('sync.diffSettings'))
  }
  return lines
}

function formatOneDiffInline(t: Translate, diff: ProgressDiff) {
  const parts: string[] = []
  if (diff.doneDiffers) {
    parts.push(
      t('sync.diffStitchesInline', {
        local: diff.localDoneCount,
        server: diff.remoteDoneCount,
      }),
    )
  }
  if (diff.settingsDiffer) {
    parts.push(t('sync.diffSettingsInline'))
  }
  return parts.join('; ')
}
