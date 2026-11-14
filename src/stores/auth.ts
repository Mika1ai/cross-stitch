import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Session, User } from '@supabase/supabase-js'
import { authCallbackUrl } from '../lib/auth-redirect'
import { supabase } from '../lib/supabase'
import { useUserSettingsStore } from './userSettings'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const ready = ref(false)

  let unsubscribe: (() => void) | null = null

  function applySession(next: Session | null) {
    session.value = next
    user.value = next?.user ?? null
  }

  async function syncUserSettings(next: Session | null) {
    const settings = useUserSettingsStore()
    if (next?.user) await settings.loadForUser(next.user.id)
    else settings.resetToDefaults()
  }

  async function init() {
    if (unsubscribe) return

    const { data } = await supabase.auth.getSession()
    applySession(data.session)
    await syncUserSettings(data.session)

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, next) => {
        applySession(next)
        void syncUserSettings(next)
      },
    )
    unsubscribe = () => listener.subscription.unsubscribe()
    ready.value = true
  }

  async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: authCallbackUrl() },
    })
    if (error) throw error
    return data
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    applySession(data.session)
    return data
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    applySession(null)
  }

  async function resetPasswordForEmail(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authCallbackUrl(),
    })
    if (error) throw error
  }

  async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  }

  async function resendSignup(email: string) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: authCallbackUrl() },
    })
    if (error) throw error
  }

  return {
    user,
    session,
    ready,
    init,
    signUp,
    signIn,
    signOut,
    resetPasswordForEmail,
    updatePassword,
    resendSignup,
  }
})
