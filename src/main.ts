import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@fortawesome/fontawesome-free/css/all.min.css'
import 'vue-color/style.css'
import './styles/main.css'
import App from './App.vue'
import { i18n } from './i18n'
import { router } from './router'
import { useAuthStore } from './stores/auth'
import { useSchemeStore } from './stores/scheme'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(i18n)
app.use(router)

const auth = useAuthStore(pinia)
void auth.init()
/* Тема/locale живут в scheme store — прогреть сразу, иначе auth-страницы без store остаются на CSS-дефолте. */
useSchemeStore(pinia)

app.mount('#app')
