import axios from 'axios'
import { useAuthStore } from '../stores/auth' // assuming your auth store

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true, // ensure cookies are sent
})

// Request interceptor to attach access token from auth store
api.interceptors.request.use(config => {
  const auth = useAuthStore()
  if (auth.token) {
    config.headers['Authorization'] = `Bearer ${auth.token}`
  }
  return config
})

// Response interceptor to handle 401 (refresh)
let isRefreshing = false
let refreshPromise = null

api.interceptors.response.use(
  response => response,
  async error => {
    const originalReq = error.config
    // Detect 401 due to expired token
    if (error.response?.status === 401 && !originalReq._retry) {
      console.log('Access token expired, attempting to refresh...')
      originalReq._retry = true
      if (!isRefreshing) {
        isRefreshing = true
        refreshPromise = api.post('/auth/refresh') // call refresh route
        try {
          const res = await refreshPromise
          const newToken = res.data.accessToken
          // Update store with new token
          const auth = useAuthStore()
          auth.setToken(newToken)
          console.log('Token refreshed successfully')
        } catch (err) {
          // Refresh failed, logout user
          const auth = useAuthStore()
          auth.clearToken()
          window.location = '/login'
          console.log('Token refresh failed, redirecting to login')
          throw error
        } finally {
          isRefreshing = false
        }
      }
      // Wait for the refresh to finish, then retry original request
      const res = await refreshPromise
      originalReq.headers['Authorization'] = `Bearer ${res.data.accessToken}`
      return api(originalReq)
    }
    return Promise.reject(error)
  }
)

export default api