<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const { t } = useI18n()
const auth = useAuthStore()
const router = useRouter()

const password = ref('')
const confirm = ref('')
const error = ref('')
const pending = ref(false)

async function onSubmit() {
  error.value = ''
  if (password.value !== confirm.value) {
    error.value = t('auth.errors.passwordMismatch')
    return
  }
  if (password.value.length < 6) {
    error.value = t('auth.errors.passwordShort')
    return
  }

  pending.value = true
  try {
    await auth.updatePassword(password.value)
    await router.replace({ name: 'gallery' })
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
      <h1 class="auth-card__title">{{ t('auth.reset.title') }}</h1>
      <p class="auth-card__lead">{{ t('auth.reset.lead') }}</p>

      <form class="auth-form" @submit.prevent="onSubmit">
        <label class="auth-field">
          <span class="auth-field__label">{{
            t('auth.fields.newPassword')
          }}</span>
          <UiInput
            v-model="password"
            type="password"
            autocomplete="new-password"
            required
          />
        </label>
        <label class="auth-field">
          <span class="auth-field__label">{{
            t('auth.fields.confirmPassword')
          }}</span>
          <UiInput
            v-model="confirm"
            type="password"
            autocomplete="new-password"
            required
          />
        </label>

        <p v-if="error" class="auth-error" role="alert">{{ error }}</p>

        <div class="auth-actions">
          <UiButton class="ui-btn-block" type="submit" :disabled="pending">
            {{ t('auth.reset.submit') }}
          </UiButton>
        </div>
      </form>
    </div>
  </AuthShell>
</template>
