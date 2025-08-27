import axios from 'axios'
import { useAuthStore } from '../stores/auth'

// Create axios instance
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
})

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const auth = useAuthStore()
  if (auth.token) {
    config.headers['x-auth-token'] = auth.token // or 'Authorization': `Bearer ${auth.token}`
  }
  return config
}, (error) => {
  return Promise.reject(error)
})

export default api