import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import Account from '../views/Account.vue'
import Recipes from '../views/Recipes.vue'
import AddRecipe from '../views/AddRecipe.vue'
import EditRecipe from '../views/EditRecipe.vue'
import RecipeDetails from '../views/RecipeDetails.vue'
import Favorites from '../views/Favorites.vue'
import { useAuthStore } from '../stores/auth' // if needed for route guards

const routes = [
  { path: '/', redirect: '/recipes' },
  { path: '/login', component: Login },
  { path: '/register', component: Register },
  { path: '/account', component: Account },
  { path: '/recipes', component: Recipes },
  { path: '/recipes/:id', component: RecipeDetails, props: true },
  { path: '/recipes/add', component: AddRecipe }, // protect in future if needed
  { path: '/recipes/edit/:id', component: EditRecipe, props: true }, // New route for editing recipes
  { path: '/favorites', component: Favorites },
  {
    path: '/admin',
    component: () => import('../views/AdminLayout.vue'),
    // optional meta flag for admin guard
    meta: { requiresAdmin: true },
    children: [
      { path: '', name: 'AdminHome', component: () => import('../components/Admin/LogisticsCard.vue') },
      { path: 'users', name: 'AdminUsers', component: () => import('../components/Admin/UsersTable.vue') },
      { path: 'orphaned', name: 'AdminOrphaned', component: () => import('../components/Admin/OrphanedRecipesList.vue') },
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Optional: Add navigation guards for protected routes
router.beforeEach((to, from, next) => {
  const authToken = localStorage.getItem('token') // quick check
  const protectedRoutes = ['/recipes/add', '/favorites']

  // simple auth-only pages
  if (protectedRoutes.includes(to.path) && !authToken) {
    return next('/login')
  }

  // admin-only routes by meta flag
  if (to.matched.some(record => record.meta?.requiresAdmin)) {
    const auth = useAuthStore()
    // if not logged in, send to login
    if (!auth.isAuthenticated) {
      return next('/login')
    }
    // if logged in but not admin, redirect (or show 403 page)
    if (!auth.isAdmin && auth.userId !== 'your-admin-fallback-id') {
      return next('/') // or next('/403') if you have a forbidden page
    }
  }

  // default
  next()
})

export default router