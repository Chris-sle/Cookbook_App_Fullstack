<template>
    <div class="admin-layout">
        <aside class="sidebar">
            <nav>
                <router-link to="/admin">Dashboard</router-link>
                <router-link to="/admin/users">Users</router-link>
                <router-link to="/admin/orphaned">Orphaned Recipes</router-link>
            </nav>
        </aside>
        <main class="content">
            <router-view />
        </main>
    </div>
</template>

<script setup>
</script>

<style scoped>
.admin-layout {
    display: flex;
    min-height: 100vh;
}

.sidebar {
    width: 220px;
    padding: 18px;
    background: #f8fafc;
    border-right: 1px solid #eee;
}

.content {
    flex: 1;
    padding: 18px;
}

.sidebar a {
    display: block;
    margin-bottom: 10px;
    color: #0f172a;
    text-decoration: none;
}
</style>