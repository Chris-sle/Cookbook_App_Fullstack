<template>
  <div class="register-page">
    <h2>Create account</h2>

    <form class="register-form" @submit.prevent="submit">
      <div class="field">
        <label for="username">Username</label>
        <input id="username" v-model="username" type="text" required />
      </div>

      <div class="field">
        <label for="email">Email</label>
        <input id="email" v-model="email" type="email" required />
      </div>

      <div class="field">
        <label for="password">Password</label>
        <input id="password" v-model="password" type="password" required minlength="6" />
      </div>

      <div class="actions">
        <button type="submit" :disabled="loading">
          <span v-if="loading">Registering…</span>
          <span v-else>Register</span>
        </button>
      </div>

      <p class="error" v-if="error">{{ error }}</p>
      <p class="success" v-if="success">{{ success }}</p>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const username = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

function validateInputs() {
  if (!username.value.trim()) {
    error.value = 'Username is required'
    return false
  }
  if (!email.value.trim()) {
    error.value = 'Email is required'
    return false
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailPattern.test(email.value)) {
    error.value = 'Email is invalid'
    return false
  }
  if (!password.value || password.value.length < 6) {
    error.value = 'Password must be at least 6 characters'
    return false
  }
  return true
}

/**
 * Register the user on the backend.
 * Returns the response data (e.g. { message, user_id })
 */
async function registerUser() {
  const payload = {
    username: username.value,
    email: email.value,
    password: password.value,
  }
  const res = await api.post('/users/register', payload)
  return res.data
}

/**
 * Login the user on the backend using same credentials.
 * Returns { token, user } per our backend contract.
 */
async function loginUser() {
  const res = await api.post('/auth/login', {
    username: username.value,
    password: password.value,
  })
  return res.data
}

/**
 * Persist token and user info into the auth store.
 * Accepts token and user (object with id and username).
 */
function persistAuth(token, user) {
  if (user) {
    auth.setToken(token, { userId: user.id, username: user.username })
  } else {
    auth.setToken(token)
  }
}

/**
 * Post-success cleanup and navigation.
 * Clears password and navigates to /recipes.
 */
function handleSuccess(message) {
  success.value = message || 'Registered successfully'
  // Clear password for security
  password.value = ''
  // Redirect to recipes
  router.push('/recipes')
}

/**
 * Handle failures: set error message and optionally redirect.
 */
function handleFailure(err, fallbackMessage = 'Registration failed') {
  console.error('Register flow error:', err)
  error.value =
    err?.response?.data?.message ||
    err?.response?.data ||
    err?.message ||
    fallbackMessage
}

/**
 * submit: orchestrates the registration + auto-login flow.
 */
async function submit() {
  error.value = ''
  success.value = ''

  if (!validateInputs()) return

  loading.value = true

  try {
    // 1) Register
    const regData = await registerUser()
    // show success message from server if present
    success.value = regData?.message || 'Registered successfully'

    // 2) Auto-login
    try {
      const loginData = await loginUser()
      const token = loginData?.token
      const user = loginData?.user

      if (!token) {
        // Auto-login failed — let user know and redirect to login
        handleFailure({ message: 'Auto-login failed: no token returned' }, 'Registered — please login')
        setTimeout(() => router.push('/login'), 900)
        return
      }

      // 3) Persist auth and navigate
      persistAuth(token, user)
      handleSuccess(success.value)
    } catch (loginErr) {
      // If auto-login failed, show message and redirect to login
      handleFailure(loginErr, 'Registered but auto-login failed. Please login manually.')
      setTimeout(() => router.push('/login'), 900)
    }
  } catch (err) {
    handleFailure(err)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.register-page {
  max-width: 480px;
  margin: 24px auto;
  background: #fff;
  padding: 18px;
  border-radius: 8px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
}

.register-page h2 {
  margin: 0 0 12px;
}

.register-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field {
  display: flex;
  flex-direction: column;
}

.field label {
  font-size: 0.9rem;
  margin-bottom: 6px;
  color: #333;
}

.field input {
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
}

.actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 6px;
}

button {
  padding: 8px 14px;
  border: none;
  border-radius: 6px;
  background: #007bff;
  color: white;
  cursor: pointer;
  font-weight: 600;
}

button:disabled {
  background: #9fbff3;
  cursor: not-allowed;
}

.error {
  color: #c0392b;
  font-size: 0.9rem;
  margin-top: 6px;
}

.success {
  color: #186a3b;
  font-size: 0.9rem;
  margin-top: 6px;
}
</style>