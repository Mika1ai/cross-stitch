<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const error = ref('')

onMounted(async () => {
  try {
    const url = new URL(window.location.href)
    const code = url.searchParams.get('code')
    const type = url.searchParams.get('type')

    if (code) {
      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code)
      if (exchangeError) throw exchangeError
    } else {
      // Hash tokens (implicit) — client parses on getSession
      await auth.init()
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      if (!data.session) {
        throw new Error(t('auth.errors.callbackNoSession'))
      }
    }

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const hashType = hash.get('type') ?? type
    const isRecovery = hashType === 'recovery'

    await router.replace({
      name: isRecovery ? 'reset-password' : 'gallery',
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('auth.errors.generic')
  }
})
</script>

<template>
  <AuthShell>
    <div class="auth-card">
      <p class="auth-card__brand">{{ t('app.title') }}</p>
      <h1 class="auth-card__title">{{ t('auth.callback.title') }}</h1>
      <p v-if="!error" class="auth-card__lead">{{ t('auth.callback.working') }}</p>
      <p v-else class="auth-error" role="alert">{{ error }}</p>
      <p v-if="error" class="auth-links">
        <RouterLink :to="{ name: 'sign-in' }">
          {{ t('auth.callback.toSignIn') }}
        </RouterLink>
      </p>
    </div>
  </AuthShell>
</template>
