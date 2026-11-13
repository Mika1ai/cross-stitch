import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@fortawesome/fontawesome-free/css/all.min.css'
import 'vue-color/style.css'
import './styles/main.css'
import App from './App.vue'
import { i18n } from './i18n'

createApp(App).use(createPinia()).use(i18n).mount('#app')
