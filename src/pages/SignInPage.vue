<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const { t } = useI18n()
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const error = ref('')
const pending = ref(false)

/** Подсказка Chrome/Edge сохранить логин после SPA-submit. */
async function offerStoreCredentials(userEmail: string, userPassword: string) {
  const PasswordCred = (
    window as Window & {
      PasswordCredential?: new (data: {
        id: string
        name?: string
        password: string
      }) => Credential
    }
  ).PasswordCredential
  if (!PasswordCred || !navigator.credentials?.store) return
  try {
    await navigator.credentials.store(
      new PasswordCred({
        id: userEmail,
        name: userEmail,
        password: userPassword,
      }),
    )
  } catch {
    // Браузер мог отказать — обычный save-prompt по форме всё ещё возможен.
  }
}

async function onSubmit() {
  error.value = ''
  pending.value = true
  const userEmail = email.value.trim()
  const userPassword = password.value
  try {
    await auth.signIn(userEmail, userPassword)
    await offerStoreCredentials(userEmail, userPassword)
    const redirect = typeof route.query.redirect === 'string'
      ? route.query.redirect
      : '/gallery'
    await router.replace(redirect)
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
      <h1 class="auth-card__title">{{ t('auth.signIn.title') }}</h1>

      <form
        class="auth-form"
        method="post"
        action="/sign-in"
        @submit.prevent="onSubmit"
      >
        <label class="auth-field" for="sign-in-email">
          <span class="auth-field__label">{{ t('auth.fields.email') }}</span>
          <UiInput
            id="sign-in-email"
            v-model="email"
            name="username"
            type="email"
            autocomplete="username"
            inputmode="email"
            spellcheck="false"
            required
          />
        </label>
        <label class="auth-field" for="sign-in-password">
          <span class="auth-field__label">{{ t('auth.fields.password') }}</span>
          <UiInput
            id="sign-in-password"
            v-model="password"
            name="password"
            type="password"
            autocomplete="current-password"
            required
          />
        </label>

        <p v-if="error" class="auth-error" role="alert">{{ error }}</p>

        <div class="auth-actions">
          <UiButton class="ui-btn-block" type="submit" :disabled="pending">
            {{ t('auth.signIn.submit') }}
          </UiButton>
        </div>
      </form>

      <p class="auth-links">
        <RouterLink :to="{ name: 'forgot-password' }">
          {{ t('auth.signIn.forgot') }}
        </RouterLink>
        <RouterLink :to="{ name: 'sign-up' }">
          {{ t('auth.signIn.toSignUp') }}
        </RouterLink>
      </p>
    </div>
  </AuthShell>
</template>
