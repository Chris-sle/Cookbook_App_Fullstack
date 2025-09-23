<template>
  <div
    class="dropdown-list"
    role="listbox"
    :aria-activedescendant="getActiveDescendantId()"
    :aria-busy="loading ? 'true' : 'false'"
    aria-hidden="false"
  >
    <!-- Optional loading indicator -->
    <div v-if="loading" class="spinner"></div>
    <ul v-if="items && items.length" class="list">
      <li
        v-for="(item, index) in items"
        :key="item.id || item.name"
        :id="getItemId(index)"
        role="option"
        :aria-selected="index === highlightedIndex"
        :class="{ highlighted: index === highlightedIndex }"
        @mousedown.prevent="() => onItemSelect(item)"
      >
        {{ item.name }}
      </li>
    </ul>
    <div v-else class="no-items">No options</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

defineProps({
  items: Array,                  // list of options [{ id, name }]
  highlightedIndex: Number,      // current highlight index
  getItemId: Function,           // function to get id attribute for ARIA
  onItemSelect: Function,        // callback when item clicked / selected
  getActiveDescendantId: Function, // callback for aria-active descendant
  loading: Boolean,              // show spinner if loading
})

const emit = defineEmits(['select'])

function onItemSelect(item) {
  emit('select', item)
}
</script>

<style scoped>
.dropdown-list {
    position: absolute;
    top: 100%;           /* place immediately below the input */
    left: 0;
    right: 0;            /* match width of the parent (.autocomplete-field) */
    margin-top: 6px;     /* small gap so it doesn't touch the input */
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 6px;
    max-height: 200px;
    overflow-y: auto;
    box-shadow: 0 6px 18px rgba(15,23,42,0.06);
    box-sizing: border-box;
    z-index: 1000;       /* high enough to sit above other UI */
}
.list {
    list-style: none;
    margin: 0;
    padding: 0;
}
li {
    padding: 8px 12px;
    cursor: pointer;
}
li.highlighted {
    background-color: #f3f4f6;
}
.spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(0,0,0,0.12);
    border-top-color: rgba(0,0,0,0.45);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 8px auto;
}
@keyframes spin {
    to { transform: rotate(360deg); }
}
</style>