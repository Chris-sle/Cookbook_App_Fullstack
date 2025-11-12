<template>
  <div class="actions-box">
    <button class="edit-btn" @click="editRecipe">Edit</button>
    <button class="delete-btn" @click="deleteRecipe">Delete</button>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import api from '../services/api'
import { ref } from 'vue'

const props = defineProps({
  recipeId: { type: String, required: true },
  // optional: maybe pass recipe title for confirmation
  recipeTitle: { type: String, default: '' },
  // optionally, recipe author or permissions info for permission logic
})

// for routing
const router = useRouter()

// delete logic
const isDeleting = ref(false)
async function deleteRecipe() {
  if (isDeleting) return
  if (!confirm(`Are you sure you want to delete "${props.recipeTitle || 'this recipe'}"?`)) return
  isDeleting.value = true
  try {
    await api.delete(`/recipes/${props.recipeId}`)
    alert('Recipe deleted')
    // redirect or refresh list
    router.back() // or emit event to parent to refresh
  } catch (err) {
    alert('Failed to delete recipe: ' + (err.response?.data?.message || err.message))
  } finally {
    isDeleting.value = false
  }
}

function editRecipe() {
  console.log('Editing recipe', props.recipeId)
  router.push(`/recipes/edit/${props.recipeId}`)
}
</script>

<style scoped>
.actions-box {
  display: flex;
  gap: 12px;
}
button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}
.edit-btn {
  background: #3b82f6; /* blue for edit */
  color: #fff;
}
.edit-btn:hover {
  background: #2563eb;
}
.delete-btn {
  background: #ef4444; /* red for delete */
  color: #fff;
}
.delete-btn:hover {
  background: #dc2626;
}
</style>