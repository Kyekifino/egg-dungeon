// Shared mutable game state. Imported as live bindings by game.js and render.js.
// Contains no logic — just the state containers and their setters.

export let G = null;
export function setG(newG) { G = newG; }

export let selectedFood = 'meat';
export function setSelectedFood(f) { selectedFood = f; }
