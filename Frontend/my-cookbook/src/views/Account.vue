<template>
    <div class="account-page">
        <h1>My Account</h1>

        <section class="panel">
            <h2>Profile</h2>
            <p><strong>Username:</strong> {{ auth.username }}</p>
            <p><strong>User ID:</strong> {{ auth.userId }}</p>
            <EditUsernameEmail @updated="onUpdated" />
        </section>

        <section class="panel">
            <h2>Security</h2>
            <ChangePassword />
        </section>

        <section class="panel">
            <h2>Account</h2>
            <AccountDeletion @updated="onUpdated" />
        </section>
    </div>
</template>

<script setup>
import { useAuthStore } from '../stores/auth'
import EditUsernameEmail from '../components/account/EditUsernameEmail.vue'
import ChangePassword from '../components/account/ChangePassword.vue'
import AccountDeletion from '../components/account/AccountDeletion.vue'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()

function onUpdated() {
    // Reload current route to reflect changes
    router.go(0)
}
</script>

<style scoped>
.account-page {
    max-width: 900px;
    margin: 24px auto;
    padding: 12px;
}

.panel {
    background: #fff;
    padding: 16px;
    border-radius: 8px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.04);
    margin-bottom: 16px;
}

.panel h2 {
    margin-top: 0;
}
</style>