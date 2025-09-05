<template>
  <div class="user-menu" @click="toggleMenu" ref="menuRef">
    <!-- Button to toggle dropdown -->
    <button class="menu-button">
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
import { ref, computed, onClickOutside } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'

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
  router.push('/') // or wherever
}

// Detect outside click
onClickOutside(menuRef, () => {
  closeMenu()
})

const isAuthenticated = computed(() => auth.isAuthenticated)
</script>

<style scoped>
.user-menu {
  position: relative;
  display: inline-block;
}
.menu-button {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
}
.dropdown {
  position: absolute;
  right: 0;
  top: 100%;
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 4px;
  min-width: 150px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
}
.dropdown a, .dropdown button {
  padding: 0.5rem 1rem;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  width: 100%;
}
.dropdown a:hover,
.dropdown button:hover {
  background-color: #f0f0f0;
}
</style>