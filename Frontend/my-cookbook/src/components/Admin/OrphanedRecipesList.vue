<template>
    <div class="orphaned-recipes-list">
        <h2>Orphaned Recipes</h2>

        <div v-if="loading">Loading...</div>
        <div v-if="error" class="error">{{ error }}</div>

        <table v-if="!loading && recipes.length">
            <thead>
                <tr>
                    <th>Recipe ID</th>
                    <th>Title</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="recipe in recipes" :key="recipe.id">
                    <td>{{ recipe.id }}</td>
                    <td>{{ recipe.title }}</td>
                    <td>
                        <router-link :to="`/admin/recipes/${recipe.id}/edit`">Edit</router-link>
                    </td>
                </tr>
            </tbody>
        </table>

        <div v-if="!loading && !recipes.length">No orphaned recipes found.</div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../../services/api'

const recipes = ref([])
const loading = ref(false)
const error = ref('')

async function loadOrphanedRecipes() {
    loading.value = true
    error.value = ''
    try {
        const res = await api.get('/admin/orphaned-recipes')
        recipes.value = res.data.data || []
    } catch (err) {
        error.value = err.response?.data?.message || err.message || 'Failed to load orphaned recipes'
    } finally {
        loading.value = false
    }
}

onMounted(loadOrphanedRecipes)

</script>