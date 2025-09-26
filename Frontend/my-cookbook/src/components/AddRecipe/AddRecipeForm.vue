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

      <!-- Ingredients -->
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
              @input="handleIngredientInput(idx)"
              @keydown.down.prevent="suggestions.highlightNext(getIngredientSuggestionIndex(idx))"
              @keydown.up.prevent="suggestions.highlightPrev(getIngredientSuggestionIndex(idx))"
              @keydown.enter.prevent="applyHighlightedIngredient(idx)"
              autocomplete="off"
              required
            />

            <DropdownList
              v-if="suggestions.suggestionsMap[getIngredientSuggestionIndex(idx)] && suggestions.suggestionsMap[getIngredientSuggestionIndex(idx)].length"
              :items="suggestions.suggestionsMap[getIngredientSuggestionIndex(idx)]"
              :highlightedIndex="suggestions.highlightedMap[getIngredientSuggestionIndex(idx)]"
              :getItemId="getItemId(getIngredientSuggestionIndex(idx))"
              :getActiveDescendantId="() => getActiveDescendantId(getIngredientSuggestionIndex(idx))"
              @select="item => selectIngredientSuggestion(idx, item)"
              :loading="suggestions.loadingSuggestions[getIngredientSuggestionIndex(idx)]"
            />
          </div>

          <div class="small-field">
            <label>Quantity</label>
            <input v-model="ing.quantity" placeholder="e.g. 200g or 2 cups" />
          </div>

          <button type="button" class="remove-btn" @click="removeIngredientRow(idx)">Remove</button>
        </div>
      </div>

      <!-- Categories -->
      <div class="ingredients categories" ref="categoriesContainer">
        <div class="ingredients-header">
          <h3>Categories</h3>
          <button type="button" class="add-btn" @click="addCategoryRow">+ Add</button>
        </div>

        <div v-if="categoriesList.length === 0" class="no-ingredients">
          No categories added yet.
        </div>

        <div
          class="ingredient-row"
          v-for="(cat, cidx) in categoriesList"
          :key="cat.tempId"
        >
          <div class="small-field autocomplete-field">
            <label>Category</label>
            <input
              v-model="cat.name"
              type="text"
              placeholder="e.g. Main Course"
              @input="handleCategoryInput(cidx)"
              @keydown.down.prevent="suggestions.highlightNext(getCategorySuggestionIndex(cidx))"
              @keydown.up.prevent="suggestions.highlightPrev(getCategorySuggestionIndex(cidx))"
              @keydown.enter.prevent="applyHighlightedCategory(cidx)"
              autocomplete="off"
            />

            <DropdownList
              v-if="suggestions.suggestionsMap[getCategorySuggestionIndex(cidx)] && suggestions.suggestionsMap[getCategorySuggestionIndex(cidx)].length"
              :items="suggestions.suggestionsMap[getCategorySuggestionIndex(cidx)]"
              :highlightedIndex="suggestions.highlightedMap[getCategorySuggestionIndex(cidx)]"
              :getItemId="getItemId(getCategorySuggestionIndex(cidx))"
              :getActiveDescendantId="() => getActiveDescendantId(getCategorySuggestionIndex(cidx))"
              @select="item => selectCategorySuggestion(cidx, item)"
              :loading="suggestions.loadingSuggestions[getCategorySuggestionIndex(cidx)]"
            />
          </div>

          <button type="button" class="remove-btn" @click="removeCategoryRow(cidx)">Remove</button>
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
import api from '../../services/api'
import { useAuthStore } from '../../stores/auth'
import { useRecipesStore } from '../../stores/recipes'
import { useLookupsStore } from '../../stores/lookups'
import { useSuggestions } from '../../composables/useSuggestions'
import DropdownList from './DropdownList.vue' // adjust path as needed

const router = useRouter()
const auth = useAuthStore()
const recipesStore = useRecipesStore()
const lookups = useLookupsStore()

// Form state
const title = ref('')
const image_url = ref('')
const instructions = ref('')
const ingredients = reactive([]) // { name, ingredient_id, quantity, tempId }
const categoriesList = reactive([]) // { name, category_id, tempId }

const loading = ref(false)
const error = ref('')
const success = ref('')

// suggestion composable
const suggestions = useSuggestions()

// offset to map category suggestion indexes so they don't collide with ingredient indexes
let ingredientOffset = 0

// container refs for outside-click hiding
const ingredientsContainer = ref(null)
const categoriesContainer = ref(null)

