import { DATA_BASE } from './constants.js';

export async function loadSpellData() {
  const [indexRes, booksRes, adventuresRes, sourcesRes] = await Promise.all([
    fetch(`${DATA_BASE}/spells/index.json`).then(r => r.json()),
    fetch(`${DATA_BASE}/books.json`).then(r => r.json()),
    fetch(`${DATA_BASE}/adventures.json`).then(r => r.json()).catch(() => ({ adventure: [] })),
    fetch(`${DATA_BASE}/spells/sources.json`).then(r => r.json()),
  ]);

  const booksMap = {};
  for (const book of booksRes.book) {
    booksMap[book.source] = book.name;
  }
  for (const adv of (adventuresRes.adventure || [])) {
    if (!booksMap[adv.source]) booksMap[adv.source] = adv.name;
  }

  const spellFiles = Object.values(indexRes);
  const spellResults = await Promise.all(
    spellFiles.map(file => fetch(`${DATA_BASE}/spells/${file}`).then(r => r.json()))
  );

  const allSpells = [];
  for (const result of spellResults) {
    if (result.spell) {
      for (const spell of result.spell) {
        spell._classes = getSpellClasses(spell.name, spell.source, sourcesRes);
        spell._key = `${spell.name}|${spell.source}`;
        allSpells.push(spell);
      }
    }
  }

  allSpells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  return { allSpells, spellSources: sourcesRes, booksMap };
}

export async function loadGrimoireExtras() {
  const bestiaryFiles = ["bestiary-xphb.json", "bestiary-tce.json", "bestiary-ftd.json", "bestiary-bmt.json"];

  const [condRes, ...bestiaryResults] = await Promise.all([
    fetch(`${DATA_BASE}/conditionsdiseases.json`).then(r => r.json()).catch(() => ({ condition: [] })),
    ...bestiaryFiles.map(f =>
      fetch(`${DATA_BASE}/bestiary/${f}`).then(r => r.json()).catch(() => ({ monster: [] }))
    ),
  ]);

  const allConditions = condRes.condition || [];
  const allSummons = bestiaryResults.flatMap(res =>
    (res.monster || []).filter(m => m.summonedBySpell)
  );

  return { allConditions, allSummons };
}

export function getSpellClasses(spellName, source, spellSources) {
  const classes = new Set();
  const sourceData = spellSources[source];
  if (sourceData && sourceData[spellName]) {
    const entry = sourceData[spellName];
    if (entry.class) {
      for (const c of entry.class) classes.add(c.name);
    }
    if (entry.classVariant) {
      for (const c of entry.classVariant) classes.add(c.name);
    }
  }
  return classes;
}
