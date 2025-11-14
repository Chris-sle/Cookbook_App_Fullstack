<template>
  <div class="edit-recipe">
    <h2>Edit Recipe</h2>

    <div v-if="loading" class="loading">Loading…</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <form v-else @submit.prevent="submit" class="recipe-form">
      <div class="field">
        <label>Title</label>
        <input v-model="title" type="text" />
      </div>

      <div class="field">
        <label>Image URL</label>
        <input v-model="image_url" type="url" placeholder="https://..." />
      </div>

      <div class="field">
        <label>Instructions</label>
        <textarea v-model="instructions" rows="6"></textarea>
      </div>

      <!-- Ingredients -->
      <div class="ingredients">
        <div class="ingredients-header">
          <h3>Ingredients</h3>
          <button type="button" @click="addIngredientRow">+ Add</button>
        </div>

        <div v-for="(ing, idx) in ingredients" :key="ing.tempId" class="ingredient-row">
          <div class="autocomplete-field">
            <input v-model="ing.name" placeholder="Ingredient name" @input="onIngredientInput(idx)"
              @keydown.down.prevent="highlightNext(idx)" @keydown.up.prevent="highlightPrev(idx)"
              @keydown.enter.prevent="selectHighlighted(idx)" @keydown.esc.prevent="clearSuggestions(idx)"
              autocomplete="off" />
            <DropdownList v-if="suggestionsMap[idx] && suggestionsMap[idx].length" :items="suggestionsMap[idx]"
              :highlightedIndex="highlightedMap[idx]" :getItemId="(i) => `ing-${idx}-${i}`"
              :getActiveDescendantId="() => getActiveDescendantId(idx)" :loading="loadingSuggestions[idx]"
              @select="item => selectIngredientSuggestion(idx, item)" />
          </div>

          <input v-model="ing.quantity" placeholder="Quantity" />
          <button type="button" @click="removeIngredientRow(idx)">Remove</button>
        </div>
      </div>

      <!-- Categories -->
      <div class="categories">
        <h3>Categories</h3>

        <div class="category-chips">
          <span v-for="(c, i) in categories" :key="c.tempId" class="chip">
            {{ c.name || `#${c.category_id}` }}
            <button type="button" @click="removeCategory(i)">×</button>
          </span>
        </div>

        <div class="category-input autocomplete-field">
          <input v-model="categoryQuery" @input="onCategoryQuery" @keydown.down.prevent="highlightCategoryNext"
            @keydown.up.prevent="highlightCategoryPrev" @keydown.enter.prevent="addCategoryHighlighted"
            @keydown.esc.prevent="clearCategorySuggestions" placeholder="Add category" autocomplete="off" />
          <DropdownList v-if="categorySuggestions && categorySuggestions.length" :items="categorySuggestions"
            :highlightedIndex="categoryHighlighted" :getItemId="(i) => `cat-${i}`"
            :getActiveDescendantId="() => categoryActiveId()" :loading="categoryLoading"
            @select="addCategoryFromSuggestion" />
          <button type="button" @click="addCategoryFromInput">Add</button>
        </div>
      </div>

      <div class="actions">
        <button type="submit" :disabled="submitting">Save changes</button>
      </div>

      <p class="success" v-if="success">{{ success }}</p>
      <p class="error" v-if="serverError">{{ serverError }}</p>
    </form>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api'
import DropdownList from '../components/AddRecipe/DropdownList.vue'
import { useRecipesStore } from '../stores/recipes'
import { useLookupsStore } from '../stores/lookups'

const route = useRoute()
const router = useRouter()
const id = String(route.params.id)

const recipesStore = useRecipesStore()
const lookups = useLookupsStore()

const loading = ref(true)
const error = ref(null)
const submitting = ref(false)
const serverError = ref('')
const success = ref('')

const title = ref('')
const image_url = ref('')
const instructions = ref('')
const ingredients = reactive([])
const categories = reactive([])

const suggestionsMap = reactive({})
const highlightedMap = reactive({})
const loadingSuggestions = reactive({})
const timers = {}

const categoryQuery = ref('')
const categorySuggestions = ref([])
const categoryHighlighted = ref(-1)
const categoryLoading = ref(false)
let catTimer = null

function addIngredientRow(prefill = {}) {
  const idx = ingredients.length
  ingredients.push({
    ingredient_id: prefill.ingredient_id || '',
    name: prefill.name || '',
    quantity: prefill.quantity || '',
    tempId: Date.now() + Math.random(),
  })
  suggestionsMap[idx] = []
  highlightedMap[idx] = -1
}

// remove ingredient row
function removeIngredientRow(index) {
  if (timers[index]) { clearTimeout(timers[index]); delete timers[index] }
  ingredients.splice(index, 1)
  rebuildSuggestionMaps()
}

function rebuildSuggestionMaps() {
  const newS = {}
  const newH = {}
  for (let i = 0; i < ingredients.length; i++) {
    newS[i] = suggestionsMap[i] || []
    newH[i] = highlightedMap[i] ?? -1
  }
  Object.keys(suggestionsMap).forEach(k => delete suggestionsMap[k])
  Object.keys(highlightedMap).forEach(k => delete highlightedMap[k])
  Object.assign(suggestionsMap, newS)
  Object.assign(highlightedMap, newH)
}

