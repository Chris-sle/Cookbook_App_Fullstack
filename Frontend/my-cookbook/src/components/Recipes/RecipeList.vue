<template>
  <div class="recipe-list-page">
    <header class="list-header">
      <div class="search">
        <input v-model="q" @keyup.enter="applyFilters" placeholder="Search recipes..." />
        <button @click="applyFilters">Search</button>
      </div>

      <div class="filters">
        <input v-model="ingredientQuery" @input="onIngredientQuery" placeholder="Filter by ingredient" />
        <div v-if="ingredientSuggestions.length" class="suggestions-popup">
          <button v-for="s in ingredientSuggestions" :key="s.id" @click="addIngredientFilter(s)">{{ s.name }}</button>
        </div>

        <select v-model="selectedCategoryId" @change="applyFilters">
          <option value="">All categories</option>
          <option v-for="c in categoriesList" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>

        <button @click="clearFilters">Clear</button>
      </div>
    </header>

    <main>
      <div v-if="loading" class="loading">Loading recipes…</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <div v-else>
        <div class="grid">
          <RecipeCard
            v-for="recipe in recipes"
            :key="recipe.id"
            :recipe="recipe"
            @click="goToRecipeDetails(recipe.id)"
          />
        </div>

        <div class="pagination" v-if="meta.total > 0">
          <button :disabled="meta.page <= 1" @click="setPage(meta.page - 1)">Previous</button>
          <span>Page {{ meta.page }} of {{ totalPages }}</span>
          <button :disabled="meta.page >= totalPages" @click="setPage(meta.page + 1)">Next</button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useRecipesStore } from '../../stores/recipes'
import { useLookupsStore } from '../../stores/lookups'
import RecipeCard from './RecipeCard.vue'
import api from '../../services/api'

const router = useRouter()
const recipesStore = useRecipesStore()
const lookups = useLookupsStore()

// Local reactive state
const loading = ref(false)
const error = ref(null)
const recipes = ref([])
const meta = ref({ total: 0, page: 1, limit: 12 })

const q = ref('')
const ingredientQuery = ref('')
const ingredientSuggestions = ref([])
const ingredientFilters = ref([]) // array of ingredient ids
const selectedCategoryId = ref('')

// categories list (load once)
const categoriesList = ref([])

const totalPages = computed(() => Math.max(1, Math.ceil((meta.value.total || 0) / meta.value.limit)))

// load categories
async function loadCategories() {
  try {
    categoriesList.value = await lookups.loadCategories()
  } catch (err) {
    console.error('Failed to load categories', err)
  }
}

// Compose params and fetch from API
async function fetchRecipes(params = {}) {
  loading.value = true
  error.value = null
  try {
    const res = await api.get('/recipes/search', { params })
    // expected response: { data: [...], meta: { total, page, limit } }
    recipes.value = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : [])
    meta.value = res.data?.meta || { total: recipes.value.length, page: 1, limit: params.limit || 12 }
  } catch (err) {
    console.error('Failed to fetch recipes', err)
    error.value = err.response?.data?.message || err.message || 'Failed to load recipes'
  } finally {
    loading.value = false
  }
}

function buildParams(page = 1) {
  const params = { page, limit: meta.value.limit }
  if (q.value) params.q = q.value
  if (ingredientFilters.value.length) params.ingredient_id = ingredientFilters.value.join(',')
  if (selectedCategoryId.value) params.category_id = selectedCategoryId.value
  return params
}

function applyFilters() {
  setPage(1)
}

function setPage(p) {
  const params = buildParams(p)
  fetchRecipes(params)
}

// ingredient suggestion handlers
let ingredientDebounce = null
function onIngredientQuery() {
  const qv = ingredientQuery.value.trim()
  if (ingredientDebounce) clearTimeout(ingredientDebounce)
  if (!qv) {
    ingredientSuggestions.value = []
    return
  }
  ingredientDebounce = setTimeout(async () => {
    ingredientSuggestions.value = await lookups.fetchIngredientSuggestions(qv, 8)
  }, 250)
}

function addIngredientFilter(s) {
  if (!ingredientFilters.value.includes(s.id)) {
    ingredientFilters.value.push(s.id)
    ingredientQuery.value = ''
    ingredientSuggestions.value = []
    applyFilters()
  }
}

function removeIngredientFilter(id) {
  ingredientFilters.value = ingredientFilters.value.filter(i => i !== id)
  applyFilters()
}

function clearFilters() {
  q.value = ''
  ingredientQuery.value = ''
  ingredientSuggestions.value = []
  ingredientFilters.value = []
  selectedCategoryId.value = ''
  applyFilters()
}

function goToRecipeDetails(id) {
  router.push(`/recipes/${id}`)
}

// initial load
onMounted(async () => {
  await loadCategories()
  // initial fetch
  setPage(meta.value.page)
})
</script>

<style scoped>
.recipe-list-page {
  max-width: 1100px;
  margin: 20px auto;
  padding: 0 12px;
}
.list-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}
.search {
  display: flex;
  gap: 8px;
  align-items: center;
}
.filters {
  display: flex;
  gap: 8px;
  align-items: center;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
.loading, .error {
  padding: 20px;
  text-align: center;
}
.suggestions-popup {
  position: absolute;
  background: white;
  border: 1px solid #ddd;
  box-shadow: 0 6px 18px rgba(0,0,0,0.06);
  padding: 6px;
  border-radius: 6px;
  z-index: 50;
}
.suggestions-popup button {
  display: block;
  margin: 6px 0;
  padding: 6px 10px;
  border-radius: 6px;
  background: #f6f9ff;
  border: 1px solid #e1e8ff;
  cursor: pointer;
}
.pagination {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin: 20px 0;
}
</style>