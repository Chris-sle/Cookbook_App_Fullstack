import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import api from '../services/api'

export const useLookupsStore = defineStore('lookups', () => {
  // state
  const categories = ref([])             // full list from /categories/suggest
  const categoriesLoaded = ref(false)
  const categoriesLoading = ref(false)

  // ingredient suggestions cache: key -> array of items
  const ingredientCache = reactive({})
  const ingredientLoading = reactive({}) // per-query loading flag (keyed by normalized query)

  // helpers
  function normalizeKey(q) {
    return String(q || '').trim().toLowerCase()  
  }

  // load all categories (GET /categories/suggest). cached unless force=true
  async function loadCategories(force = false) {
    if (categoriesLoaded.value && !force) return categories.value
    categoriesLoading.value = true
    try {
      const res = await api.get('/categories/suggest')
      if (Array.isArray(res.data)) {
        categories.value = res.data
        console.log('Loaded categories:', categories.value)
        categoriesLoaded.value = true
      } else {
        categories.value = []
      }
      return categories.value
    } catch (err) {
      console.error('Failed to load categories', err)
      categories.value = []
      categoriesLoaded.value = false
      throw err
    } finally {
      categoriesLoading.value = false
    }
  }

  // return categories filtered by q (client-side). Will load categories if needed.
  // q empty returns full list (or [] if not loaded).
  async function getCategorySuggestions(q = '') {
    if (!categoriesLoaded.value) {
      try {
        await loadCategories()
      } catch {
        // ignore — loadCategories already logged
        return []
      }
    }
    const key = normalizeKey(q)
    if (!key) return categories.value.slice()
    return categories.value.filter((c) =>
      String(c.name || '').toLowerCase().includes(key)
    )
  }

  // fetch ingredient suggestions by calling GET /ingredients?q=...&limit=...
  // caches results per query key. returns array of { id, name }.
  // If force=true, re-fetches even if cached.
  async function fetchIngredientSuggestions(q = '', limit = 10, force = false) {
    const key = normalizeKey(q)
    // return cached if present (unless force)
    if (!force && ingredientCache[key]) {
      return ingredientCache[key]
    }

    // mark loading for this key
    ingredientLoading[key] = true
    try {
      const params = {}
      if (key) params.q = q
      if (limit != null) params.limit = limit
      const res = await api.get('/ingredients', { params })
      const items = Array.isArray(res.data) ? res.data : []
      // dedupe by id/name similarly to front-end logic
      const seen = new Set()
      const out = []
      for (const it of items) {
        const dedupeKey = it.id ? `id:${it.id}` : `name:${String(it.name || '').trim().toLowerCase()}`
        if (!seen.has(dedupeKey)) {
          seen.add(dedupeKey)
          out.push(it)
        }
      }
      ingredientCache[key] = out
      return out
    } catch (err) {
      console.error('Failed to fetch ingredient suggestions', err)
      ingredientCache[key] = []
      return []
    } finally {
      ingredientLoading[key] = false
    }
  }

  // helper to access loading state for a particular query
  function isIngredientLoading(q = '') {
    return !!ingredientLoading[normalizeKey(q)]
  }

  // clear caches (categories and ingredient cache). useful after mutations.
  function clearCache() {
    categories.value = []
    categoriesLoaded.value = false
    for (const k in ingredientCache) delete ingredientCache[k]
    for (const k in ingredientLoading) delete ingredientLoading[k]
  }

  return {
    categories,
    categoriesLoaded,
    categoriesLoading,
    loadCategories,
    getCategorySuggestions,
    fetchIngredientSuggestions,
    isIngredientLoading,
    clearCache,
  }
})