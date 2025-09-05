<template>
  <div class="user-menu" ref="menuRef">
    <!-- Button to toggle dropdown (stop propagation so document click doesn't immediately close it) -->
    <button class="menu-button" @click.stop="toggleMenu">
      ☰ Profile
    </button>

    <!-- Dropdown menu -->
    <div v-if="menuOpen" class="dropdown">
      <div v-if="!isAuthenticated">
        <router-link to="/login" @click="closeMenu">Login</router-link>
        <router-link to="/register" @click="closeMenu">Register</router-link>
      </div>
      <div v-else>
        <button @click="logout">Logout</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

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
function logout() {
  auth.clearToken()
  closeMenu()
  router.push('/') // or another route (placeholder home route here)
}

function handleDocumentClick(e) {
  const el = menuRef.value
  if (!el) return
  // If click is outside the menu element, close the menu
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
  min-width: 180px;
  z-index: 1000;
  padding: 8px 0;
  display: flex;
  flex-direction: column;
  margin-top: 4px;
}

.dropdown a,
.dropdown button {
  padding: 10px 16px;
  width: 100%;
  font-size: 0.95rem;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s;
}
.dropdown a:hover,
.dropdown button:hover {
  background-color: #f7f7f7;
  outline: none;
}

.dropdown a {
  text-decoration: none;
  color: #333;
}

.dropdown button {
  font: inherit;
  color: #333;
}

/* Optional separator line style */
.dropdown .separator {
  height: 1px;
  background: #eaeaea;
  margin: 8px 0;
}

/* Smooth transition for menu appearance (optional) */
</style>