<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const { t } = useI18n()
const auth = useAuthStore()
const router = useRouter()

const email = ref('')
const error = ref('')
const pending = ref(false)

async function onSubmit() {
  error.value = ''
  pending.value = true
  try {
    const trimmed = email.value.trim()
    await auth.resetPasswordForEmail(trimmed)
    await router.replace({
      name: 'confirm-email',
      query: { email: trimmed, reason: 'recovery' },
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('auth.errors.generic')
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <AuthShell>
    <div class="auth-card">
      <p class="auth-card__brand">{{ t('app.title') }}</p>
      <h1 class="auth-card__title">{{ t('auth.forgot.title') }}</h1>
      <p class="auth-card__lead">{{ t('auth.forgot.lead') }}</p>

      <form class="auth-form" @submit.prevent="onSubmit">
        <label class="auth-field">
          <span class="auth-field__label">{{ t('auth.fields.email') }}</span>
          <UiInput
            v-model="email"
            type="email"
            autocomplete="email"
            inputmode="email"
            required
          />
        </label>

        <p v-if="error" class="auth-error" role="alert">{{ error }}</p>

        <div class="auth-actions">
          <UiButton class="ui-btn-block" type="submit" :disabled="pending">
            {{ t('auth.forgot.submit') }}
          </UiButton>
        </div>
      </form>

      <p class="auth-links">
        <RouterLink :to="{ name: 'sign-in' }">
          {{ t('auth.forgot.back') }}
        </RouterLink>
      </p>
    </div>
  </AuthShell>
</template>
