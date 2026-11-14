import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@fortawesome/fontawesome-free/css/all.min.css'
import 'vue-color/style.css'
import './styles/main.css'
import App from './App.vue'
import { i18n } from './i18n'
import { router } from './router'
import { useAuthStore } from './stores/auth'
import { useUserSettingsStore } from './stores/userSettings'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(i18n)
app.use(router)

/* Тема/locale — userSettings; прогреть до mount, чтобы auth-страницы не мигали. */
useUserSettingsStore(pinia)

const auth = useAuthStore(pinia)
void auth.init()

app.mount('#app')
