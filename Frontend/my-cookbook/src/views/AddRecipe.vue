<template>
  <div class="add-recipe">
    <h2>Add Recipe</h2>

    <form class="recipe-form" @submit.prevent="submit">
      <div class="field">
        <label for="title">Title</label>
        <input id="title" v-model="title" required />
      </div>

      <div class="field">
        <label for="image">Image URL (optional)</label>
        <input id="image" v-model="image_url" type="url" placeholder="https://..." />
      </div>

      <div class="field">
        <label for="instructions">Instructions</label>
        <textarea id="instructions" v-model="instructions" rows="8" required></textarea>
      </div>

      <div class="ingredients">
        <div class="ingredients-header">
          <h3>Ingredients</h3>
          <button type="button" class="add-btn" @click="addIngredientRow">+ Add</button>
        </div>

        <div v-if="ingredients.length === 0" class="no-ingredients">
          No ingredients added yet.
        </div>

        <div
          class="ingredient-row"
          v-for="(ing, idx) in ingredients"
          :key="ing.tempId"
        >
          <div class="small-field autocomplete-field">
            <label>Ingredient name</label>
            <input
              v-model="ing.name"
              type="text"
              placeholder="e.g. Tomato"
              @input="onIngredientInput(idx)"
              @keydown.down.prevent="highlightNext(idx)"
              @keydown.up.prevent="highlightPrev(idx)"
              @keydown.enter.prevent="selectHighlighted(idx)"
              autocomplete="off"
              required
            />

            <!-- suggestions dropdown -->
            <ul v-if="suggestionsMap[idx] && suggestionsMap[idx].length" class="suggestions">
              <li
                v-for="(s, sIdx) in suggestionsMap[idx]"
                :key="s.id"
                :class="{ highlighted: sIdx === highlightedMap[idx] }"
                @mousedown.prevent="selectSuggestion(idx, s)"
              >
                {{ s.name }}
              </li>
            </ul>
          </div>

          <div class="small-field">
            <label>Quantity</label>
            <input v-model="ing.quantity" placeholder="e.g. 200g or 2 cups" />
          </div>

          <button type="button" class="remove-btn" @click="removeIngredientRow(idx)">Remove</button>
        </div>
      </div>

      <div class="actions">
        <button type="submit" :disabled="loading">
          <span v-if="loading">Saving…</span>
          <span v-else>Save Recipe</span>
        </button>
      </div>

      <p class="error" v-if="error">{{ error }}</p>
      <p class="success" v-if="success">{{ success }}</p>
    </form>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'
import { useRecipesStore } from '../stores/recipes'

const router = useRouter()
const auth = useAuthStore()
const recipesStore = useRecipesStore()

const title = ref('')
const image_url = ref('')
const instructions = ref('')
const ingredients = reactive([]) // { name, quantity, tempId }
const loading = ref(false)
const error = ref('')
const success = ref('')

// suggestionsMap: index -> array of suggestion objects
const suggestionsMap = reactive({})
// timers for debouncing per row
const timers = {}
// which suggestion index is highlighted for keyboard navigation per row
const highlightedMap = reactive({})

// Redirect to login if not authenticated
onMounted(() => {
  if (!auth.isAuthenticated) {
    router.push('/login')
  } else {
    if (ingredients.length === 0) addIngredientRow()
  }
})

function addIngredientRow() {
  const idx = ingredients.length
  ingredients.push({
    name: '',
    quantity: '',
    tempId: Date.now() + Math.random(),
  })
  suggestionsMap[idx] = []
  highlightedMap[idx] = -1
}

function removeIngredientRow(index) {
  ingredients.splice(index, 1)
  // clean up suggestion structures (rebuild maps)
  // easier to rebuild maps entirely
  rebuildSuggestionMaps()
}

function rebuildSuggestionMaps() {
  const newSuggestions = {}
  const newHighlighted = {}
  for (let i = 0; i < ingredients.length; i++) {
    newSuggestions[i] = suggestionsMap[i] || []
    newHighlighted[i] = highlightedMap[i] || -1
  }
  // clear old and reassign
  Object.keys(suggestionsMap).forEach(k => delete suggestionsMap[k])
  Object.keys(highlightedMap).forEach(k => delete highlightedMap[k])
  Object.assign(suggestionsMap, newSuggestions)
  Object.assign(highlightedMap, newHighlighted)
}

// called when user types in an ingredient name input
function onIngredientInput(index) {
  const val = (ingredients[index].name || '').trim()

  // Clear suggestions immediately if input is empty
  if (!val) {
    if (timers[index]) {
      clearTimeout(timers[index])
      delete timers[index]
    }
    suggestionsMap[index] = []
    highlightedMap[index] = -1
    return
  }

  // Set debounce timer
  if (timers[index]) {
    clearTimeout(timers[index])
  }
  timers[index] = setTimeout(async () => {
    await fetchSuggestionsFor(index, val)
  }, 300)
}

