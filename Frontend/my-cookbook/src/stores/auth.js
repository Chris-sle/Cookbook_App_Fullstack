import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    userId: localStorage.getItem('userId') || null,
    username: localStorage.getItem('username') || null,
  }),

  actions: {
    setToken(token, { userId, username } = {}) {
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
    },
    setAccessToken(token) {
      this.token = token
      localStorage.setItem('token', token)
    },
    clearToken() {
      this.token = ''
      this.userId = null
      this.username = null
      localStorage.removeItem('token')
      localStorage.removeItem('userId')
      localStorage.removeItem('username')
    },
    setUser({ userId, username }) {
      this.userId = userId
      this.username = username
      localStorage.setItem('userId', userId)
      localStorage.setItem('username', username)
    },
  },

  getters: {
    isAuthenticated: (state) => !!state.token,
  }
})