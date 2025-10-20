<template>
  <div class="vote-wrap" :aria-busy="loading ? 'true' : 'false'">
    <button
      class="vote-btn up"
      :class="{ active: myVote === 1, busy: loading }"
      @click="onUpClick"
      :title="myVote === 1 ? 'Remove upvote' : 'Upvote'"
    >
      <span class="icon">▲</span>
      <span class="count">{{ upvotes }}</span>
    </button>

    <div class="score" :class="{ positive: score>0, negative: score<0 }">{{ score }}</div>

    <button
      class="vote-btn down"
      :class="{ active: myVote === -1, busy: loading }"
      @click="onDownClick"
      :title="myVote === -1 ? 'Remove downvote' : 'Downvote'"
    >
      <span class="icon">▼</span>
      <span class="count">{{ downvotes }}</span>
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()

// Watch for token changes
watch(() => auth.token, (newToken) => {
  if (newToken) {
    // User logged in: fetch vote info
    fetchVotes()
  } else {
    // User logged out: reset myVote
    myVote.value = 0
  }
})

// Also, fetch on mount if token is already available
onMounted(() => {
  if (auth.token) {
    fetchVotes()
  }
})


const { recipeId } = defineProps({ recipeId: { type: Number, required: true } })

const upvotes = ref(0)
const downvotes = ref(0)
const score = ref(0)
const myVote = ref(0)
const loading = ref(false)

// load current vote info
async function fetchVotes() {
  try {
    const res = await api.get(`/recipes/activity/${recipeId}/vote`)
    console.log('Vote data:', res.data)
    downvotes.value = res.data.downvotes || 0
    upvotes.value = res.data.upvotes || 0
    score.value = res.data.score || 0
    // only update myVote if present (user logged in)
    if ('my_vote' in res.data) myVote.value = res.data.my_vote
    console.log('My vote:', myVote.value)
  } catch (err) {
    // possibly user not logged in or API error
    // fallback: keep myVote as is or set to 0
    console.warn('Failed to fetch vote info:', err)
  }
}

// cast or remove vote: clicking active toggles to 0
async function castVote(vote) {
  if (loading.value) return
  loading.value = true
  try {
    const res = await api.post(`/recipes/activity/${recipeId}/vote`, { vote })
    // Update counts
    upvotes.value = res.data.upvotes
    downvotes.value = res.data.downvotes
    score.value = res.data.score
    // Update local vote state to reflect UI immediately
    myVote.value = res.data.my_vote
  } catch (err) {
    console.error('Vote error:', err)
  } finally {
    loading.value = false
  }
}

function onUpClick() {
  const target = myVote.value === 1 ? 0 : 1
  castVote(target)
}
function onDownClick() {
  const target = myVote.value === -1 ? 0 : -1
  castVote(target)
}

onMounted(fetchVotes)
</script>

<style scoped>
.vote-wrap {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  padding: 6px 8px;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}

.vote-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: linear-gradient(180deg,#ffffff,#f7fbff);
  cursor: pointer;
  transition: transform .12s ease, box-shadow .12s ease, background .12s;
  font-weight: 600;
  color: #334155;
}
.vote-btn .icon { font-size: 0.9rem; line-height: 1; }
.vote-btn .count { font-size: 0.95rem; min-width: 28px; text-align: center; }

.vote-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 12px rgba(16,24,40,0.06); }

.vote-btn.up.active {
  background: linear-gradient(180deg,#ecfdf5,#dcfce7);
  border-color: #86efac;
  color: #166534;
  box-shadow: 0 6px 18px rgba(16,185,129,0.06);
}
.vote-btn.down.active {
  background: linear-gradient(180deg,#fff1f2,#ffe4e6);
  border-color: #fca5a5;
  color: #7f1d1d;
  box-shadow: 0 6px 18px rgba(239,68,68,0.06);
}

.vote-btn.busy {
  opacity: 0.6;
  pointer-events: none;
}

.score {
  font-weight: 700;
  min-width: 48px;
  text-align: center;
  padding: 4px 8px;
  border-radius: 999px;
  background: linear-gradient(180deg,#f8fafc,#ffffff);
  color: #0f172a;
}
.score.positive { color: #166534; }
.score.negative { color: #7f1d1d; }
</style>