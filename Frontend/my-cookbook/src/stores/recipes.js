import { defineStore } from 'pinia'
import api from '../services/api'

export const useRecipesStore = defineStore('recipes', {
  state: () => ({
    recipes: [],
    loading: false,
    error: null,
    lastFetched: null, // timestamp
  }),

  getters: {
    hasRecipes: (state) => state.recipes.length > 0,
    getRecipeById: (state) => (id) => state.recipes.find(r => r.id === id),
  },

  actions: {
    async fetchRecipes({ force = false } = {}) {
      // If we have recipes and not forcing, skip network call
      if (!force && this.recipes.length > 0) {
        return this.recipes
      }

      this.loading = true
      this.error = null
      try {
        const res = await api.get('/recipes/search') // per your API: returns array
        this.recipes = Array.isArray(res.data) ? res.data : []
        this.lastFetched = Date.now()
        console.log('Fetched recipes:', this.recipes)
        return this.recipes
      } catch (err) {
        // Normalize error message
        this.error = err.response?.data?.message || err.message || 'Failed to fetch recipes'
        throw err
      } finally {
        this.loading = false
      }
    },

    // optional helper to clear cache (e.g., after adding a recipe)
    clearCache() {
      this.recipes = []
      this.lastFetched = null
    }
  }
})