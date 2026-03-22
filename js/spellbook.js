import { downloadJSON } from './utils.js';

export function persistSpellbook(spellbook) {
  const keys = spellbook.map(s => s._key);
  localStorage.setItem("sb-current", JSON.stringify(keys));
}

export function loadSpellbookFromStorage(allSpells) {
  try {
    const data = localStorage.getItem("sb-current");
    if (!data) return [];
    const keys = JSON.parse(data);
    const spellMap = new Map(allSpells.map(s => [s._key, s]));
    return keys.map(k => spellMap.get(k)).filter(Boolean);
  } catch (_) { return []; }
}

export function getSavedSpellbooks() {
  try {
    return JSON.parse(localStorage.getItem("sb-saved") || "[]");
  } catch (_) { return []; }
}

export function saveSpellbookToStorage(name, spellbook, theme) {
  const saved = getSavedSpellbooks();
  saved.push({
    id: Date.now(),
    name,
    date: new Date().toISOString(),
    spells: spellbook.map(s => s._key),
    theme,
  });
  localStorage.setItem("sb-saved", JSON.stringify(saved));
  return saved;
}

export function deleteSavedSpellbook(id) {
  const saved = getSavedSpellbooks().filter(s => s.id !== id);
  localStorage.setItem("sb-saved", JSON.stringify(saved));
}

export function loadSavedSpellbook(savedEntry, allSpells) {
  const spellMap = new Map(allSpells.map(s => [s._key, s]));
  return savedEntry.spells.map(k => spellMap.get(k)).filter(Boolean);
}

export function exportSpellbookJSON(spellbook, theme) {
  if (spellbook.length === 0) {
    alert("Spellbook is empty. Add spells first.");
    return;
  }

  const data = {
    type: "spellbook-export",
    version: 1,
    name: `Spellbook ${new Date().toLocaleDateString("en-US")}`,
    date: new Date().toISOString(),
    theme,
    spells: spellbook.map(s => s._key),
  };

  downloadJSON(data, "spellbook.json");
}

export function parseSpellbookImport(jsonText, allSpells) {
  const data = JSON.parse(jsonText);
  if (data.type !== "spellbook-export" || !Array.isArray(data.spells)) {
    throw new Error("Invalid file. Select a spellbook JSON exported from this app.");
  }

  const spellMap = new Map(allSpells.map(s => [s._key, s]));
  const loaded = data.spells.map(k => spellMap.get(k)).filter(Boolean);

  if (loaded.length === 0) {
    throw new Error("No matching spells found in this file.");
  }

  return { spells: loaded, theme: data.theme || null };
}
