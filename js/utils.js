export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function rgbToHex(color) {
  if (!color) return "#000000";
  if (color.startsWith("#")) {
    if (color.length === 4) {
      return "#" + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
    }
    return color.slice(0, 7);
  }
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    const r = parseInt(match[1]).toString(16).padStart(2, "0");
    const g = parseInt(match[2]).toString(16).padStart(2, "0");
    const b = parseInt(match[3]).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }
  return "#000000";
}

export function lightenColor(hex, amount) {
  hex = hex.replace("#", "");
  const r = Math.min(255, parseInt(hex.substring(0, 2), 16) + amount);
  const g = Math.min(255, parseInt(hex.substring(2, 4), 16) + amount);
  const b = Math.min(255, parseInt(hex.substring(4, 6), 16) + amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => document.querySelectorAll(sel);

export function assignIndices(spells) {
  const levelCounters = {};
  spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  spells.forEach((spell, i) => {
    spell._globalIndex = i + 1;
    const lvl = spell.level;
    if (!levelCounters[lvl]) levelCounters[lvl] = 0;
    levelCounters[lvl]++;
    spell._levelIndex = levelCounters[lvl];
  });
}
