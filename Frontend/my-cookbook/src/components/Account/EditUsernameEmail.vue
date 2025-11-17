<template>
    <div class="edit-username-email">
        <form @submit.prevent="submit">
            <div class="row">
                <label>Username</label>
                <input v-model="username" />
            </div>

            <div class="row">
                <label>New email</label>
                <input v-model="email" type="email" />
            </div>

            <div class="actions">
                <button :disabled="loading">Save</button>
            </div>

            <p class="success" v-if="success">{{ success }}</p>
            <p class="error" v-if="error">{{ error }}</p>

            <p v-if="emailRequested" class="info">
                A confirmation email has been sent to <strong>{{ requestedEmail }}</strong>. The email will update after
                confirmation.
            </p>
        </form>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import api from '../../services/api'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const loading = ref(false)
const error = ref('')
const success = ref('')
const emailRequested = ref(false)
const requestedEmail = ref('')

const username = ref(auth.username || '')
const email = ref('') // new email

async function submit() {
    error.value = ''
    success.value = ''
    emailRequested.value = false
    loading.value = true
    try {
        // only send changed fields
        const body = {}
        if (username.value && username.value !== auth.username) body.username = username.value
        if (email.value) body.email = email.value

        if (Object.keys(body).length === 0) {
            success.value = 'No changes'
            loading.value = false
            return
        }

        const res = await api.put(`/users/${auth.userId}`, body)
        success.value = res.data?.message || 'User updated'

        // If email change requested, backend should send confirmation — show notice
        if (body.email) {
            emailRequested.value = true
            requestedEmail.value = body.email
        }

        // If username changed, update store
        if (body.username) {
            auth.setUser({ userId: auth.userId, username: body.username })
        }

        // emit update to parent if needed
        // emit('updated') // not using emits in script-setup here
    } catch (err) {
        error.value = err.response?.data?.message || err.message || 'Update failed'
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

.info {
    color: #444;
    margin-top: 8px;
    background: #f8fafc;
    padding: 8px;
    border-radius: 6px;
}
</style>