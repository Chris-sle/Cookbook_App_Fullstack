<template>
  <div class="recipe-details">
    <div v-if="loading" class="loading">Loading recipe…</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else>
      <div class="header">
        <h1>{{ recipe.title }}</h1>
        <div class="meta">
          <span class="author">By {{ recipe.author_username || 'Unknown' }}</span>
          <div class="categories">
            <span v-for="c in recipe.categories || []" :key="c.id" class="category">{{ c.name }}</span>
          </div>
        </div>
      </div>

      <div class="top-row">
        <div class="image-wrap">
          <img :src="recipe.image_url || placeholderImage" :alt="recipe.title" />
        </div>

        <div class="actions-panel">
          <UpDownVoteButtons :recipeId="recipe.id" />
          <div class="clicks" v-if="clicks !== null">Clicks: {{ clicks }}</div>
        </div>
      </div>

      <section class="ingredients">
        <h3>Ingredients</h3>
        <ul>
          <li v-for="ing in recipe.ingredients || []" :key="ing.id">
            {{ ing.name }} <span v-if="ing.quantity">— {{ ing.quantity }}</span>
          </li>
        </ul>
      </section>

      <section class="instructions">
        <h3>Instructions</h3>
        <p v-if="recipe.instructions">{{ recipe.instructions }}</p>
        <p v-else class="muted">No instructions provided.</p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../services/api'
import UpDownVoteButtons from '../components/UpDownVoteButtons.vue'

const route = useRoute()
const id = Number(route.params.id)

const recipe = ref(null)
const loading = ref(true)
const error = ref(null)
const clicks = ref(null)

const placeholderImage = 'https://via.placeholder.com/800x450?text=No+Image'

async function fetchRecipe() {
  loading.value = true
  error.value = null
  try {
    // Prefer GET /recipes/:id if available; using /recipes/search as fallback
    let res
    try {
      res = await api.get(`/recipes/${id}`) // try dedicated endpoint first
      recipe.value = res.data
    } catch (e) {
      // fallback: search endpoint that returns array
      const r2 = await api.get('/recipes/search', { params: { id } })
      const data = Array.isArray(r2.data) ? r2.data[0] : r2.data?.data?.[0] || null
      recipe.value = data
    }

    if (!recipe.value) throw new Error('Recipe not found')
  } catch (err) {
    console.error('Failed to load recipe', err)
    error.value = err.response?.data?.message || err.message || 'Failed to load recipe'
  } finally {
    loading.value = false
  }
}

// record click on mount
async function recordClick() {
  try {
    const res = await api.post(`/recipes/activity/${id}/click`)
    clicks.value = res.data?.clicks ?? null
  } catch (err) {
    // don't block the page on click errors; just log
    console.warn('Failed to record click', err)
  }
}

onMounted(async () => {
  await fetchRecipe()
  // Only record click if recipe loaded
  if (recipe.value) {
    recordClick()
  }
})
</script>

<style scoped>
.recipe-details {
  max-width: 900px;
  margin: 20px auto;
  padding: 0 12px;
}
.loading, .error {
  padding: 20px;
  text-align: center;
}
.header h1 {
  margin: 0 0 8px;
}
.meta {
  display: flex;
  gap: 12px;
  align-items: center;
  color: #555;
  margin-bottom: 12px;
}
.categories .category {
  background: #f0f0f0;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.85rem;
}
.top-row {
  display: flex;
  gap: 18px;
  align-items: flex-start;
  margin-bottom: 18px;
}
.image-wrap img {
  width: 100%;
  max-width: 520px;
  height: auto;
  border-radius: 8px;
  object-fit: cover;
}
.actions-panel {
  min-width: 140px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
}
.clicks {
  font-size: 0.9rem;
  color: #444;
}
.ingredients ul {
  list-style: disc;
  padding-left: 20px;
}
.instructions p {
  white-space: pre-wrap;
}
.muted { color: #888; }
</style>