import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import api from './services/api'
import router from './router'
import './style.css'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)
app.use(router)

// Attach interceptor after store is set up
const { useAuthStore } = await import('./stores/auth')
const auth = useAuthStore()

api.interceptors.request.use((config) => {
  if (auth.token) {
    config.headers['x-auth-token'] = auth.token
  }
  return config
})

app.mount('#app')