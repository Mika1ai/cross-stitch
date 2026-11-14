<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const { t } = useI18n()
const route = useRoute()
const auth = useAuthStore()

const email = computed(() =>
  typeof route.query.email === 'string' ? route.query.email : '',
)
const reason = computed(() =>
  route.query.reason === 'recovery' ? 'recovery' : 'signup',
)

const message = ref('')
const error = ref('')
const pending = ref(false)

async function resend() {
  if (!email.value || reason.value !== 'signup') return
  error.value = ''
  message.value = ''
  pending.value = true
  try {
    await auth.resendSignup(email.value)
    message.value = t('auth.confirm.resent')
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
      <h1 class="auth-card__title">{{ t('auth.confirm.title') }}</h1>
      <p class="auth-card__lead">
        {{
          reason === 'recovery'
            ? t('auth.confirm.leadRecovery')
            : t('auth.confirm.leadSignup')
        }}
      </p>
      <p v-if="email" class="auth-card__lead">{{ email }}</p>

      <p v-if="message" class="auth-card__lead">{{ message }}</p>
      <p v-if="error" class="auth-error" role="alert">{{ error }}</p>

      <div v-if="reason === 'signup' && email" class="auth-actions">
        <UiButton
          class="ui-btn-block"
          type="button"
          :disabled="pending"
          @click="resend"
        >
          {{ t('auth.confirm.resend') }}
        </UiButton>
      </div>

      <p class="auth-links">
        <RouterLink :to="{ name: 'sign-in' }">
          {{ t('auth.confirm.toSignIn') }}
        </RouterLink>
      </p>
    </div>
  </AuthShell>
</template>
