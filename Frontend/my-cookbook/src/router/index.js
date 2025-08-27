import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import Recipes from '../views/Recipes.vue'
import AddRecipe from '../views/AddRecipe.vue'
import Favorites from '../views/Favorites.vue'
import { useAuthStore } from '../stores/auth' // if needed for route guards

const routes = [
  { path: '/', redirect: '/recipes' },
  { path: '/login', component: Login },
  { path: '/register', component: Register },
  { path: '/recipes', component: Recipes },
  { path: '/recipes/add', component: AddRecipe }, // protect in future if needed
  { path: '/favorites', component: Favorites },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Optional: Add navigation guards for protected routes
router.beforeEach((to, from, next) => {
  const auth = localStorage.getItem('token') // or use auth store
  const protectedRoutes = ['/recipes/add', '/favorites']
  if (protectedRoutes.includes(to.path) && !auth) {
    next('/login')
  } else {
    next()
  }
})

export default router