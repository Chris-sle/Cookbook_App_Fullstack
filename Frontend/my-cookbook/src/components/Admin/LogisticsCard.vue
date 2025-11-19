<template>
    <div class="logistics">
        <h2>Admin Dashboard</h2>
        <div class="stats">
            <div class="stat-card" v-for="(v, k) in stats" :key="k">
                <div class="label">{{ kLabels[k] || k }}</div>
                <div class="value">{{ v }}</div>
            </div>
        </div>
        <div v-if="error" class="error">{{ error }}</div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../../services/api'

const stats = ref({})
const error = ref('')
const kLabels = {
    totalUsers: 'Total Users',
    totalRecipes: 'Total Recipes',
    activeUsers: 'Active Users',
    favoritesCount: 'Favorites',
    pendingReports: 'Reports'
}

async function load() {
    error.value = ''
    try {
        const res = await api.get('/admin/logistics')
        stats.value = res.data || {}
    } catch (err) {
        console.error('Failed to load logistics', err)
        error.value = err.response?.data?.message || err.message || 'Failed to load'
    }
}

onMounted(load)
</script>

<style scoped>
.logistics {
    max-width: 1000px;
    margin: 20px auto;
    padding: 12px;
}

.stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
    margin-top: 12px;
}

.stat-card {
    background: #fff;
    padding: 12px;
    border-radius: 8px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.04);
    text-align: center;
}

.label {
    color: #666;
    font-size: 0.85rem;
}

.value {
    font-weight: 700;
    font-size: 1.6rem;
    margin-top: 6px;
}

.error {
    color: #b33;
    margin-top: 12px;
}
</style>