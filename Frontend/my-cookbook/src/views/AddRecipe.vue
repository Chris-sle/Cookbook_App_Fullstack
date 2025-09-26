<template>
  <AddRecipeForm />
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import AddRecipeForm from '../components/AddRecipe/AddRecipeForm.vue'

const router = useRouter()
const auth = useAuthStore()

onMounted(() => {
  if (!auth.isAuthenticated) {
    router.push('/login')
  }
})
</script>