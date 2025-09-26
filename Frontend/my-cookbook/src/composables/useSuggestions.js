import { reactive, onBeforeUnmount } from 'vue'
import { useLookupsStore } from '../stores/lookups'

export function useSuggestions() {
  const lookups = useLookupsStore()

  // maps keyed by row index
  const suggestionsMap = reactive({})
  const highlightedMap = reactive({})
  const loadingSuggestions = reactive({})

  // per-index timers for debounce
  const timers = {}

  // helper to normalize index keys (we use plain indexes)
  function initRow(index) {
    suggestionsMap[index] = []
    highlightedMap[index] = -1
    loadingSuggestions[index] = false
  }

  function clearRow(index) {
    if (timers[index]) {
      clearTimeout(timers[index])
      delete timers[index]
    }
    delete suggestionsMap[index]
    delete highlightedMap[index]
    delete loadingSuggestions[index]
  }

  function rebuildMaps(length) {
    // rebuild to ensure keys 0..length-1 exist and old keys removed
    const newSuggestions = {}
    const newHighlighted = {}
    const newLoading = {}
    for (let i = 0; i < length; i++) {
      newSuggestions[i] = suggestionsMap[i] || []
      newHighlighted[i] = highlightedMap[i] ?? -1
      newLoading[i] = loadingSuggestions[i] ?? false
    }
    // clear old
    Object.keys(suggestionsMap).forEach(k => delete suggestionsMap[k])
    Object.keys(highlightedMap).forEach(k => delete highlightedMap[k])
    Object.keys(loadingSuggestions).forEach(k => delete loadingSuggestions[k])
    Object.assign(suggestionsMap, newSuggestions)
    Object.assign(highlightedMap, newHighlighted)
    Object.assign(loadingSuggestions, newLoading)
  }

  // onInput: type = 'ingredient' | 'category'
  // setIngredientIdNull is a callback the form will pass to clear ingredient_id if user types after selecting a suggestion
  function onInput(index, value, { type = 'ingredient', setIdNull = null } = {}) {
    const q = (value || '').trim()

    // if user changed after selection, clear stored id
    if (typeof setIdNull === 'function') setIdNull()

    // empty -> clear suggestions and cancel timer
    if (!q) {
      if (timers[index]) {
        clearTimeout(timers[index])
        delete timers[index]
      }
      suggestionsMap[index] = []
      highlightedMap[index] = -1
      loadingSuggestions[index] = false
      return
    }

    // Debounce: for ingredients we use 250ms, categories can be shorter (but we'll use 200ms)
    const delay = type === 'ingredient' ? 250 : 150

    if (timers[index]) {
      clearTimeout(timers[index])
    }

    timers[index] = setTimeout(async () => {
      delete timers[index]
      try {
        loadingSuggestions[index] = true
        if (type === 'ingredient') {
          const items = await lookups.fetchIngredientSuggestions(q, 10)
          suggestionsMap[index] = items || []
        } else {
          // categories: use client-side filtered list
          const items = await lookups.getCategorySuggestions(q)
          suggestionsMap[index] = items || []
        }
        highlightedMap[index] = -1
      } catch (err) {
        console.error('Suggestion fetch error', err)
        suggestionsMap[index] = []
        highlightedMap[index] = -1
      } finally {
        loadingSuggestions[index] = false
      }
    }, delay)
  }

  function highlightNext(index) {
    const list = suggestionsMap[index] || []
    if (!list.length) return
    let cur = highlightedMap[index] ?? -1
    cur = Math.min(cur + 1, list.length - 1)
    highlightedMap[index] = cur
  }

  function highlightPrev(index) {
    const list = suggestionsMap[index] || []
    if (!list.length) return
    let cur = highlightedMap[index] ?? -1
    cur = Math.max(cur - 1, 0)
    highlightedMap[index] = cur
  }

  function selectHighlighted(index) {
    const list = suggestionsMap[index] || []
    const cur = highlightedMap[index] ?? -1
    if (cur >= 0 && cur < list.length) {
      return list[cur]
    }
    return null
  }

  function clearAllSuggestions() {
    for (const k in suggestionsMap) {
      suggestionsMap[k] = []
      highlightedMap[k] = -1
    }
  }

  onBeforeUnmount(() => {
    for (const k in timers) {
      clearTimeout(timers[k])
    }
  })

  return {
    suggestionsMap,
    highlightedMap,
    loadingSuggestions,
    initRow,
    clearRow,
    rebuildMaps,
    onInput,
    highlightNext,
    highlightPrev,
    selectHighlighted,
    clearAllSuggestions,
  }
}