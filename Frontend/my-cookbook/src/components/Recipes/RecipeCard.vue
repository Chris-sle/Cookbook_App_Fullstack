<template>
  <div class="recipe-card" @click="$emit('click', recipe.id)">
    <div class="card-image">
      <img :src="recipe.image_url || placeholderImage" :alt="recipe.title" />
    </div>
    <div class="card-content">
      <h3 class="title">{{ recipe.title }}</h3>
      <div class="categories">
        <span v-for="cat in recipe.categories" :key="cat.id" class="category">
          {{ cat.name }}
        </span>
      </div>
      <div class="author">By {{ recipe.author_username }}</div>
      <div class="vote-section">
        <UpDownVoteButtons :recipeId="recipe.id" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps } from 'vue'
import UpDownVoteButtons from '../UpDownVoteButtons.vue'

const props = defineProps({
  recipe: {
    type: Object,
    required: true,
  },
  placeholderImage: {
    type: String,
    default: 'https://via.placeholder.com/300x200?text=No+Image',
  },
})
</script>

<style scoped>
.recipe-card {
  cursor: pointer;
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
  overflow: hidden;
  background-color: #fff;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s, box-shadow 0.2s;
}
.recipe-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 16px rgba(0,0,0,0.15);
}
.card-image img {
  width: 100%;
  height: 180px;
  object-fit: cover;
}
.card-content {
  padding: 15px;
}
.title {
  margin: 0 0 8px;
  font-size: 1.2rem;
  font-weight: bold;
}
.categories {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.category {
  background-color: #f0f0f0;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.85rem;
}
.author {
  font-size: 0.8rem;
  color: #555;
  margin-bottom: 10px;
}
.vote-section {
  display: flex;
  justify-content: center;
}
</style>