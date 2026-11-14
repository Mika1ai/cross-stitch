import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from 'vue-router'
import { useAuthStore } from '../stores/auth'

const guestNames = new Set([
  'sign-in',
  'sign-up',
  'forgot-password',
  'confirm-email',
])

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/gallery',
  },
  {
    path: '/sign-in',
    name: 'sign-in',
    component: () => import('../pages/SignInPage.vue'),
    meta: { guest: true },
  },
  {
    path: '/sign-up',
    name: 'sign-up',
    component: () => import('../pages/SignUpPage.vue'),
    meta: { guest: true },
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('../pages/ForgotPasswordPage.vue'),
    meta: { guest: true },
  },
  {
    path: '/confirm-email',
    name: 'confirm-email',
    component: () => import('../pages/ConfirmEmailPage.vue'),
    meta: { guest: true },
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: () => import('../pages/ResetPasswordPage.vue'),
    meta: { auth: true, allowRecovery: true },
  },
  {
    path: '/auth/callback',
    name: 'auth-callback',
    component: () => import('../pages/AuthCallbackPage.vue'),
  },
  {
    path: '/gallery',
    name: 'gallery',
    component: () => import('../pages/GalleryPage.vue'),
    meta: { auth: true },
  },
  {
    path: '/schemes/:schemeId',
    name: 'scheme',
    component: () => import('../pages/SchemePage.vue'),
    meta: { auth: true },
  },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.ready) await auth.init()

  const isAuthed = Boolean(auth.session)

  if (to.name === 'auth-callback') return true

  if (to.meta.auth && !isAuthed) {
    return {
      name: 'sign-in',
      query: { redirect: to.fullPath },
    }
  }

  if (to.meta.guest && isAuthed && guestNames.has(String(to.name))) {
    return { name: 'gallery' }
  }

  return true
})
