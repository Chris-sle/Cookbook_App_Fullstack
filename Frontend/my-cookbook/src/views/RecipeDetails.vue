<template>
    <div class="recipe-details">
        <div v-if="!recipe">Loading recipe…</div>
        <div v-else>
            <div class="header">
                <h1>{{ recipe.title }}</h1>
                <div class="meta">
                    <span class="author">By {{ recipe.author_username || 'Unknown' }}</span>
                    <div class="categories">
                        <span v-for="c in recipe.categories || []" :key="c.id" class="category">{{ c.name }}</span>
                    </div>
                </div>
            </div>

            <div class="top-row">
                <div class="image-section">
                    <img :src="recipe.image_url || placeholderImage" :alt="recipe.title" class="recipe-image" />
                </div>

                <div class="vote-section">
                    <UpDownVoteButtons :recipeId="recipe.id" />
                </div>
                <div v-if="isAuthorOrAdmin" class="action-box">
                    <RecipeActionsBox :recipeId="recipe.id" :recipeTitle="recipe.title" />
                </div>
            </div>

            <section class="ingredients">
                <h3>Ingredients</h3>
                <ul>
                    <li v-for="ing in recipe.ingredients || []" :key="ing.id">
                        {{ ing.name }}<span v-if="ing.quantity"> — {{ ing.quantity }}</span>
                    </li>
                </ul>
            </section>

            <section class="instructions">
                <h3>Instructions</h3>
                <p v-if="recipe.instructions">{{ recipe.instructions }}</p>
                <p v-else class="muted">No instructions provided.</p>
            </section>
        </div>
    </div>
</template>

<script setup>
import { onMounted, computed } from 'vue'
import { useRecipesStore } from '../stores/recipes'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import UpDownVoteButtons from '../components/UpDownVoteButtons.vue'
import RecipeActionsBox from '../components/RecipeActionsBox.vue'
import api from '../services/api'

const route = useRoute()
const { id } = route.params

const recipesStore = useRecipesStore()
const auth = useAuthStore()

const recipe = computed(() => recipesStore.getRecipeById(id))
const isAuthorOrAdmin = computed(() => {
    if (!recipe.value) return false
    return (
        auth.userId === recipe.value.author_id || auth.isAdmin
    )
})

console.log('Loaded recipe:', recipe.value)

const placeholderImage = 'https://via.placeholder.com/300x200?text=No+Image'

// Record click on mount
async function recordClick() {
    try {
        await api.post(`/recipes/activity/${id}/click`)
    } catch (err) {
        console.warn('Failed to record click:', err)
    }
}

if (recipe.value) {
    recordClick()
}
</script>

<style scoped>
.recipe-details {
    max-width: 1000px;
    margin: 20px auto;
    padding: 0 12px;
}

/* Header styles */
.header h1 {
    margin: 0 0 8px;
}

.meta {
    display: flex;
    gap: 12px;
    align-items: center;
    font-size: 0.9rem;
    color: #555;
    margin-bottom: 16px;
}

.categories .category {
    background: #f0f0f0;
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 0.85rem;
}

/* Main layout: side-by-side image + ingredients + vote */
.top-row {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
    align-items: flex-start;
    margin-bottom: 20px;
}

/* Image styling */
.image-section {
    flex: 1 1 250px;
}

.recipe-image {
    max-width: 300px;
    width: 100%;
    border-radius: 8px;
    object-fit: cover;
}

.vote-section {
    flex: 0 0 120px;
}

/* Ingredients list styling */
.ingredients-section {
    flex: 1 1 250px;
}

.ingredients-section ul {
    list-style: disc inside;
    margin: 0;
    padding: 0;
}

.ingredients-section li {
    margin-bottom: 4px;
}

/* Instructions styling */
.instructions {
    margin-top: 30px;
}

.instructions h3 {
    margin-bottom: 10px;
}

.instructions p {
    white-space: pre-wrap;
}

.muted {
    color: #888;
}
</style>