onMounted(async () => {
  if (!auth.isAuthenticated) {
    router.push('/login')
    return
  }

  // lightly pre-load categories list
  lookups.loadCategories().catch(() => {})

  // init with one ingredient
  if (ingredients.length === 0) addIngredientRow()

  // ensure offset is correct
  ingredientOffset = ingredients.length

  document.addEventListener('click', handleDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
})

/* Helpers for suggestion ids/active descendant */
function getItemId(index) {
  return (i) => `suggestion-${index}-${i}`
}
function getActiveDescendantId(index) {
  const cur = suggestions.highlightedMap[index] ?? -1
  return cur >= 0 ? `suggestion-${index}-${cur}` : null
}

/* Index mapping helpers */
function getIngredientSuggestionIndex(idx) {
  return idx
}
function getCategorySuggestionIndex(cidx) {
  return cidx + ingredientOffset
}

/* Ingredients management */
function addIngredientRow() {
  ingredients.push({
    name: '',
    ingredient_id: null,
    quantity: '',
    tempId: Date.now() + Math.random(),
  })
  // rebuild suggestion maps to reflect the new layout (ingredients first, then categories)
  ingredientOffset = ingredients.length
  suggestions.rebuildMaps(ingredients.length + categoriesList.length)
}

function removeIngredientRow(index) {
  ingredients.splice(index, 1)
  // rebuild maps and update offset
  ingredientOffset = ingredients.length
  suggestions.rebuildMaps(ingredients.length + categoriesList.length)
}

/* Ingredient input handlers */
function handleIngredientInput(index) {
  const value = ingredients[index].name
  const setIdNull = () => {
    if (ingredients[index].ingredient_id) ingredients[index].ingredient_id = null
  }
  suggestions.onInput(getIngredientSuggestionIndex(index), value, { type: 'ingredient', setIdNull })
}

function selectIngredientSuggestion(index, suggestion) {
  ingredients[index].name = suggestion.name
  ingredients[index].ingredient_id = suggestion.id
  suggestions.suggestionsMap[getIngredientSuggestionIndex(index)] = []
  suggestions.highlightedMap[getIngredientSuggestionIndex(index)] = -1
}

function applyHighlightedIngredient(index) {
  const picked = suggestions.selectHighlighted(getIngredientSuggestionIndex(index))
  if (picked) selectIngredientSuggestion(index, picked)
}

/* Categories management */
function addCategoryRow() {
  categoriesList.push({
    name: '',
    category_id: null,
    tempId: Date.now() + Math.random(),
  })
  // rebuild so category suggestion indexes are computed with the current ingredient count
  ingredientOffset = ingredients.length
  suggestions.rebuildMaps(ingredients.length + categoriesList.length)
}

function removeCategoryRow(index) {
  categoriesList.splice(index, 1)
  // rebuild maps (ingredients first)
  ingredientOffset = ingredients.length
  suggestions.rebuildMaps(ingredients.length + categoriesList.length)
}

/* Category input handlers */
function handleCategoryInput(cidx) {
  const value = categoriesList[cidx].name
  const setIdNull = () => {
    if (categoriesList[cidx].category_id) categoriesList[cidx].category_id = null
  }
  suggestions.onInput(getCategorySuggestionIndex(cidx), value, { type: 'category', setIdNull })
}

function selectCategorySuggestion(cidx, suggestion) {
  categoriesList[cidx].name = suggestion.name
  categoriesList[cidx].category_id = suggestion.id
  suggestions.suggestionsMap[getCategorySuggestionIndex(cidx)] = []
  suggestions.highlightedMap[getCategorySuggestionIndex(cidx)] = -1
}

function applyHighlightedCategory(cidx) {
  const picked = suggestions.selectHighlighted(getCategorySuggestionIndex(cidx))
  if (picked) selectCategorySuggestion(cidx, picked)
}

function catSuggestionsFor(cidx) {
  return suggestions.suggestionsMap[getCategorySuggestionIndex(cidx)] || []
}

/* Handle outside clicks to hide suggestions */
function handleDocumentClick(e) {
  if (ingredientsContainer.value && ingredientsContainer.value.contains(e.target)) {
    // inside ingredients: nothing special
  } else if (categoriesContainer.value && categoriesContainer.value.contains(e.target)) {
    // inside categories: nothing special
  } else {
    suggestions.clearAllSuggestions()
  }
}

/* Validation */
function validate() {
  error.value = ''
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
  for (const cat of categoriesList) {
    if ((!cat.category_id) && (!cat.name || !cat.name.trim())) {
      error.value = 'Each category must have a name or be selected'
      return false
    }
  }
  // optional basic URL validation if an image was provided
  if (image_url.value && image_url.value.trim()) {
    try {
      // URL constructor throws if invalid
      new URL(image_url.value.trim())
    } catch (e) {
      error.value = 'Image URL is not valid'
      return false
    }
  }
  return true
}

/* Submit */
async function submit() {
  error.value = ''
  success.value = ''

  if (!validate()) return

  loading.value = true

  const payload = {
    title: title.value.trim(),
    instructions: instructions.value.trim(),
    image_url: image_url.value && image_url.value.trim() ? image_url.value.trim() : null,
    ingredients: ingredients.map((ing) => {
      if (ing.ingredient_id) {
        return { ingredient_id: Number(ing.ingredient_id), quantity: ing.quantity || null }
      }
      return { name: (ing.name || '').trim(), quantity: ing.quantity || null }
    }),
  }

  if (categoriesList.length) {
    payload.categories = categoriesList.map((cat) => {
      if (cat.category_id) return { category_id: Number(cat.category_id) }
      return { name: (cat.name || '').trim() }
    })
  }

  try {
    const res = await api.post('/recipes', payload)
    success.value = res.data?.message || 'Recipe created'

    // reset form
    title.value = ''
    image_url.value = ''
    instructions.value = ''
    ingredients.splice(0)
    categoriesList.splice(0)
    // re-init one ingredient row for convenience
    addIngredientRow()
    // clear suggestion maps
    suggestions.rebuildMaps(ingredients.length + categoriesList.length)
    suggestions.clearAllSuggestions()

    // Clear caches so other parts of the app will refresh if needed
    if (recipesStore && typeof recipesStore.clearCache === 'function') {
      recipesStore.clearCache()
    }
    if (lookups && typeof lookups.clearCache === 'function') {
      lookups.clearCache()
    }

    // navigate to recipes list
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