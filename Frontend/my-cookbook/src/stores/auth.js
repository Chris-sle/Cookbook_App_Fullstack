import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    userId: localStorage.getItem('userId') || null,
    username: localStorage.getItem('username') || null,
    isAdmin: localStorage.getItem('isAdmin') === 'true' || false,
  }),

  actions: {
    setToken(token, { userId, username, isAdmin } = {}) {
      this.token = token
      localStorage.setItem('token', token)

      if (userId !== undefined) {
        this.userId = userId
        localStorage.setItem('userId', userId)
      }
      if (username !== undefined) {
        this.username = username
        localStorage.setItem('username', username)
      }
      if (isAdmin !== undefined) {
        this.isAdmin = isAdmin
        localStorage.setItem('isAdmin', isAdmin.toString());
      }
    },
    setAccessToken(token) {
      this.token = token
      localStorage.setItem('token', token)
    },
    clearToken() {
      this.token = ''
      this.userId = null
      this.username = null
      this.isAdmin = false
      localStorage.removeItem('token')
      localStorage.removeItem('userId')
      localStorage.removeItem('username')
      localStorage.removeItem('isAdmin')
    },
    setUser({ userId, username, isAdmin }) {
      this.userId = userId
      this.username = username
      this.isAdmin = isAdmin
      localStorage.setItem('userId', userId)
      localStorage.setItem('username', username)
      localStorage.setItem('isAdmin', isAdmin.toString());
    },
  },

  getters: {
    isAuthenticated: (state) => !!state.token,
  }
})