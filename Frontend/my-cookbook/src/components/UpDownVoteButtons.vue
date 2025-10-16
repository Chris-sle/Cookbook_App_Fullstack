<template>
  <div class="vote-container">
    <button
      class="vote-btn upvote"
      :class="{ active: myVote === 1 }"
      @click="castVote(1)"
    >
      ▲ Upvote ({{ upvotes }})
    </button>
    <div class="score">{{ score }}</div>
    <button
      class="vote-btn downvote"
      :class="{ active: myVote === -1 }"
      @click="castVote(-1)"
    >
      ▼ Downvote ({{ downvotes }})
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../services/api'

// Props
defineProps({ recipeId: { type: Number, required: true } })

// Local state
const upvotes = ref(0)
const downvotes = ref(0)
const score = ref(0)
const myVote = ref(0)
const loading = ref(false)

// Fetch vote data
async function fetchVotes() {
  try {
    const res = await api.get(`/recipes/${props.recipeId}/vote`)
    upvotes.value = res.data.upvotes
    downvotes.value = res.data.downvotes
    score.value = res.data.score
    myVote.value = res.data.my_vote
  } catch (err) {
    console.error('Failed to fetch votes:', err)
  }
}

// Cast a vote
async function castVote(vote) {
  if (loading.value) return
  loading.value = true
  try {
    const res = await api.post(`/recipes/${props.recipeId}/vote`, { vote })
    // Update local state with response
    upvotes.value = res.data.upvotes
    downvotes.value = res.data.downvotes
    score.value = res.data.score
    myVote.value = res.data.my_vote
  } catch (err) {
    console.error('Vote error:', err)
  } finally {
    loading.value = false
  }
}

onMounted(fetchVotes)
</script>

<style scoped>
.vote-container {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: center;
  font-family: Arial, sans-serif;
}
.vote-btn {
  background: transparent;
  border: 2px solid #ccc;
  border-radius: 4px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 1.2rem;
  transition: border-color 0.2s, background-color 0.2s;
}
.vote-btn:hover {
  background-color: #f0f0f0;
}
.vote-btn.active {
  border-color: #2e8b57;
  background-color: #d0f0d0;
}
.score {
  font-size: 1.4rem;
  font-weight: bold;
  min-width: 50px;
  text-align: center;
}
</style>