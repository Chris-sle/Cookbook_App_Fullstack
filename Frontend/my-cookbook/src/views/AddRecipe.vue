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

      <div class="ingredients" ref="ingredientsContainer">
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
          :class="{ matched: !!ing.ingredient_id }"
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
            <DropdownList
                v-if="suggestionsMap[idx] && suggestionsMap[idx].length"
                :items="suggestionsMap[idx]"
                :highlightedIndex="highlightedMap[idx]"
                :getItemId="getItemId(idx)"
                :getActiveDescendantId="() => getActiveDescendantId(idx)"
                @select="item => selectSuggestion(idx, item)"
                :loading="loadingSuggestions[idx]"
            />
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
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'
import { useRecipesStore } from '../stores/recipes'
import DropdownList from '../components/DropdownList.vue'

const router = useRouter()
const auth = useAuthStore()
const recipesStore = useRecipesStore()

const title = ref('')
const image_url = ref('')
const instructions = ref('')
const ingredients = reactive([]) // array of { name, ingredient_id, quantity, tempId }
const loading = ref(false)
const error = ref('')
const success = ref('')

// suggestions: index -> array of suggestion objects { id, name }
const suggestionsMap = reactive({})
// highlighted index for keyboard nav: index -> number
const highlightedMap = reactive({})
// loading state per input index
const loadingSuggestions = reactive({}) 
// debounce timers per input index
const timers = {}
// container ref to detect outside clicks and hide suggestions
const ingredientsContainer = ref(null)

// Ensure user is authenticated, and initialize with one ingredient row
onMounted(() => {
  if (!auth.isAuthenticated) {
    router.push('/login')
    return
  }
  if (ingredients.length === 0) addIngredientRow()
  document.addEventListener('click', handleDocumentClick)
})

// cleanup
onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  // clear any pending timers
  for (const k in timers) {
    clearTimeout(timers[k])
  }
})

function getItemId(index) {
  return (i) => `suggestion-${index}-${i}`
}

function getActiveDescendantId(index) {
  const cur = highlightedMap[index] ?? -1
  return cur >= 0 ? `suggestion-${index}-${cur}` : null
}

function addIngredientRow() {
  const idx = ingredients.length
  ingredients.push({
    name: '',
    ingredient_id: null,
    quantity: '',
    tempId: Date.now() + Math.random(),
  })
  suggestionsMap[idx] = []
  highlightedMap[idx] = -1
}

function removeIngredientRow(index) {
  // cleanup timer for that index if exists
  if (timers[index]) {
    clearTimeout(timers[index])
    delete timers[index]
  }
  ingredients.splice(index, 1)
  // rebuild suggestions/highlight maps to keep indexes consistent
  rebuildSuggestionMaps()
}

function rebuildSuggestionMaps() {
  const newSuggestions = {}
  const newHighlighted = {}
  for (let i = 0; i < ingredients.length; i++) {
    newSuggestions[i] = suggestionsMap[i] || []
    newHighlighted[i] = highlightedMap[i] ?? -1
  }
  // clear old keys
  Object.keys(suggestionsMap).forEach(k => delete suggestionsMap[k])
  Object.keys(highlightedMap).forEach(k => delete highlightedMap[k])
  Object.assign(suggestionsMap, newSuggestions)
  Object.assign(highlightedMap, newHighlighted)
}

/**
 * Called when the user types in an ingredient input.
 * - Clears stored ingredient_id if user edits after selecting a suggestion.
 * - Cancels pending timer and clears suggestions immediately if input empty.
 * - Otherwise debounces fetchSuggestionsFor.
 */
function onIngredientInput(index) {
  const val = (ingredients[index].name || '').trim()

  // If user changed text after selecting a suggestion, clear stored id
  if (ingredients[index].ingredient_id) {
    ingredients[index].ingredient_id = null
  }

  // If input empty, cancel pending timer and clear suggestions immediately
  if (!val) {
    if (timers[index]) {
      clearTimeout(timers[index])
      delete timers[index]
    }
    suggestionsMap[index] = []
    highlightedMap[index] = -1
    return
  }

  // Debounce fetch
  if (timers[index]) {
    clearTimeout(timers[index])
  }
  timers[index] = setTimeout(async () => {
    await fetchSuggestionsFor(index, val)
    delete timers[index]
  }, 250) // slightly shorter debounce for snappier UX
}

