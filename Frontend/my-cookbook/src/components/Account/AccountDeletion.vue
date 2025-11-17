<template>
    <div class="account-deletion">
        <p v-if="deletionDate">Account scheduled for deletion at <strong>{{ deletionDate }}</strong></p>
        <p v-else>Account is active. You can schedule deletion (this will be executed after grace period).</p>

        <div class="actions">
            <button v-if="!deletionDate" @click="schedule" :disabled="loading">Schedule deletion</button>
            <button v-else @click="reactivate" :disabled="loading">Reactivate account</button>
        </div>

        <p class="success" v-if="success">{{ success }}</p>
        <p class="error" v-if="error">{{ error }}</p>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../../services/api'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const loading = ref(false)
const deletionDate = ref(null)
const success = ref('')
const error = ref('')

async function loadStatus() {
    // If you have endpoint to get user status, call it. Otherwise skip.
    // Placeholder: assume no status endpoint; deletionDate remains null.
}

async function schedule() {
    if (!confirm('Schedule account deletion?')) return
    loading.value = true
    error.value = ''; success.value = ''
    try {
        const res = await api.post(`/users/${auth.userId}/delete`)
        deletionDate.value = res.data?.deletion_scheduled_at || null
        success.value = res.data?.message || 'Deletion scheduled'
    } catch (err) {
        error.value = err.response?.data?.message || err.message || 'Failed'
    } finally {
        loading.value = false
    }
}

async function reactivate() {
    loading.value = true
    error.value = ''; success.value = ''
    try {
        const res = await api.post(`/users/${auth.userId}/reactivate`)
        success.value = res.data?.message || 'Account reactivated'
        deletionDate.value = null
    } catch (err) {
        error.value = err.response?.data?.message || err.message || 'Failed'
    } finally {
        loading.value = false
    }
}

onMounted(loadStatus)
</script>

<style scoped>
.actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
}

button {
    padding: 8px 12px;
    border-radius: 6px;
    background: #ef4444;
    color: white;
    border: none;
    cursor: pointer;
}

button[disabled] {
    opacity: 0.6;
    cursor: not-allowed;
}

.error {
    color: #b33;
    margin-top: 8px;
}

.success {
    color: #19692c;
    margin-top: 8px;
}
</style>