<template>
    <div class="recipes-view">
        <h1>Recipes</h1>
        <RecipeList />
    </div>
</template>

<script setup>
import RecipeList from '../components/Recipes/RecipeList.vue'
</script>

<style scoped>
.recipes-view {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px 12px;
}

.recipes-view h1 {
    margin: 0 0 16px;
    font-size: 1.5rem;
}
</style>