// input handlers for ingredient suggestion
function onIngredientInput(index) {
  const q = (ingredients[index].name || '').trim()
  if (ingredients[index].ingredient_id) ingredients[index].ingredient_id = ''
  if (!q) { suggestionsMap[index] = []; return }
  if (timers[index]) clearTimeout(timers[index])
  loadingSuggestions[index] = false
  timers[index] = setTimeout(async () => {
    loadingSuggestions[index] = true
    suggestionsMap[index] = await lookups.fetchIngredientSuggestions(q, 8)
    highlightedMap[index] = -1
    loadingSuggestions[index] = false
    delete timers[index]
  }, 250)
}

function selectIngredientSuggestion(index, s) {
  ingredients[index].name = s.name
  ingredients[index].ingredient_id = s.id
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
  if (cur >= 0 && cur < list.length) selectIngredientSuggestion(index, list[cur])
}
function clearSuggestions(index) {
  suggestionsMap[index] = []
  highlightedMap[index] = -1
}
function getActiveDescendantId(index) {
  const cur = highlightedMap[index] ?? -1
  return cur >= 0 ? `ing-${index}-${cur}` : null
}

// categories
function addCategoryFromInput() {
  const name = (categoryQuery.value || '').trim()
  if (!name) return
  categories.push({ name, tempId: Date.now() + Math.random() })
  categoryQuery.value = ''
  categorySuggestions.value = []
}
function addCategoryFromSuggestion(s) {
  categories.push({ category_id: s.id, name: s.name, tempId: Date.now() + Math.random() })
  categoryQuery.value = ''
  categorySuggestions.value = []
}
function removeCategory(i) { categories.splice(i, 1) }

function onCategoryQuery() {
  const q = (categoryQuery.value || '').trim()
  if (!q) { categorySuggestions.value = []; return }
  if (catTimer) clearTimeout(catTimer)
  categoryLoading.value = true
  catTimer = setTimeout(async () => {
    categorySuggestions.value = await lookups.getCategorySuggestions(q)
    categoryHighlighted.value = -1
    categoryLoading.value = false
    catTimer = null
  }, 250)
}

function highlightCategoryNext() {
  const list = categorySuggestions.value || []
  if (!list.length) return
  categoryHighlighted.value = Math.min(categoryHighlighted.value + 1, list.length - 1)
}
function highlightCategoryPrev() {
  const list = categorySuggestions.value || []
  if (!list.length) return
  categoryHighlighted.value = Math.max(categoryHighlighted.value - 1, 0)
}
function addCategoryHighlighted() {
  const idx = categoryHighlighted.value
  if (idx >= 0 && idx < (categorySuggestions.value || []).length) {
    addCategoryFromSuggestion(categorySuggestions.value[idx])
  } else {
    addCategoryFromInput()
  }
}
function clearCategorySuggestions() {
  categorySuggestions.value = []
  categoryHighlighted.value = -1
}
function categoryActiveId() {
  return categoryHighlighted.value >= 0 ? `cat-${categoryHighlighted.value}` : null
}

// load initial data
async function loadInitial() {
  loading.value = true
  try {

    await recipesStore.fetchRecipes()
    console.log('Current recipes:', recipesStore.recipes)
    const recipe = recipesStore.getRecipeById(id)
    console.log('Get recipe by ID:', id, recipe)
    if (!recipe) {
      error.value = 'Recipe not found'
      return
    }

    title.value = recipe.title || ''
    image_url.value = recipe.image_url || ''
    instructions.value = recipe.instructions || ''

    ingredients.splice(0)
    for (const ing of recipe.ingredients || []) {
      addIngredientRow({ ingredient_id: ing.id, name: ing.name, quantity: ing.quantity })
    }

    categories.splice(0)
    for (const c of recipe.categories || []) {
      categories.push({ category_id: c.id, name: c.name, tempId: Date.now() + Math.random() })
    }

    await lookups.loadCategories().catch(() => { })
  } catch (err) {
    console.error(err); error.value = 'Failed to load recipe'
  } finally {
    loading.value = false
  }
}

// build payload & submit
function buildPayload() {
  const payload = {}
  if (title.value) payload.title = title.value
  if (instructions.value) payload.instructions = instructions.value
  if (image_url.value) payload.image_url = image_url.value

  if (ingredients.length) {
    payload.ingredients = ingredients.map(ing => {
      if (ing.ingredient_id) return { ingredient_id: ing.ingredient_id, quantity: ing.quantity || null }
      return { name: (ing.name || '').trim(), quantity: ing.quantity || null }
    })
  }

  if (categories.length) {
    payload.categories = categories.map(c => c.category_id ? { category_id: c.category_id } : { name: (c.name || '').trim() })
  }

  return payload
}

async function submit() {
  serverError.value = ''; success.value = ''; submitting.value = true
  try {
    const payload = buildPayload()
    const res = await api.put(`/recipes/${id}`, payload)
    success.value = res.data?.message || 'Recipe updated'
    // refresh store so details/list reflect changes
    await recipesStore.fetchRecipes()
    // redirect to details page
    router.push(`/recipes/${id}`)
  } catch (err) {
    console.error('Update failed', err)
    serverError.value = err.response?.data?.message || err.message || 'Update failed'
  } finally {
    submitting.value = false
  }
}

onMounted(loadInitial)
</script>

<style scoped>
.edit-recipe {
    max-width: 900px;
    margin: 20px auto;
    background: #fff;
    padding: 18px;
    border-radius: 8px;
    box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
}

.edit-recipe h2 {
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