<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const { t } = useI18n()
const auth = useAuthStore()
const router = useRouter()

const email = ref('')
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
    const trimmed = email.value.trim()
    await auth.signUp(trimmed, password.value)
    await router.replace({
      name: 'confirm-email',
      query: { email: trimmed, reason: 'signup' },
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
      <h1 class="auth-card__title">{{ t('auth.signUp.title') }}</h1>

      <form
        class="auth-form"
        method="post"
        action="/sign-up"
        @submit.prevent="onSubmit"
      >
        <label class="auth-field" for="sign-up-email">
          <span class="auth-field__label">{{ t('auth.fields.email') }}</span>
          <UiInput
            id="sign-up-email"
            v-model="email"
            name="username"
            type="email"
            autocomplete="username"
            inputmode="email"
            spellcheck="false"
            required
          />
        </label>
        <label class="auth-field" for="sign-up-password">
          <span class="auth-field__label">{{ t('auth.fields.password') }}</span>
          <UiInput
            id="sign-up-password"
            v-model="password"
            name="password"
            type="password"
            autocomplete="new-password"
            required
          />
        </label>
        <label class="auth-field" for="sign-up-password-confirm">
          <span class="auth-field__label">{{
            t('auth.fields.confirmPassword')
          }}</span>
          <UiInput
            id="sign-up-password-confirm"
            v-model="confirm"
            name="password-confirm"
            type="password"
            autocomplete="new-password"
            required
          />
        </label>

        <p v-if="error" class="auth-error" role="alert">{{ error }}</p>

        <div class="auth-actions">
          <UiButton class="ui-btn-block" type="submit" :disabled="pending">
            {{ t('auth.signUp.submit') }}
          </UiButton>
        </div>
      </form>

      <p class="auth-links">
        <RouterLink :to="{ name: 'sign-in' }">
          {{ t('auth.signUp.toSignIn') }}
        </RouterLink>
      </p>
    </div>
  </AuthShell>
</template>
