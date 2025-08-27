import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    userId: null,
  }),

  actions: {
    setToken(token) {
      this.token = token
      localStorage.setItem('token', token)
    },
    clearToken() {
      this.token = ''
      localStorage.removeItem('token')
    },
    setUserId(id) {
      this.userId = id
    }
  },

  getters: {
    isAuthenticated: (state) => !!state.token,
  }
})