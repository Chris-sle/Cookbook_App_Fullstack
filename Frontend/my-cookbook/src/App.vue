<template>
  <div id="app">
    <header class="app-header">
      <h1>Cookbook</h1>
      <nav>
        <router-link to="/recipes">Recipes</router-link>
        <router-link to="/recipes/add">Add Recipe</router-link>
        <router-link to="/favorites">Favorites</router-link>
      </nav>
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
import { onMounted } from 'vue'
import { useRecipesStore } from './stores/recipes'

const recipesStore = useRecipesStore()

onMounted(() => {
  // Try to fetch recipes; fetchRecipes will no-op if cache exists
  recipesStore.fetchRecipes().catch((err) => {
    // error is saved in the store; optionally handle/log here
    console.error('Initial fetch failed', err)
  })
})
</script>