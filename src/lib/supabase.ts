import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.warn(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.',
  )
}

export const supabase = createClient(url ?? '', anonKey ?? '')

export function schemePreviewUrl(previewPath: string | null | undefined) {
  if (!previewPath) return null
  const { data } = supabase.storage
    .from('scheme-previews')
    .getPublicUrl(previewPath)
  return data.publicUrl
}
