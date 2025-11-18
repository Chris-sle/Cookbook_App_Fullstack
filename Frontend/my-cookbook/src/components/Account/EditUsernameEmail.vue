<template>
    <div class="edit-username-email">
        <!-- USERNAME -->
        <div class="row">
            <label>Username</label>

            <div v-if="!editingUsername" class="display-row">
                <span class="value">{{ auth.username }}</span>
                <button type="button" class="link-btn" @click="startEdit('username')">Edit</button>
            </div>

            <div v-else class="edit-row">
                <input ref="usernameInput" v-model="username" />
                <div class="small-actions">
                    <button @click="saveUsername" :disabled="loading || username === auth.username">Save</button>
                    <button @click="cancelEdit('username')" class="secondary">Cancel</button>
                </div>
            </div>
        </div>

        <!-- EMAIL -->
        <div class="row">
            <label>New email</label>

            <div v-if="!editingEmail" class="display-row">
                <span class="value">{{ auth.email || '—' }}</span>
                <button type="button" class="link-btn" @click="startEdit('email')">Edit</button>
            </div>

            <div v-else class="edit-row">
                <input ref="emailInput" v-model="email" type="email" />
                <div class="small-actions">
                    <button @click="saveEmail" :disabled="loading || !validEmail(email)">Save</button>
                    <button @click="cancelEdit('email')" class="secondary">Cancel</button>
                </div>
            </div>
        </div>

        <p class="success" v-if="success">{{ success }}</p>
        <p class="error" v-if="error">{{ error }}</p>

        <p v-if="emailRequested" class="info">
            A confirmation email has been sent to <strong>{{ requestedEmail }}</strong>. The email will update after
            confirmation.
        </p>
    </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import api from '../../services/api'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()

const loading = ref(false)
const error = ref('')
const success = ref('')

const emailRequested = ref(false)
const requestedEmail = ref('')

// editing flags and local inputs
const editingUsername = ref(false)
const editingEmail = ref(false)

const username = ref(auth.username || '')
const email = ref('')

// refs for focusing
const usernameInput = ref(null)
const emailInput = ref(null)

function startEdit(field) {
    error.value = ''
    success.value = ''
    if (field === 'username') {
        username.value = auth.username || ''
        editingUsername.value = true
        nextTick(() => usernameInput.value?.focus())
    } else if (field === 'email') {
        email.value = ''
        editingEmail.value = true
        nextTick(() => emailInput.value?.focus())
    }
}

function cancelEdit(field) {
    error.value = ''
    success.value = ''
    if (field === 'username') {
        editingUsername.value = false
        username.value = auth.username || ''
    } else if (field === 'email') {
        editingEmail.value = false
        email.value = ''
    }
}

function validEmail(val) {
    if (!val) return false
    const p = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return p.test(val)
}

async function saveUsername() {
    if (username.value === auth.username) {
        success.value = 'No change'
        editingUsername.value = false
        return
    }
    loading.value = true
    error.value = ''
    try {
        const res = await api.put(`/users/${auth.userId}`, { username: username.value })
        success.value = res.data?.message || 'Username updated'
        auth.setUser({ userId: auth.userId, username: username.value })
        editingUsername.value = false
    } catch (err) {
        error.value = err.response?.data?.message || err.message || 'Update failed'
    } finally {
        loading.value = false
    }
}

async function saveEmail() {
    if (!validEmail(email.value)) {
        error.value = 'Please enter a valid email'
        return
    }
    loading.value = true
    error.value = ''
    success.value = ''
    try {
        const res = await api.put(`/users/${auth.userId}`, { email: email.value })
        success.value = res.data?.message || 'Email change requested'
        emailRequested.value = true
        requestedEmail.value = email.value
        editingEmail.value = false
        email.value = ''
    } catch (err) {
        error.value = err.response?.data?.message || err.message || 'Update failed'
    } finally {
        loading.value = false
    }
}
</script>

<style scoped>
.edit-username-email {
    display: block;
    gap: 10px;
}

.row {
    margin-bottom: 12px;
}

.display-row {
    display: flex;
    align-items: center;
    gap: 8px;
}

.value {
    font-weight: 500;
}

.link-btn {
    background: none;
    border: none;
    color: #007bff;
    cursor: pointer;
    padding: 4px;
}

.edit-row {
    display: flex;
    gap: 8px;
    align-items: center;
}

.small-actions {
    display: flex;
    gap: 8px;
}

button {
    padding: 6px 10px;
    border-radius: 6px;
    border: none;
    background: #007bff;
    color: #fff;
    cursor: pointer;
}

button.secondary {
    background: #f3f4f6;
    color: #111;
    border: 1px solid #ddd;
}

button:disabled {
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

.info {
    color: #444;
    margin-top: 8px;
    background: #f8fafc;
    padding: 8px;
    border-radius: 6px;
}

input {
    padding: 6px 8px;
    border-radius: 6px;
    border: 1px solid #ddd;
}
</style>