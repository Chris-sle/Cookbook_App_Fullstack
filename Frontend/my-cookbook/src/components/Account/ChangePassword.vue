<template>
    <div class="change-password">
        <form @submit.prevent="submit">
            <div class="row"><label>Current password</label><input type="password" v-model="oldPassword" /></div>
            <div class="row"><label>New password</label><input type="password" v-model="newPassword" /></div>
            <div class="row"><label>Confirm new password</label><input type="password" v-model="confirmPassword" />
            </div>

            <div class="actions">
                <button :disabled="loading">Change password</button>
            </div>

            <p class="success" v-if="success">{{ success }}</p>
            <p class="error" v-if="error">{{ error }}</p>
        </form>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import api from '../../services/api'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const success = ref('')
const error = ref('')

async function submit() {
    error.value = ''
    success.value = ''
    if (!oldPassword.value || !newPassword.value) {
        error.value = 'Fill both fields'
        return
    }
    if (newPassword.value !== confirmPassword.value) {
        error.value = 'Passwords do not match'
        return
    }
    loading.value = true
    try {
        const res = await api.post(`/users/${auth.userId}/change-password`, {
            oldPassword: oldPassword.value,
            newPassword: newPassword.value
        })
        success.value = res.data?.message || 'Password changed'
        oldPassword.value = newPassword.value = confirmPassword.value = ''
    } catch (err) {
        error.value = err.response?.data?.message || err.message || 'Change failed'
    } finally {
        loading.value = false
    }
}
</script>

<style scoped>
.row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 10px;
}

.actions {
    display: flex;
    justify-content: flex-end;
}

button {
    padding: 8px 12px;
    border-radius: 6px;
    background: #007bff;
    color: #fff;
    border: none;
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