/**
 * Fetch suggestions from backend for a specific input row.
 */
async function fetchSuggestionsFor(index, q) {
  try {
    loadingSuggestions[index] = true
    const currentVal = (ingredients[index]?.name || '').trim()
    if (!currentVal || currentVal.toLowerCase() !== q.toLowerCase()) {
      suggestionsMap[index] = []
      highlightedMap[index] = -1
      return
    }
    const res = await api.get('/ingredients', { params: { q, limit: 10 } })
    suggestionsMap[index] = dedupeSuggestions(res.data || [])
    highlightedMap[index] = -1
  } catch (err) {
    suggestionsMap[index] = []
    highlightedMap[index] = -1
    console.error('Suggestions fetch failed:', err)
  } finally {
    loadingSuggestions[index] = false
  }
}

// Remove duplicates from suggestions based on id or name (case-insensitive)
function dedupeSuggestions(items) {
  const seen = new Set()
  const out = []
  for (const item of items || []) {
    const key = item.id ? `id:${item.id}` : `name:${String(item.name || '').trim().toLowerCase()}`
    if (!seen.has(key)) {
      seen.add(key)
      out.push(item)
    }
  }
  return out
}

/**
 * When user clicks a suggestion, store both name and id.
 */
function selectSuggestion(index, suggestion) {
  ingredients[index].name = suggestion.name
  ingredients[index].ingredient_id = suggestion.id
  suggestionsMap[index] = []
  highlightedMap[index] = -1
}

/* keyboard navigation */
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

/**
 * Hide suggestions when clicking outside the ingredients container.
 * Also clears suggestions if clicking outside individual inputs.
 */
function handleDocumentClick(e) {
  if (!ingredientsContainer.value) return
  if (!ingredientsContainer.value.contains(e.target)) {
    // clicked outside entire ingredients area -> clear all suggestions
    for (const k in suggestionsMap) {
      suggestionsMap[k] = []
      highlightedMap[k] = -1
    }
  } else {
    // clicked inside ingredients area but maybe outside a specific suggestion list;
    // we don't need further logic because suggestion selection uses mousedown.prevent
  }
}

/* Validation */
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
    if ((!ing.ingredient_id) && (!ing.name || !ing.name.trim())) {
      error.value = 'Each ingredient must have a name or be selected'
      return false
    }
  }
  return true
}

/* Submit - prefer ingredient_id when present, otherwise send name */
async function submit() {
  error.value = ''
  success.value = ''

  if (!validate()) return

  loading.value = true

  const payload = {
    title: title.value,
    instructions: instructions.value,
    image_url: image_url.value || null,
    ingredients: ingredients.map((ing) => {
      if (ing.ingredient_id) {
        return { ingredient_id: Number(ing.ingredient_id), quantity: ing.quantity || null }
      }
      return { name: (ing.name || '').trim(), quantity: ing.quantity || null }
    }),
  }

  try {
    const res = await api.post('/recipes', payload)
    success.value = res.data?.message || 'Recipe created'

    // reset form
    title.value = ''
    image_url.value = ''
    instructions.value = ''
    ingredients.splice(0)
    rebuildSuggestionMaps()

    // Clear recipes cache
    if (recipesStore && typeof recipesStore.clearCache === 'function') {
      recipesStore.clearCache()
    }

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

/* Indicator for rows that matched existing ingredient (selected suggestion) */
.ingredient-row.matched {
    background: #f8fffb;
    border-left: 3px solid #16a34a;
    padding-left: 4px;
    border-radius: 6px;
}

/* remove button */
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

/* Autocomplete specifics */
.autocomplete-field {
    position: relative;
    width: 100%;
}

.suggestions {
    list-style: none;
    margin: 6px 0 0 0;
    padding: 6px 0;
    position: absolute;
    top: 100%; /* place below input */
    left: 0;
    right: 0;
    z-index: 300;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 6px;
    box-shadow: 0 6px 18px rgba(15,23,42,0.06);
    max-height: 220px;
    overflow-y: auto;
}

.suggestions li {
    max-height: 200px;
    overflow-y: auto;
    padding: 8px 12px;
    cursor: pointer;
}

.suggestions li:hover,
.suggestions li.highlighted {
    background: #f3f4f6;
}
</style>