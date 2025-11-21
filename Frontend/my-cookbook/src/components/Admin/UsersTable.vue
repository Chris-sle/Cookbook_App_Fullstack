<template>
    <div class="users-list">
        <h2>Users</h2>
        <div v-if="loading">Loading users...</div>
        <div v-if="error" class="error">{{ error }}</div>
        <table v-if="!loading && !error" class="user-table">
            <thead>
                <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Created At</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="u in users" :key="u.id">
                    <td>{{ u.username }}</td>
                    <td>{{ u.email }}</td>
                    <td>{{ u.isAdmin ? 'Admin' : 'User' }}</td>
                    <td>{{ u.status || 'Active' }}</td>
                    <td>{{ u.created_at }}</td>
                    <td class="actions-column">
                        <button @click="banUser(u)">Ban</button>
                        <button @click="promoteUser(u)">Promote</button>
                        <button @click="deleteUser(u)">Delete</button>
                    </td>
                </tr>
            </tbody>
        </table>
        <!-- Pagination Controls -->
        <div class="pagination">
            <button @click="prevPage" :disabled="page <= 1">Prev</button>
            <span>Page {{ page }} of {{ totalPages }}</span>
            <button @click="nextPage" :disabled="page >= totalPages">Next</button>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '../../services/api'
import { useRouter } from 'vue-router'

const users = ref([])
const error = ref('')
const loading = ref(false)

const page = ref(1)
const limit = 10
const totalUsers = ref(0)

const totalPages = computed(() => Math.ceil(totalUsers.value / limit))
const router = useRouter()

async function loadUsers() {
    loading.value = true
    error.value = ''
    try {
        const res = await api.get('/admin/users', { params: { page: page.value, limit } })
        users.value = res.data.data || []
        totalUsers.value = res.data.meta?.total || 0
    } catch (err) {
        error.value = err.response?.data?.message || err.message || 'Failed to load users'
    } finally {
        loading.value = false
    }
}

function prevPage() {
    if (page.value > 1) {
        page.value--
        loadUsers()
    }
}
function nextPage() {
    if (page.value < totalPages.value) {
        page.value++
        loadUsers()
    }
}

// Helper to confirm actions
function confirmAction(message) {
    return window.confirm(message)
}

// Admin actions: Ban, Promote, Delete
async function banUser(user) {
    if (!confirmAction(`Ban user "${user.username}"?`)) return
    try {
        await api.post(`/admin/users/${user.id}/ban`)
        alert('User banned')
        loadUsers()
    } catch (err) {
        alert(err.response?.data?.message || err.message)
    }
}

async function promoteUser(user) {
    if (!confirmAction(`Promote user "${user.username}" to admin?`)) return
    try {
        await api.post(`/admin/promote/${user.id}`)
        alert('User promoted to admin')
        loadUsers()
    } catch (err) {
        alert(err.response?.data?.message || err.message)
    }
}

async function deleteUser(user) {
    if (!confirmAction(`Delete user "${user.username}"? This action cannot be undone.`)) return
    try {
        await api.delete(`/admin/users/${user.id}`)
        alert('User deleted')
        loadUsers()
    } catch (err) {
        alert(err.response?.data?.message || err.message)
    }
}

onMounted(loadUsers)
</script>

<style scoped>
.users-list {
    max-width: 1000px;
    margin: 20px auto;
}

h2 {
    margin-bottom: 16px;
    font-size: 1.5rem;
}

.user-table {
    width: 100%;
    border-collapse: collapse;
    background: #fff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.04);
}

thead {
    background: #f0f0f0;
}

th,
td {
    padding: 12px 16px;
    border-bottom: 1px solid #e0e0e0;
    font-size: 0.95rem;
}

th {
    font-weight: 600;
    text-align: left;
}

td.actions-column {
    display: flex;
    gap: 8px;
}

button {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.9rem;
}

button:hover {
    opacity: 0.9;
}

button:nth-child(1) {
    background: #ef4444;
    color: #fff;
}

button:nth-child(2) {
    background: #3b82f6;
    color: #fff;
}

button:nth-child(3) {
    background: #4b5563;
    color: #fff;
}
</style>