async function fetchSuggestionsFor(index, q) {
    // If q is empty, just clear suggestions immediately
  if (!q.trim()) {
    suggestionsMap[index] = []
    highlightMap[index] = -1
    return
  }

  try {
    const res = await api.get('/ingredients', { params: { q, limit: 10 } })
    suggestionsMap[index] = Array.isArray(res.data) ? res.data : []
    highlightedMap[index] = -1
  } catch (err) {
    // For autocomplete errors, just clear suggestions (don't block form)
    suggestionsMap[index] = []
    highlightedMap[index] = -1
    console.error('Ingredient suggestions error', err)
  }
}

function selectSuggestion(index, suggestion) {
  // suggestion: { id, name }
  ingredients[index].name = suggestion.name
  // optionally store id if you want to send ids instead of names:
  // ingredients[index].ingredient_id = suggestion.id
  suggestionsMap[index] = []
  highlightedMap[index] = -1
}

function highlightNext(index) {
  const list = suggestionsMap[index] || []
  if (!list.length) return
  let cur = highlightedMap[index] ?? -1
  cur = Math.min(cur + 1, list.length - 1)
  highlightedMap[index] = cur
}

function highlightPrev(index) {
  const list = suggestionsMap[index] || []
  if (!list.length) return
  let cur = highlightedMap[index] ?? -1
  cur = Math.max(cur - 1, 0)
  highlightedMap[index] = cur
}

function selectHighlighted(index) {
  const list = suggestionsMap[index] || []
  const cur = highlightedMap[index] ?? -1
  if (cur >= 0 && cur < list.length) {
    selectSuggestion(index, list[cur])
  }
}

// client-side validation
function validate() {
  if (!title.value.trim()) {
    error.value = 'Title is required'
    return false
  }
  if (!instructions.value.trim()) {
    error.value = 'Instructions are required'
    return false
  }
  if (ingredients.length === 0) {
    error.value = 'Add at least one ingredient'
    return false
  }
  for (const ing of ingredients) {
    if (!ing.name || !ing.name.trim()) {
      error.value = 'Each ingredient must have a name'
      return false
    }
  }
  return true
}

async function submit() {
  error.value = ''
  success.value = ''

  if (!validate()) return

  loading.value = true

  const payload = {
    title: title.value,
    instructions: instructions.value,
    image_url: image_url.value || null,
    ingredients: ingredients.map((ing) => ({
      name: (ing.name || '').trim(),
      quantity: ing.quantity || null,
    })),
  }

  try {
    const res = await api.post('/recipes', payload)
    success.value = res.data?.message || 'Recipe created'

    // Clear local form
    title.value = ''
    image_url.value = ''
    instructions.value = ''
    ingredients.splice(0)
    rebuildSuggestionMaps()

    // Clear recipes cache
    if (recipesStore && typeof recipesStore.clearCache === 'function') {
      recipesStore.clearCache()
    }
    // Redirect to recipes list
    router.push('/recipes')
  } catch (err) {
    error.value =
      err.response?.data?.message ||
      err.response?.data ||
      err.message ||
      'Failed to save recipe'
    console.error('Add recipe error', err)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.add-recipe {
  max-width: 900px;
  margin: 20px auto;
  background: #fff;
  padding: 18px;
  border-radius: 8px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
}

.add-recipe h2 {
  margin: 0 0 12px;
}

.recipe-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
}

.field label {
  font-weight: 600;
  margin-bottom: 6px;
}

.field input,
.field textarea {
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
}

/* Ingredients area */
.ingredients-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 6px;
}

.add-btn {
  background: #eef6ff;
  border: 1px solid #cfe3ff;
  color: #007bff;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
}

.ingredient-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  padding: 6px;
}

.small-field {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.small-field input {
  padding: 6px 8px;
  border: 1px solid #eee;
  border-radius: 6px;
}

.remove-btn {
  background: #fff4f4;
  border: 1px solid #ffd0d0;
  color: #b32;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
}

/* Actions */
.actions {
  display: flex;
  justify-content: flex-end;
}

.actions button {
  padding: 8px 14px;
  border: none;
  border-radius: 6px;
  background: #007bff;
  color: white;
  cursor: pointer;
  font-weight: 600;
}

.error {
  color: #c0392b;
}

.success {
  color: #186a3b;
}

.autocomplete-field {
  position: relative; /* important for absolute positioning inside */
  width: 100%;
}

.suggestions {
  list-style: none;
  margin: 4px 0 0 0;
  padding: 0;
  position: absolute;
  top: 100%; /* Align below input */
  left: 0;
  right: 0; /* match input width */
  z-index: 200;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-shadow: 0 6px 18px rgba(15,23,42,0.06);
  max-height: 220px;
  overflow-y: auto;
}

/* Optional: add some spacing so that the suggestions don't overlap the input tighty */
.autocomplete-field {
  padding-bottom: 2px;
}

.suggestions li {
  padding: 8px 12px;
  cursor: pointer;
}

.suggestions li:hover,
.suggestions li.highlighted {
  background: #f3f4f6;
}
</style>