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

        <div class="ingredient-row" v-for="(ing, idx) in ingredients" :key="ing.tempId">
          <div class="small-field">
            <label>Ingredient ID</label>
            <input v-model.number="ing.ingredient_id" type="number" min="1" required />
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

// Protect route (redirect to login if not authenticated)
onMounted(() => {
  if (!auth.isAuthenticated) {
    router.push('/login')
  }
})

const title = ref('')
const image_url = ref('')
const instructions = ref('')
const ingredients = reactive([]) // array of { ingredient_id, quantity, tempId }
const loading = ref(false)
const error = ref('')
const success = ref('')

// helper to add a new ingredient row
function addIngredientRow() {
  ingredients.push({
    ingredient_id: null,
    quantity: '',
    // tempId used so v-for has unique key even if ingredient_id is empty
    tempId: Date.now() + Math.random(),
  })
}

// remove row by index
function removeIngredientRow(index) {
  ingredients.splice(index, 1)
}

// basic client-side validation
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
    if (!ing.ingredient_id || isNaN(Number(ing.ingredient_id)) || Number(ing.ingredient_id) <= 0) {
      error.value = 'Each ingredient must have a valid ingredient_id (number)'
      return false
    }
  }
  return true
}

// submit handler - assemble payload and POST to API
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
      ingredient_id: Number(ing.ingredient_id),
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
    ingredients.splice(0) // clear array

    // Clear recipes cache so list will fetch fresh data next time
    if (recipesStore && recipesStore.clearCache) {
      recipesStore.clearCache()
    }

    // Redirect to recipes list
    router.push('/recipes')
  } catch (err) {
    // normalize error
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
</style>