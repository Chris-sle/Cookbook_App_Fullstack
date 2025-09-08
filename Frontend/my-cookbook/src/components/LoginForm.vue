<template>
    <form class="login-form" @submit.prevent="submit">
        <div class="field">
            <label for="username">Username</label>
            <input id="username" v-model="username" type="text" required />
        </div>

        <div class="field">
            <label for="password">Password</label>
            <input id="password" v-model="password" type="password" required />
        </div>

        <div class="actions">
            <button type="submit" :disabled="loading">
                <span v-if="loading">Signing in…</span>
                <span v-else>Sign in</span>
            </button>
        </div>
        
        <p class="error" v-if="error">{{ error }}</p>
    </form>
</template>

<script setup>
import { ref } from 'vue'
import { defineEmits } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import api from '../services/api'

const emit = defineEmits(['success'])

const auth = useAuthStore()
const router = useRouter()

const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  loading.value = true
  try {
    const res = await api.post('/users/login', {
      username: username.value,
      password: password.value,
    })

    const token = res.data?.token
    if (!token) {
      throw new Error('No token returned from server')
    }

    // Save token (persisted to localStorage by the store)
    auth.setToken(token)

    // Notify parent that login succeeded so it can close the dropdown
    emit('success')
  } catch (err) {
    // Prefer server message if present
    error.value =
      err.response?.data?.message ||
      err.response?.data ||
      err.message ||
      'Login failed'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-form {
  min-width: 220px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-family: Arial, sans-serif;
  font-size: 0.9rem;
  color: #333;
}

.field {
  display: flex;
  flex-direction: column;
}

.field label {
  font-size: 0.85rem;
  margin-bottom: 4px;
  font-weight: bold;
}

.field input {
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.field input:focus {
  border-color: #007bff;
  outline: none;
}

.actions {
  display: flex;
  justify-content: flex-end;
}

button {
  padding: 6px 12px;
  border: none;
  background-color: #007bff;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: background-color 0.2s;
}

button:disabled {
  background-color: #999;
  cursor: not-allowed;
}

button:hover:enabled {
  background-color: #0056b3;
}

.error {
  color: red;
  font-size: 0.8rem;
  margin-top: 8px;
}
</style>