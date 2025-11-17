<template>
  <div class="user-menu" ref="menuRef">
    <!-- Button to toggle menu -->
    <button class="menu-button" @click.stop="toggleMenu">
      ☰ Profile
    </button>

    <!-- Dropdown menu -->
    <div v-if="menuOpen" class="dropdown">
      <!-- If logged in, show username and logout -->
      <div v-if="isAuthenticated" class="user-info">
        <div class="username">Hello, {{ auth.username }}</div>
        <router-link to="/account" @click="closeMenu">Account Settings</router-link>
        <logout-button />
      </div>
      <!-- If not logged in, show LoginForm and Register link -->
      <div v-else>
        <login-form @success="closeMenu" />
        <router-link to="/register" @click="closeMenu">Register</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import LoginForm from './LoginForm.vue'
import LogoutButton from './logoutButton.vue'

const auth = useAuthStore()
const router = useRouter()

const menuOpen = ref(false)
const menuRef = ref(null)

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}
function closeMenu() {
  menuOpen.value = false
}

// outside click detection
function handleDocumentClick(e) {
  const el = menuRef.value
  if (!el) return
  if (!el.contains(e.target)) {
    closeMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
})

const isAuthenticated = computed(() => auth.isAuthenticated)
</script>

<style scoped>
.user-menu {
  position: relative;
  display: inline-block;
}

.menu-button {
  background: #ffffff;
  border: 1px solid #ccc;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.2s, border-color 0.2s;
}
.menu-button:hover {
  background: #f0f0f0;
  border-color: #999;
}

.dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  min-width: 200px;
  z-index: 1000;
  padding: 8px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Show username and logout button when logged in */
.user-info {
  display: flex;
  flex-direction: column;
  padding: 0 12px;
  align-items: stretch;
}
.username {
  font-weight: bold;
  margin-bottom: 8px;
}
button {
  padding: 8px 12px;
  background-color: #007bff;
  color: #333;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: background-color 0.2s;
}
button:hover {
  background-color: #0056b3;
}

/* Styles for LoginForm inside dropdown placed here if needed, but you already have it */
</style>