<template>
    <button @click="logout">Logout</button>
</template>

<script setup>
import { useAuthStore } from '../stores/auth'
import api from '../services/api'

const auth = useAuthStore()

async function logout() {
    try {
        await api.post('/auth/logout')
    } catch (err) {
        console.warn('Logout API call failed:', err)
    }
    auth.clearToken()
}
</script>