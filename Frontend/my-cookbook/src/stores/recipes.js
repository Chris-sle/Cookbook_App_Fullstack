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
    async fetchRecipes() {
      console.log('Fetching recipes...');
      this.loading = true
      this.error = null
      try {
        const res = await api.get('/recipes/search')
        // Correct: extract recipes from res.data
        this.recipes = Array.isArray(res.data?.data) ? res.data.data : []
        this.lastFetched = Date.now()
        console.log('Recipes after fetch:', this.recipes)
        return this.recipes
      } catch (err) {
        this.error = err.response?.data?.message || err.message || 'Failed to fetch recipes'
        throw err
      } finally {
        this.loading = false
      }
    },
    clearCache() {
      this.recipes = []
      this.lastFetched = null
    }
  }
})