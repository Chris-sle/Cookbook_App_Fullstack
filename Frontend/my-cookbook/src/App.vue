<template>
  <div id="app">
    <header class="app-header">
      <h1>Cookbook</h1>
      <nav>
        <router-link to="/recipes">Recipes</router-link>
        <router-link to="/recipes/add" v-if="isLoggedIn">Add Recipe</router-link>
        <router-link to="/favorites" v-if="isLoggedIn">Favorites</router-link>
        <router-link to="/admin" v-if="isAdmin">Admin Panel</router-link>
      </nav>
      <UserMenu style="margin-left:auto" />
    </header>

    <div class="global-status" v-if="recipesStore.loading || recipesStore.error">
      <span v-if="recipesStore.loading">Loading recipes...</span>
      <span v-else-if="recipesStore.error" class="error">Error: {{ recipesStore.error }}</span>
    </div>

    <main>
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { onMounted, computed } from 'vue'
import { useRecipesStore } from './stores/recipes'
import UserMenu from './components/userMenu.vue'
import { useAuthStore } from './stores/auth'

const recipesStore = useRecipesStore()
const auth = useAuthStore()

const isLoggedIn = computed(() => auth.isAuthenticated)
const isAdmin = computed(() => auth.isAdmin)
console.log('User is admin:', isAdmin.value)


onMounted(() => {
  recipesStore.fetchRecipes().catch((err) => {
    console.error('Initial fetch failed', err)
  })
})
</script>