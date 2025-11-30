<template>
    <div v-if="open" class="modal-backdrop" @click.self="close">
        <div class="modal">
            <h3>Reassign Recipe</h3>
            <p>Recipe: <strong>{{ recipeTitle }}</strong></p>

            <div class="row autocomplete-field">
                <label>Search user</label>
                <input v-model="q" @input="onInput" @keydown.down.prevent="highlightNext"
                    @keydown.up.prevent="highlightPrev" @keydown.enter.prevent="applyHighlighted" autocomplete="off"
                    ref="inputEl" />
                <DropdownList v-if="suggestions.length" :items="suggestions" :highlightedIndex="highlighted"
                    :getItemId="i => `user-${i}`" :getActiveDescendantId="() => activeId()" :loading="loading"
                    @select="selectUser" />
            </div>

            <p v-if="selectedUser">Selected: <strong>{{ selectedUser.username }}</strong></p>

            <div class="actions">
                <button @click="submit" :disabled="!selectedUser || processing">Assign</button>
                <button class="secondary" @click="close">Cancel</button>
            </div>

            <p class="error" v-if="error">{{ error }}</p>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import api from '../../services/api'
import DropdownList from '../AddRecipe/DropdownList.vue' // your path

const props = defineProps({
    open: Boolean,
    recipeId: { type: String, required: true },
    recipeTitle: { type: String, default: '' }
})
const emit = defineEmits(['close', 'assigned'])

const q = ref('')
const suggestions = ref([])
const highlighted = ref(-1)
const loading = ref(false)
const inputEl = ref(null)
const selectedUser = ref(null)
const processing = ref(false)
const error = ref('')

let timer = null

function onInput() {
    const val = (q.value || '').trim()
    selectedUser.value = null
    if (timer) clearTimeout(timer)
    if (!val) { suggestions.value = []; return }
    loading.value = true
    timer = setTimeout(async () => {
        try {
            const res = await api.get('/admin/users', { params: { q: val, limit: 10 } })
            // assume endpoint returns data array or { data: [...] }
            suggestions.value = Array.isArray(res.data) ? res.data : (res.data?.data || [])
        } catch (err) {
            console.error(err)
            suggestions.value = []
        } finally {
            loading.value = false
        }
    }, 250)
}

function selectUser(user) {
    selectedUser.value = user
    q.value = user.username
    suggestions.value = []
}

function highlightNext() {
    if (!suggestions.value.length) return
    highlighted.value = Math.min(highlighted.value + 1, suggestions.value.length - 1)
}
function highlightPrev() {
    if (!suggestions.value.length) return
    highlighted.value = Math.max(highlighted.value - 1, 0)
}
function applyHighlighted() {
    const idx = highlighted.value
    if (idx >= 0 && idx < suggestions.value.length) selectUser(suggestions.value[idx])
}
function activeId() {
    return highlighted.value >= 0 ? `user-${highlighted.value}` : null
}

async function submit() {
    if (!selectedUser.value) return
    processing.value = true
    error.value = ''
    try {
        await api.post(`/admin/recipes/${props.recipeId}/assign-author`, { author_id: selectedUser.value.id })
        emit('assigned', selectedUser.value)
        close()
    } catch (err) {
        error.value = err.response?.data?.message || err.message || 'Assign failed'
    } finally {
        processing.value = false
    }
}

function close() {
    q.value = ''
    suggestions.value = []
    highlighted.value = -1
    selectedUser.value = null
    error.value = ''
    emit('close')
}
</script>

<style scoped>
.modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal {
    background: #fff;
    padding: 16px;
    border-radius: 8px;
    width: 420px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
}

.row {
    margin-bottom: 10px;
    position: relative;
}

.actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 12px;
}

button {
    padding: 8px 12px;
    border-radius: 6px;
    border: none;
    background: #007bff;
    color: #fff;
}

button.secondary {
    background: #f3f4f6;
    color: #111;
    border: 1px solid #ddd;
}

.error {
    color: #b33;
    margin-top: 8px;
}
</style>