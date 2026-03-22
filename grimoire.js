

import {
  SCHOOL_NAME_MAP, LEVEL_LABELS, THEME_LAYOUTS, THEME_SEPARATORS,
  PAGE_SIZES, LAYOUT_OPTIONS,
} from './js/constants.js';
import {
  sourceLabel, translateUnit, formatRange, formatComponents,
  formatDurationShort, formatEntries, formatTable, cleanTags,
} from './js/formatters.js';
import { chunkArray, rgbToHex, lightenColor, $, $$ } from './js/utils.js';
import { loadSpellData, loadGrimoireExtras } from './js/dataLoader.js';
import { applyCustomVars, loadSavedCustomVars, readCustomizeInputs, populateCustomizeInputs } from './js/themeManager.js';

// ---- State ----
let allSpells = [];
let allConditions = [];
let allSummons = [];
let spellSources = {};
let booksMap = {};
let spellbook = [];
let currentTheme = "medieval";

let grimSettings = {
  perPage: "auto",       // "auto" | 1 | 2 | 3 | 4 | 6
  layout: "auto",        // "auto" | "layout-single" | "layout-2row" etc.
  titleFontSize: 0,      // 0 = auto (use layout default)
  descFontSize: 0,       // 0 = auto
  pagePadding: 0,        // 0 = auto (12mm default)
  separatorGap: 0,       // 0 = auto (8mm default)
};

function loadGrimSettings() {
  try {
    const saved = localStorage.getItem("sb-grimoire-settings");
    if (saved) grimSettings = { ...grimSettings, ...JSON.parse(saved) };
  } catch (_) { /* ignore */ }
}

function saveGrimSettings() {
  localStorage.setItem("sb-grimoire-settings", JSON.stringify(grimSettings));
}

// ========================================
// DATA LOADING
// ========================================

async function init() {
  loadGrimSettings();

  const [spellData, extraData] = await Promise.all([
    loadSpellData(),
    loadGrimoireExtras(),
  ]);

  allSpells = spellData.allSpells;
  spellSources = spellData.spellSources;
  booksMap = spellData.booksMap;
  allConditions = extraData.allConditions;
  allSummons = extraData.allSummons;

  // Load spellbook from localStorage
  const keys = JSON.parse(localStorage.getItem("sb-current") || "[]");
  const spellMap = new Map(allSpells.map(s => [s._key, s]));

  // Check for custom grimoire order
  const grimOrder = JSON.parse(localStorage.getItem("sb-grimoire-order") || "null");
  if (grimOrder && Array.isArray(grimOrder)) {
    spellbook = grimOrder.map(k => spellMap.get(k)).filter(Boolean);
    // Add any spells that aren't in grimoire order but are in spellbook
    const inOrder = new Set(grimOrder);
    for (const k of keys) {
      if (!inOrder.has(k) && spellMap.has(k)) {
        spellbook.push(spellMap.get(k));
      }
    }
  } else {
    spellbook = keys.map(k => spellMap.get(k)).filter(Boolean);
    spellbook.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }

  // Theme
  const savedTheme = localStorage.getItem("sb-theme") || "medieval";
  currentTheme = savedTheme;
  $("#theme-select").value = savedTheme;
  rebuildBodyClasses();
  loadSavedCustomVars();

  initSettingsPanel();
  initEventListeners();

  updatePrintPageSize();
  $("#grimoire-loading").classList.add("hidden");
  renderGrimoire();
}


function initSettingsPanel() {
  const layoutSelect = $("#grim-layout");
  for (const opt of LAYOUT_OPTIONS) {
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    layoutSelect.appendChild(o);
  }

  layoutSelect.value = grimSettings.layout;
  $("#grim-title-size").value = grimSettings.titleFontSize || 0;
  $("#grim-title-size-val").textContent = grimSettings.titleFontSize || "Auto";
  $("#grim-desc-size").value = grimSettings.descFontSize || 0;
  $("#grim-desc-size-val").textContent = grimSettings.descFontSize || "Auto";
  $("#grim-page-padding").value = grimSettings.pagePadding || 0;
  $("#grim-page-padding-val").textContent = grimSettings.pagePadding ? `${grimSettings.pagePadding}mm` : "Auto";
  $("#grim-sep-gap").value = grimSettings.separatorGap || 0;
  $("#grim-sep-gap-val").textContent = grimSettings.separatorGap ? `${grimSettings.separatorGap}mm` : "Auto";

  layoutSelect.addEventListener("change", () => {
    grimSettings.layout = layoutSelect.value;
    const opt = LAYOUT_OPTIONS.find(o => o.value === layoutSelect.value);
    grimSettings.perPage = opt && opt.perPage ? opt.perPage : "auto";
    saveGrimSettings();
    renderGrimoire();
  });

  let renderTimeout;
  const triggerDebouncedRender = () => {
    clearTimeout(renderTimeout);
    renderTimeout = setTimeout(() => {
      renderGrimoire();
    }, 400);
  };

  $("#grim-title-size").addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    grimSettings.titleFontSize = val;
    $("#grim-title-size-val").textContent = val === 0 ? "Auto" : `${val}pt`;
    saveGrimSettings();
    applyGrimFontVars();
    triggerDebouncedRender();
  });

  $("#grim-desc-size").addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    grimSettings.descFontSize = val;
    $("#grim-desc-size-val").textContent = val === 0 ? "Auto" : `${val}pt`;
    saveGrimSettings();
    applyGrimFontVars();
    triggerDebouncedRender();
  });

  $("#grim-page-padding").addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    grimSettings.pagePadding = val;
    $("#grim-page-padding-val").textContent = val === 0 ? "Auto" : `${val}mm`;
    saveGrimSettings();
    applyGrimLayoutVars();
    triggerDebouncedRender();
  });

  $("#grim-sep-gap").addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    grimSettings.separatorGap = val;
    $("#grim-sep-gap-val").textContent = val === 0 ? "Auto" : `${val}mm`;
    saveGrimSettings();
    applyGrimLayoutVars();
    triggerDebouncedRender();
  });

  $("#grim-reset-settings").addEventListener("click", () => {
    grimSettings = { perPage: "auto", layout: "auto", titleFontSize: 0, descFontSize: 0, pagePadding: 0, separatorGap: 0 };
    saveGrimSettings();
    initSettingsPanel();
    clearGrimVars();
    renderGrimoire();
  });

  $("#btn-settings-toggle").addEventListener("click", () => {
    const panel = $("#grimoire-settings");
    panel.classList.toggle("open");
  });
  applyGrimFontVars();
  applyGrimLayoutVars();
}

function applyGrimFontVars() {
  const container = $("#pages-container");
  if (grimSettings.titleFontSize > 0) {
    container.style.setProperty("--grim-title-size", `${grimSettings.titleFontSize}pt`);
  } else {
    container.style.removeProperty("--grim-title-size");
  }
  if (grimSettings.descFontSize > 0) {
    container.style.setProperty("--grim-desc-size", `${grimSettings.descFontSize}pt`);
  } else {
    container.style.removeProperty("--grim-desc-size");
  }
}

function applyGrimLayoutVars() {
  const container = $("#pages-container");
  if (grimSettings.pagePadding > 0) {
    container.style.setProperty("--page-pad", `${grimSettings.pagePadding}mm`);
  } else {
    container.style.removeProperty("--page-pad");
  }
  if (grimSettings.separatorGap > 0) {
    container.style.setProperty("--sep-gap", `${grimSettings.separatorGap}mm`);
  } else {
    container.style.removeProperty("--sep-gap");
  }
}

function clearGrimVars() {
  const container = $("#pages-container");
  container.style.removeProperty("--grim-title-size");
  container.style.removeProperty("--grim-desc-size");
  container.style.removeProperty("--page-pad");
  container.style.removeProperty("--sep-gap");
}

// ========================================
// RENDERING
// ========================================

function isMobile() {
  return window.innerWidth <= 768;
}

function getLayout() {
  // If user forced a layout
  if (grimSettings.layout !== "auto") {
    const opt = LAYOUT_OPTIONS.find(o => o.value === grimSettings.layout);
    const perPage = grimSettings.perPage !== "auto" ? grimSettings.perPage : (opt ? opt.perPage : 4);
    return { perPage, css: grimSettings.layout };
  }

  // If user forced perPage but not layout
  if (grimSettings.perPage !== "auto") {
    // Find a layout that matches this perPage, or use 4quad as default
    const layoutForCount = {
      1: "layout-single",
      2: "layout-2row",
      3: "layout-3stack",
      4: "layout-4quad",
      6: "layout-6grid",
    };
    return {
      perPage: grimSettings.perPage,
      css: layoutForCount[grimSettings.perPage] || "layout-4quad",
    };
  }

  // Theme default
  const base = THEME_LAYOUTS[currentTheme] || THEME_LAYOUTS.medieval;
  if (isMobile() && base.perPage > 2) {
    return { perPage: 2, css: "layout-2row" };
  }
  return base;
}

function extractSpellbookConditions() {
  const conditionNames = new Set();
  const regex = /\{@condition ([^|}]+)\|?[^}]*\}/g;

  for (const spell of spellbook) {
    const text = JSON.stringify(spell.entries || []) + JSON.stringify(spell.entriesHigherLevel || []);
    let match;
    while ((match = regex.exec(text)) !== null) {
      conditionNames.add(match[1]);
    }
  }

  const results = [];
  for (const name of [...conditionNames].sort()) {
    const xphb = allConditions.find(c => c.name.toLowerCase() === name.toLowerCase() && c.source === "XPHB");
    const fallback = allConditions.find(c => c.name.toLowerCase() === name.toLowerCase());
    const cond = xphb || fallback;
    if (cond) results.push(cond);
  }
  return results;
}

function extractSpellbookSummons() {
  const results = [];
  const seen = new Set();
  for (const spell of spellbook) {
    const key = `${spell.name}|${spell.source}`;
    for (const m of allSummons) {
      if (m.summonedBySpell === key && !seen.has(m.name)) {
        seen.add(m.name);
        results.push(m);
      }
    }
  }
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

const SIZE_MAP = { T: "Tiny", S: "Small", M: "Medium", L: "Large", H: "Huge", G: "Gargantuan" };
const ALIGN_MAP = { L: "Lawful", N: "Neutral", C: "Chaotic", G: "Good", E: "Evil", U: "Unaligned", A: "Any" };

function abilityMod(score) {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function formatCreatureAC(ac) {
  if (!ac || !ac.length) return "—";
  return ac.map(a => {
    if (typeof a === "number") return String(a);
    if (a.special) return a.special;
    let s = String(a.ac || "");
    if (a.from) s += ` (${a.from.join(", ")})`;
    return s;
  }).join(", ");
}

function formatCreatureHP(hp) {
  if (!hp) return "—";
  if (hp.special) return hp.special;
  if (hp.average) return `${hp.average} (${hp.formula || ""})`;
  return "—";
}

function formatCreatureSpeed(speed) {
  if (!speed) return "—";
  const parts = [];
  for (const [type, val] of Object.entries(speed)) {
    if (type === "canHover") continue;
    const label = type === "walk" ? "" : `${type} `;
    if (typeof val === "number") {
      parts.push(`${label}${val} ft.`);
    } else if (val && val.number) {
      let s = `${label}${val.number} ft.`;
      if (val.condition) s += ` ${val.condition}`;
      parts.push(s);
    }
  }
  if (speed.canHover && !parts.some(p => p.includes("hover"))) {
    const fi = parts.findIndex(p => p.startsWith("fly") || p.includes("fly"));
    if (fi >= 0) parts[fi] = parts[fi].replace("ft.", "ft. (hover)");
  }
  return parts.join(", ") || "—";
}

function formatDamageList(arr) {
  if (!arr || !arr.length) return "";
  return arr.map(item => {
    if (typeof item === "string") return item;
    if (item.resist) return item.resist.join(", ") + (item.note ? ` ${item.note}` : "");
    if (item.immune) return item.immune.join(", ") + (item.note ? ` ${item.note}` : "");
    return "";
  }).filter(Boolean).join("; ");
}

function buildStatBlock(creature) {
  const block = document.createElement("div");
  block.className = "stat-block";

  const sizes = (creature.size || []).map(s => SIZE_MAP[s] || s).join("/");
  const typeName = typeof creature.type === "string" ? creature.type : (creature.type?.type || "");
  const alignment = (creature.alignment || []).map(a => ALIGN_MAP[a] || a).join(" ");

  const resistStr = formatDamageList(creature.resist);
  const immuneStr = formatDamageList(creature.immune);
  const condImmuneStr = (creature.conditionImmune || []).join(", ");

  const senses = [...(creature.senses || [])];
  if (creature.passive) senses.push(`passive Perception ${creature.passive}`);

  const languages = (creature.languages || []).join(", ") || "—";
  const pbStr = creature.pbNote || "—";

  let propsHTML = "";
  if (resistStr) propsHTML += `<div class="sb-prop"><span class="sb-prop-label">Resistances</span> ${resistStr}</div>`;
  if (immuneStr) propsHTML += `<div class="sb-prop"><span class="sb-prop-label">Immunities</span> ${immuneStr}</div>`;
  if (condImmuneStr) propsHTML += `<div class="sb-prop"><span class="sb-prop-label">Condition Immunities</span> ${condImmuneStr}</div>`;
  propsHTML += `<div class="sb-prop"><span class="sb-prop-label">Senses</span> ${senses.join(", ") || "—"}</div>`;
  propsHTML += `<div class="sb-prop"><span class="sb-prop-label">Languages</span> ${languages}</div>`;
  propsHTML += `<div class="sb-prop"><span class="sb-prop-label">Proficiency Bonus</span> ${pbStr}</div>`;

  const sectionsHTML = buildStatBlockSections(creature);

  block.innerHTML = `
    <div class="sb-bar"></div>
    <div class="sb-header">
      <div class="sb-name">${creature.name}</div>
      <div class="sb-meta">${sizes} ${typeName}, ${alignment}</div>
    </div>
    <div class="sb-bar"></div>
    <div class="sb-combat">
      <div class="sb-prop"><span class="sb-prop-label">Armor Class</span> ${formatCreatureAC(creature.ac)}</div>
      <div class="sb-prop"><span class="sb-prop-label">Hit Points</span> ${formatCreatureHP(creature.hp)}</div>
      <div class="sb-prop"><span class="sb-prop-label">Speed</span> ${formatCreatureSpeed(creature.speed)}</div>
    </div>
    <div class="sb-bar"></div>
    <div class="sb-abilities">
      ${["str", "dex", "con", "int", "wis", "cha"].map(a => `
        <div class="sb-ability">
          <div class="sb-ability-label">${a.toUpperCase()}</div>
          <div class="sb-ability-score">${creature[a] || 10} (${abilityMod(creature[a] || 10)})</div>
        </div>
      `).join("")}
    </div>
    <div class="sb-bar"></div>
    <div class="sb-props">${propsHTML}</div>
    <div class="sb-bar"></div>
    ${sectionsHTML}
  `;

  return block;
}

function buildStatBlockSections(creature) {
  let html = "";
  if (creature.trait && creature.trait.length) {
    html += `<div class="sb-section">`;
    html += creature.trait.map(t =>
      `<div class="sb-entry"><span class="sb-entry-name">${t.name}.</span> ${formatEntries(t.entries || [])}</div>`
    ).join("");
    html += `</div>`;
  }
  if (creature.action && creature.action.length) {
    html += `<div class="sb-section"><div class="sb-section-title">Actions</div>`;
    html += creature.action.map(a =>
      `<div class="sb-entry"><span class="sb-entry-name">${a.name}.</span> ${formatEntries(a.entries || [])}</div>`
    ).join("");
    html += `</div>`;
  }
  if (creature.bonus && creature.bonus.length) {
    html += `<div class="sb-section"><div class="sb-section-title">Bonus Actions</div>`;
    html += creature.bonus.map(b =>
      `<div class="sb-entry"><span class="sb-entry-name">${b.name}.</span> ${formatEntries(b.entries || [])}</div>`
    ).join("");
    html += `</div>`;
  }
  if (creature.reaction && creature.reaction.length) {
    html += `<div class="sb-section"><div class="sb-section-title">Reactions</div>`;
    html += creature.reaction.map(r =>
      `<div class="sb-entry"><span class="sb-entry-name">${r.name}.</span> ${formatEntries(r.entries || [])}</div>`
    ).join("");
    html += `</div>`;
  }
  return html;
}

function buildConditionBlock(cond) {
  const block = document.createElement("div");
  block.className = "cond-block";

  const name = document.createElement("div");
  name.className = "cond-name";
  name.textContent = cond.name;
  block.appendChild(name);

  const entries = document.createElement("div");
  entries.className = "cond-entries";
  entries.innerHTML = formatEntries(cond.entries || []);
  block.appendChild(entries);

  return block;
}

function createConditionsPage(isFirst) {
  const page = document.createElement("div");
  page.className = "grim-page layout-conditions";

  if (isFirst) {
    const title = document.createElement("div");
    title.className = "cond-title";
    title.textContent = "Conditions";
    page.appendChild(title);
  }

  const body = document.createElement("div");
  body.className = "cond-body";
  page.appendChild(body);

  const pn = document.createElement("div");
  pn.className = "grim-page-number";
  page.appendChild(pn);

  return page;
}

function renderConditionsPages(container, conditions) {
  const condPages = [];
  const allBlocks = conditions.map(c => buildConditionBlock(c));

  let currentPage = createConditionsPage(true);
  container.appendChild(currentPage);
  condPages.push(currentPage);

  let body = currentPage.querySelector(".cond-body");
  for (const block of allBlocks) {
    body.appendChild(block);
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      for (let safety = 0; safety < 20; safety++) {
        const page = condPages[condPages.length - 1];
        const bd = page.querySelector(".cond-body");

        if (bd.scrollHeight <= bd.clientHeight + 2) break;

        const blocks = [...bd.querySelectorAll(".cond-block")];
        if (blocks.length <= 1) break;

        const newPage = createConditionsPage(false);
        container.appendChild(newPage);
        condPages.push(newPage);
        const newBody = newPage.querySelector(".cond-body");

        while (blocks.length > 1 && bd.scrollHeight > bd.clientHeight + 2) {
          const last = blocks.pop();
          newBody.insertBefore(last, newBody.firstChild);
        }
      }

      updateAllPageNumbers();
    });
  });
}

function createSummonsPage(isFirst) {
  const page = document.createElement("div");
  page.className = "grim-page layout-summons";

  if (isFirst) {
    const title = document.createElement("div");
    title.className = "summon-title";
    title.textContent = "Summoned Creatures";
    page.appendChild(title);
  }

  const body = document.createElement("div");
  body.className = "summon-body";
  page.appendChild(body);

  const pn = document.createElement("div");
  pn.className = "grim-page-number";
  page.appendChild(pn);

  return page;
}

function renderSummonsPages(container, creatures) {
  const summonPages = [];
  const allBlocks = creatures.map(c => buildStatBlock(c));

  let currentPage = createSummonsPage(true);
  container.appendChild(currentPage);
  summonPages.push(currentPage);

  let body = currentPage.querySelector(".summon-body");
  for (const block of allBlocks) {
    body.appendChild(block);
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      for (let safety = 0; safety < 50; safety++) {
        const page = summonPages[summonPages.length - 1];
        const bd = page.querySelector(".summon-body");

        if (bd.scrollHeight <= bd.clientHeight + 2) break;

        const blocks = [...bd.querySelectorAll(".stat-block")];
        if (blocks.length <= 1) break;

        const newPage = createSummonsPage(false);
        container.appendChild(newPage);
        summonPages.push(newPage);
        const newBody = newPage.querySelector(".summon-body");

        while (blocks.length > 1 && bd.scrollHeight > bd.clientHeight + 2) {
          const last = blocks.pop();
          newBody.insertBefore(last, newBody.firstChild);
        }
      }

      updateAllPageNumbers();
    });
  });
}

function updateAllPageNumbers() {
  const allPages = document.querySelectorAll(".grim-page");
  const total = allPages.length;
  allPages.forEach((page, i) => {
    const pn = page.querySelector(".grim-page-number");
    if (pn) pn.textContent = `— ${i + 1} / ${total} —`;
  });
}

function finalizeRender(container, scrollY, dropMovedKey) {
  container.style.minHeight = "";
  
  window.scrollTo(0, scrollY);
    
  if (dropMovedKey) {
    const el = document.querySelector(`.spell-quadrant[data-key="${dropMovedKey}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      el.classList.add("sq-drop-highlight");
      setTimeout(() => el.classList.remove("sq-drop-highlight"), 1000);
    }
  }
}

function renderGrimoire(dropMovedKey = null) {
  const container = document.getElementById("pages-container");
  
  const startScrollY = window.scrollY;
  container.style.minHeight = container.scrollHeight + "px";
  
  container.innerHTML = "";

  applyGrimFontVars();
  applyGrimLayoutVars();

  if (spellbook.length === 0) {
    container.style.minHeight = "";
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:4rem;font-size:1.2rem;font-family:var(--font-title);">Spellbook is empty. Go back and add spells.</p>';
    return;
  }

  const layout = getLayout();
  const conditions = extractSpellbookConditions();
  const summons = extractSpellbookSummons();

  if (layout.css === "layout-modular" || layout.css === "layout-modular-1col") {
    renderModularPages(container, spellbook, conditions, summons, layout.css, startScrollY, dropMovedKey);
    return;
  }

  const pages = chunkArray(spellbook, layout.perPage);

  for (let i = 0; i < pages.length; i++) {
    const page = createPage(pages[i], i + 1, pages.length, layout);
    container.appendChild(page);
  }

  if (conditions.length > 0) {
    renderConditionsPages(container, conditions);
  }

  if (summons.length > 0) {
    renderSummonsPages(container, summons);
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      shrinkOverflowingQuadrants();
      requestAnimationFrame(() => {
        updateAllPageNumbers();
        initQuadrantDragDrop();
        finalizeRender(container, startScrollY, dropMovedKey);
      });
    });
  });
}

function createModularPage(layoutCss, numCols) {
  const page = document.createElement("div");
  page.className = `grim-page ${layoutCss}`;

  const body = document.createElement("div");
  body.className = "modular-body";

  if (numCols === 2) {
    const colL = document.createElement("div");
    colL.className = "modular-col";
    const sep = document.createElement("div");
    sep.className = "modular-sep";
    const colR = document.createElement("div");
    colR.className = "modular-col";
    body.appendChild(colL);
    body.appendChild(sep);
    body.appendChild(colR);
  } else {
    const col = document.createElement("div");
    col.className = "modular-col";
    body.appendChild(col);
  }

  page.appendChild(body);

  const pn = document.createElement("div");
  pn.className = "grim-page-number";
  page.appendChild(pn);

  return page;
}

function renderModularPages(container, spells, conditions, summons, layoutCss, startScrollY, dropMovedKey) {
  const is2Col = layoutCss === "layout-modular";
  const numCols = is2Col ? 2 : 1;
  const allCards = spells.map(s => createQuadrant(s));

  // Step 1: Create a temporary empty page to measure available column height
  const measurePage = createModularPage(layoutCss, numCols);
  measurePage.style.position = "absolute";
  measurePage.style.left = "-9999px";
  measurePage.style.top = "0";
  measurePage.style.visibility = "hidden";
  container.appendChild(measurePage);

  // Step 2: Create a separate unconstrained measurement div for card heights
  // It has the same width as a column but no height constraint
  const measureDiv = document.createElement("div");
  measureDiv.style.position = "absolute";
  measureDiv.style.left = "-9999px";
  measureDiv.style.top = "0";
  measureDiv.style.visibility = "hidden";
  measureDiv.style.display = "flex";
  measureDiv.style.flexDirection = "column";
  // Will set width after we know column width
  container.appendChild(measureDiv);

  // Put all cards in the unconstrained div
  for (const card of allCards) {
    measureDiv.appendChild(card);
  }

  // Step 3: Wait for layout, then measure and distribute
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // Get available column height from the empty page
      const emptyCol = measurePage.querySelector(".modular-col");
      const colHeight = emptyCol.getBoundingClientRect().height;
      const colWidth = emptyCol.getBoundingClientRect().width;

      // Set measurement div width to match column width
      measureDiv.style.width = colWidth + "px";

      // Force reflow after setting width
      measureDiv.offsetHeight;

      // Measure each card's natural height (including margin)
      const cardHeights = [];
      const marginPx = 1.5 * 3.7795275591; // 1.5mm in px
      for (const card of allCards) {
        const h = card.getBoundingClientRect().height + marginPx;
        cardHeights.push(h);
      }

      // Clean up measurement elements
      for (const card of allCards) {
        card.remove();
      }
      measurePage.remove();
      measureDiv.remove();

      // Step 4: Sequential block packing with column balancing
      const pages = [];
      let i = 0;

      while (i < allCards.length) {
        const p = createModularPage(layoutCss, numCols);
        container.appendChild(p);
        pages.push(p);

        if (numCols === 1) {
          const col = p.querySelector(".modular-col");
          let hSum = 0;
          while (i < allCards.length && hSum + cardHeights[i] <= colHeight + 2) {
            col.appendChild(allCards[i]);
            hSum += cardHeights[i];
            i++;
          }
          if (hSum === 0 && i < allCards.length) {
            col.appendChild(allCards[i]); // Force append if card is taller than page
            i++;
          }
        } else {
          // 2-column balancing
          let bestEndIdx = i;
          let bestSplitIdx = i;
          let minDiff = Infinity;
          let maxCards = 0;

          let totalH = 0;
          for (let j = i; j < allCards.length; j++) {
            totalH += cardHeights[j];
            if (totalH > (colHeight + 2) * 2 + 10) break; // Optimization: stop if impossible to fit

            let h1 = 0;
            for (let k = i - 1; k <= j; k++) {
              if (k >= i) h1 += cardHeights[k];
              let h2 = totalH - h1;

              if (h1 <= colHeight + 2 && h2 <= colHeight + 2) {
                const cardCount = j - i + 1;
                const diff = Math.abs(h1 - h2);
                
                const betterBalance = (diff < minDiff && cardCount === maxCards);
                const tieBreaker = (diff === minDiff && h1 >= h2 && cardCount === maxCards);

                if (cardCount > maxCards || betterBalance || tieBreaker) {
                  maxCards = cardCount;
                  minDiff = diff;
                  bestEndIdx = j;
                  bestSplitIdx = k;
                }
              }
            }
          }

          const cols = p.querySelectorAll(".modular-col");
          if (maxCards === 0) {
            cols[0].appendChild(allCards[i]); // Force append if too tall
            i++;
          } else {
            for (let x = i; x <= bestSplitIdx; x++) cols[0].appendChild(allCards[x]);
            for (let x = bestSplitIdx + 1; x <= bestEndIdx; x++) cols[1].appendChild(allCards[x]);
            i = bestEndIdx + 1;
          }
        }
      }

      // Step 5: Render conditions and summons
      if (conditions.length > 0) {
        renderConditionsPages(container, conditions);
      }

      if (summons.length > 0) {
        renderSummonsPages(container, summons);
      }

      requestAnimationFrame(() => {
        updateAllPageNumbers();
        initQuadrantDragDrop();
        finalizeRender(container, startScrollY, dropMovedKey);
      });
    });
  });
}

function shrinkOverflowingQuadrants() {
  const MIN_SIZE = 5;
  const STEP = 0.5;

  document.querySelectorAll(".spell-quadrant").forEach(q => {
    const desc = q.querySelector(".sq-description");
    if (!desc) return;

    let size = parseFloat(window.getComputedStyle(desc).fontSize);

    while (desc.scrollHeight > desc.clientHeight + 2 && size > MIN_SIZE) {
      size -= STEP;
      desc.style.fontSize = size + "px";
      desc.style.lineHeight = "1.3";
    }
  });
}

function createPage(spells, pageNum, totalPages, layout) {
  const page = document.createElement("div");
  page.className = `grim-page ${layout.css}`;

  const sep = THEME_SEPARATORS[currentTheme] || THEME_SEPARATORS.medieval;

  switch (layout.css) {
    case "layout-single":
      buildLayoutSingle(page, spells);
      break;
    case "layout-2row":
      buildLayout2Row(page, spells, sep);
      break;
    case "layout-6grid":
      buildLayout6Grid(page, spells, sep);
      break;
    case "layout-3stack":
      buildLayout3Stack(page, spells, sep);
      break;
    case "layout-modular":
      break;
    default:
      buildLayout4Quad(page, spells, sep);
      break;
  }

  const pn = document.createElement("div");
  pn.className = "grim-page-number";
  pn.textContent = `— ${pageNum} / ${totalPages} —`;
  page.appendChild(pn);

  return page;
}

function buildLayout4Quad(page, spells, sep) {
  page.appendChild(spells[0] ? createQuadrant(spells[0]) : createEmptyQuadrant());

  const sepV = document.createElement("div");
  sepV.className = "sep-v";
  sepV.innerHTML = `
    <div class="sep-line"></div>
    ${sep.v ? `<span class="sep-runes">${sep.v}</span>` : ''}
  `;
  page.appendChild(sepV);

  page.appendChild(spells[1] ? createQuadrant(spells[1]) : createEmptyQuadrant());

  const sepH = document.createElement("div");
  sepH.className = "sep-h";
  sepH.innerHTML = `
    <div class="sep-line"></div>
    ${sep.h ? `<span class="sep-runes">${sep.h}</span>` : ''}
    ${sep.center ? `<span class="sep-center">${sep.center}</span>` : ''}
  `;
  page.appendChild(sepH);

  page.appendChild(spells[2] ? createQuadrant(spells[2]) : createEmptyQuadrant());
  page.appendChild(spells[3] ? createQuadrant(spells[3]) : createEmptyQuadrant());
}

function buildLayoutSingle(page, spells) {
  page.appendChild(spells[0] ? createQuadrant(spells[0]) : createEmptyQuadrant());
}

function buildLayout2Row(page, spells, sep) {
  const q1 = spells[0] ? createQuadrant(spells[0]) : createEmptyQuadrant();
  q1.style.gridColumn = "1";
  q1.style.gridRow = "1";
  page.appendChild(q1);

  const sepH = document.createElement("div");
  sepH.className = "sep-h";
  sepH.style.gridColumn = "1";
  sepH.style.gridRow = "2";
  sepH.innerHTML = `
    <div class="sep-line"></div>
    ${sep.h ? `<span class="sep-runes">${sep.h}</span>` : ''}
    ${sep.center ? `<span class="sep-center">${sep.center}</span>` : ''}
  `;
  page.appendChild(sepH);

  const q2 = spells[1] ? createQuadrant(spells[1]) : createEmptyQuadrant();
  q2.style.gridColumn = "1";
  q2.style.gridRow = "3";
  page.appendChild(q2);
}

function buildLayout6Grid(page, spells, sep) {
  const positions = [
    { col: "1", row: "1" },
    { col: "3", row: "1" },
    { col: "1", row: "3" },
    { col: "3", row: "3" },
    { col: "1", row: "5" },
    { col: "3", row: "5" },
  ];

  for (let i = 0; i < 6; i++) {
    const q = spells[i] ? createQuadrant(spells[i]) : createEmptyQuadrant();
    q.style.gridColumn = positions[i].col;
    q.style.gridRow = positions[i].row;
    page.appendChild(q);
  }

  const v1 = document.createElement("div");
  v1.className = "sep-v-1";
  v1.style.gridColumn = "2";
  v1.style.gridRow = "1 / -1";
  v1.innerHTML = `<div class="sep-line"></div>`;
  page.appendChild(v1);

  const h1 = document.createElement("div");
  h1.className = "sep-h-1";
  h1.style.gridColumn = "1 / -1";
  h1.style.gridRow = "2";
  h1.innerHTML = `<div class="sep-line"></div>`;
  page.appendChild(h1);

  const h2 = document.createElement("div");
  h2.className = "sep-h-2";
  h2.style.gridColumn = "1 / -1";
  h2.style.gridRow = "4";
  h2.innerHTML = `<div class="sep-line"></div>`;
  page.appendChild(h2);
}

function buildLayout3Stack(page, spells, sep) {
  const q1 = spells[0] ? createQuadrant(spells[0]) : createEmptyQuadrant();
  q1.style.gridColumn = "1";
  q1.style.gridRow = "1";
  page.appendChild(q1);

  const h1 = document.createElement("div");
  h1.className = "sep-h-1";
  h1.style.gridColumn = "1";
  h1.style.gridRow = "2";
  h1.innerHTML = `
    <div class="sep-line"></div>
    ${sep.h ? `<span class="sep-runes">${sep.h}</span>` : ''}
  `;
  page.appendChild(h1);

  const q2 = spells[1] ? createQuadrant(spells[1]) : createEmptyQuadrant();
  q2.style.gridColumn = "1";
  q2.style.gridRow = "3";
  page.appendChild(q2);

  const h2 = document.createElement("div");
  h2.className = "sep-h-2";
  h2.style.gridColumn = "1";
  h2.style.gridRow = "4";
  h2.innerHTML = `
    <div class="sep-line"></div>
    ${sep.h ? `<span class="sep-runes">${sep.h}</span>` : ''}
  `;
  page.appendChild(h2);

  const q3 = spells[2] ? createQuadrant(spells[2]) : createEmptyQuadrant();
  q3.style.gridColumn = "1";
  q3.style.gridRow = "5";
  page.appendChild(q3);
}

function createQuadrant(spell) {
  const q = document.createElement("div");
  q.className = "spell-quadrant";
  q.dataset.key = spell._key;
  q.draggable = true;

  const school = SCHOOL_NAME_MAP[spell.school] || spell.school;
  const levelSchool = spell.level === 0
    ? `${school} (Cantrip) · ${sourceLabel(spell.source)}`
    : `${LEVEL_LABELS[spell.level]} — ${school} · ${sourceLabel(spell.source)}`;

  const castingTime = spell.time
    ? spell.time.map(t => `${t.number} ${translateUnit(t.unit)}`).join(", ")
    : "—";
  const range = formatRange(spell.range);
  const components = formatComponents(spell.components);
  const duration = formatDurationShort(spell.duration);
  const ritual = spell.meta?.ritual ? " [Ritual]" : "";
  const concentration = spell.duration?.some(d => d.concentration) ? " (C)" : "";

  const entries = formatEntries(spell.entries || []);
  const higher = spell.entriesHigherLevel ? formatEntries(spell.entriesHigherLevel) : "";

  const tags = [];
  if (spell.meta?.ritual) tags.push('<span class="sq-tag sq-tag-ritual">Ritual</span>');
  if (spell.duration?.some(d => d.concentration)) tags.push('<span class="sq-tag sq-tag-conc">Concentration</span>');

  const condRegex = /\{@condition ([^|}]+)\|?[^}]*\}/g;
  const spellText = JSON.stringify(spell.entries || []) + JSON.stringify(spell.entriesHigherLevel || []);
  const condNames = new Set();
  let cm;
  while ((cm = condRegex.exec(spellText)) !== null) condNames.add(cm[1]);
  for (const cn of [...condNames].sort()) {
    tags.push(`<span class="sq-tag sq-tag-cond">${cn}</span>`);
  }

  q.innerHTML = `
    <div class="sq-drag-handle" title="Drag to reorder">⋮⋮</div>
    <div class="sq-header">
      <div class="sq-name">${spell.name}</div>
      <div class="sq-subtitle">${levelSchool}</div>
      ${tags.length ? `<div class="sq-tags">${tags.join("")}</div>` : ""}
    </div>
    <div class="sq-stats">
      <div><span class="sq-stat-label">Casting Time</span><br><span class="sq-stat-value">${castingTime}</span></div>
      <div><span class="sq-stat-label">Range</span><br><span class="sq-stat-value">${range}</span></div>
      <div><span class="sq-stat-label">Components</span><br><span class="sq-stat-value">${components}</span></div>
      <div><span class="sq-stat-label">Duration</span><br><span class="sq-stat-value">${duration}</span></div>
    </div>
    <div class="sq-description">
      ${entries}
      ${higher ? `<div class="sq-higher-level"><div class="sq-higher-level-title">At Higher Levels</div>${higher}</div>` : ''}
    </div>
  `;

  return q;
}

function createEmptyQuadrant() {
  const q = document.createElement("div");
  q.className = "spell-quadrant sq-empty";
  return q;
}

// ========================================
// DRAG AND DROP (Grimoire spell reorder)
// ========================================

let draggedSpellKey = null;
let dragScrollInterval = null;

function handleDragScroll(e) {
  const threshold = 60;
  const maxSpeed = 25;
  const y = e.clientY;
  const h = window.innerHeight;
  
  clearInterval(dragScrollInterval);
  
  if (y < threshold) {
    const speed = ((threshold - y) / threshold) * maxSpeed;
    dragScrollInterval = setInterval(() => window.scrollBy(0, -speed), 16);
  } else if (h - y < threshold) {
    const speed = ((threshold - (h - y)) / threshold) * maxSpeed;
    dragScrollInterval = setInterval(() => window.scrollBy(0, speed), 16);
  }
}

document.addEventListener("dragover", (e) => {
  if (draggedSpellKey) handleDragScroll(e);
});

document.addEventListener("dragend", () => {
  clearInterval(dragScrollInterval);
});

function initQuadrantDragDrop() {
  const quadrants = document.querySelectorAll(".spell-quadrant[data-key]");

  quadrants.forEach(q => {
    q.addEventListener("dragstart", (e) => {
      draggedSpellKey = q.dataset.key;
      q.classList.add("sq-dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", q.dataset.key);
    });

    q.addEventListener("dragend", () => {
      draggedSpellKey = null;
      q.classList.remove("sq-dragging");
      document.querySelectorAll(".sq-drag-over, .sq-drag-before, .sq-drag-after").forEach(el => {
        el.classList.remove("sq-drag-over", "sq-drag-before", "sq-drag-after");
      });
      document.querySelectorAll(".modular-col-drag-over").forEach(el => {
        el.classList.remove("modular-col-drag-over");
      });
    });

    q.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (q.dataset.key !== draggedSpellKey) {
        // Show directional indicator based on cursor position
        const rect = q.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        q.classList.remove("sq-drag-before", "sq-drag-after");
        if (e.clientY < midY) {
          q.classList.add("sq-drag-before");
        } else {
          q.classList.add("sq-drag-after");
        }
        q.classList.add("sq-drag-over");
      }
    });

    q.addEventListener("dragleave", () => {
      q.classList.remove("sq-drag-over", "sq-drag-before", "sq-drag-after");
    });

    q.addEventListener("drop", (e) => {
      e.preventDefault();
      q.classList.remove("sq-drag-over", "sq-drag-before", "sq-drag-after");

      const fromKey = draggedSpellKey;
      const toKey = q.dataset.key;
      if (!fromKey || !toKey || fromKey === toKey) return;

      // Determine insert position based on cursor
      const rect = q.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const insertBefore = e.clientY < midY;

      const fromIdx = spellbook.findIndex(s => s._key === fromKey);
      const toIdx = spellbook.findIndex(s => s._key === toKey);
      if (fromIdx < 0 || toIdx < 0) return;

      const [moved] = spellbook.splice(fromIdx, 1);
      // Recalculate target index after removal
      let newIdx = spellbook.findIndex(s => s._key === toKey);
      if (!insertBefore) newIdx++;
      spellbook.splice(newIdx, 0, moved);

      localStorage.setItem("sb-grimoire-order", JSON.stringify(spellbook.map(s => s._key)));
      renderGrimoire(moved._key);
    });
  });

  // Enable modular columns as drop targets (for dropping into empty space)
  const modularCols = document.querySelectorAll(".modular-col");
  modularCols.forEach(col => {
    col.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      // Only show indicator if not hovering a spell card
      if (e.target === col || e.target.closest(".modular-col") === col && !e.target.closest(".spell-quadrant")) {
        col.classList.add("modular-col-drag-over");
      }
    });

    col.addEventListener("dragleave", (e) => {
      if (!col.contains(e.relatedTarget)) {
        col.classList.remove("modular-col-drag-over");
      }
    });

    col.addEventListener("drop", (e) => {
      // Only handle drops on the column itself or empty space, not on spell cards
      if (e.target.closest(".spell-quadrant[data-key]")) return;
      e.preventDefault();
      col.classList.remove("modular-col-drag-over");

      const fromKey = draggedSpellKey;
      if (!fromKey) return;

      // Find the last spell in this column to place the dragged spell after it
      const colCards = [...col.querySelectorAll(".spell-quadrant[data-key]")];
      const fromIdx = spellbook.findIndex(s => s._key === fromKey);
      if (fromIdx < 0) return;

      const [moved] = spellbook.splice(fromIdx, 1);

      if (colCards.length > 0) {
        const lastKey = colCards[colCards.length - 1].dataset.key;
        let targetIdx = spellbook.findIndex(s => s._key === lastKey);
        spellbook.splice(targetIdx + 1, 0, moved);
      } else {
        // Empty column — find position based on page context
        const page = col.closest(".grim-page");
        const allPagesCards = [...page.querySelectorAll(".spell-quadrant[data-key]")];
        if (allPagesCards.length > 0) {
          const lastPageKey = allPagesCards[allPagesCards.length - 1].dataset.key;
          let targetIdx = spellbook.findIndex(s => s._key === lastPageKey);
          spellbook.splice(targetIdx + 1, 0, moved);
        } else {
          spellbook.push(moved);
        }
      }

      localStorage.setItem("sb-grimoire-order", JSON.stringify(spellbook.map(s => s._key)));
      renderGrimoire(moved._key);
    });
  });
}

// ========================================
// REORDER MODAL & LIST DRAG
// ========================================

let reorderDraggedItem = null;

function renderReorderList() {
  const list = $("#reorder-list");
  list.innerHTML = "";
  
  spellbook.forEach((spell) => {
    const item = document.createElement("div");
    item.className = "reorder-item";
    item.draggable = true;
    item.dataset.key = spell._key;
    
    const school = SCHOOL_NAME_MAP[spell.school] || spell.school;
    const levelStr = spell.level === 0 ? "Cantrip" : `Level ${spell.level}`;
    
    item.innerHTML = `
      <div class="reorder-item-info">
        <span class="reorder-item-title">${spell.name}</span>
        <span class="reorder-item-meta">${levelStr} · ${school}</span>
      </div>
      <div class="reorder-item-actions">
        <button class="reorder-btn" title="Move Top" onclick="moveSpell('${spell._key}', 'top')">⇈</button>
        <button class="reorder-btn" title="Move Up" onclick="moveSpell('${spell._key}', 'up')">↑</button>
        <button class="reorder-btn" title="Move Down" onclick="moveSpell('${spell._key}', 'down')">↓</button>
        <button class="reorder-btn" title="Move Bottom" onclick="moveSpell('${spell._key}', 'bottom')">⇊</button>
      </div>
    `;
    
    list.appendChild(item);
  });
  
  initReorderDragDrop();
}

function openReorderModal() {
  renderReorderList();
  $("#reorder-modal").classList.remove("hidden");
}

function closeReorderModal() {
  $("#reorder-modal").classList.add("hidden");
}

window.moveSpell = function(key, dir) {
  const idx = spellbook.findIndex(s => s._key === key);
  if (idx < 0) return;
  
  const [spell] = spellbook.splice(idx, 1);
  let newIdx = idx;
  
  if (dir === 'top') newIdx = 0;
  else if (dir === 'up') newIdx = Math.max(0, idx - 1);
  else if (dir === 'down') newIdx = Math.min(spellbook.length, idx + 1);
  else if (dir === 'bottom') newIdx = spellbook.length;
  
  spellbook.splice(newIdx, 0, spell);
  
  localStorage.setItem("sb-grimoire-order", JSON.stringify(spellbook.map(s => s._key)));
  renderReorderList();
  renderGrimoire(key);
};

function initReorderDragDrop() {
  const list = $("#reorder-list");
  const items = list.querySelectorAll(".reorder-item");
  
  items.forEach(item => {
    item.addEventListener("dragstart", (e) => {
      reorderDraggedItem = item;
      setTimeout(() => item.classList.add("dragging"), 0);
      e.dataTransfer.effectAllowed = "move";
    });
    
    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
      reorderDraggedItem = null;
    });
    
    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const afterElement = getDragAfterElement(list, e.clientY);
      if (afterElement == null) {
        list.appendChild(reorderDraggedItem);
      } else {
        list.insertBefore(reorderDraggedItem, afterElement);
      }
    });
    
    item.addEventListener("drop", (e) => {
      e.preventDefault();
      const newOrderKeys = [...list.querySelectorAll(".reorder-item")].map(el => el.dataset.key);
      const spellMap = new Map(spellbook.map(s => [s._key, s]));
      spellbook = newOrderKeys.map(k => spellMap.get(k)).filter(Boolean);
      
      localStorage.setItem("sb-grimoire-order", JSON.stringify(spellbook.map(s => s._key)));
      renderGrimoire(reorderDraggedItem.dataset.key);
    });
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.reorder-item:not(.dragging)')];
  
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// ========================================
// EVENT LISTENERS
// ========================================

function initEventListeners() {
  $("#btn-reorder").addEventListener("click", () => {
    openReorderModal();
  });

  $("#reorder-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeReorderModal();
  });

  $("#reorder-modal .modal-close").addEventListener("click", () => {
    closeReorderModal();
  });

  $("#reorder-done").addEventListener("click", () => {
    closeReorderModal();
  });


  // Page size
  $("#page-size").addEventListener("change", () => {
    rebuildBodyClasses();
    updatePrintPageSize();
  });

  // Theme
  $("#theme-select").addEventListener("change", (e) => {
    currentTheme = e.target.value;
    rebuildBodyClasses();
    loadSavedCustomVars();
    renderGrimoire();
  });

  // Transparent background
  $("#toggle-transparent").addEventListener("change", () => {
    rebuildBodyClasses();
    if (!$("#toggle-transparent").checked) {
      loadSavedCustomVars();
    }
  });

  // Print
  $("#btn-print").addEventListener("click", () => {
    updatePrintPageSize();

    const container = $("#pages-container");
    const savedTransform = container.style.transform;
    const savedOrigin = container.style.transformOrigin;
    const savedMargin = container.style.marginBottom;
    container.style.transform = "none";
    container.style.transformOrigin = "";
    container.style.marginBottom = "";

    window.onafterprint = () => {
      container.style.transform = savedTransform;
      container.style.transformOrigin = savedOrigin;
      container.style.marginBottom = savedMargin;
      window.onafterprint = null;
    };

    window.print();
  });

  // PDF
  $("#btn-pdf").addEventListener("click", async () => {
    const jsPDFLib = window.jspdf || window.jsPDF;
    if (typeof html2canvas === "undefined" || !jsPDFLib) {
      alert("PDF library not loaded. Check your internet connection and reload the page.");
      return;
    }

    const pages = document.querySelectorAll(".grim-page");
    if (!pages.length) {
      alert("Spellbook is empty.");
      return;
    }

    const btn = $("#btn-pdf");
    btn.disabled = true;
    btn.textContent = "Generating...";

    const container = $("#pages-container");
    const savedTransform = container.style.transform;
    const savedOrigin = container.style.transformOrigin;
    const savedMargin = container.style.marginBottom;
    container.style.transform = "none";
    container.style.transformOrigin = "";
    container.style.marginBottom = "";

    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    try {
      const size = $("#page-size").value;
      const formatMap = { a4: "a4", a5: "a5", letter: "letter", legal: "legal" };
      const format = formatMap[size] || "a4";

      const JsPDF = jsPDFLib.jsPDF || jsPDFLib;
      const pdf = new JsPDF({ unit: "mm", format, orientation: "portrait" });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], {
          scale: 2,
          logging: false,
          useCORS: true,
          backgroundColor: null,
          width: pages[i].offsetWidth,
          height: pages[i].offsetHeight,
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH);
      }

      pdf.save("grimoire.pdf");
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("Error generating PDF:\n" + err.message + "\n\nTry using Print instead.");
    } finally {
      container.style.transform = savedTransform;
      container.style.transformOrigin = savedOrigin;
      container.style.marginBottom = savedMargin;
      btn.disabled = false;
      btn.textContent = "PDF";
    }
  });

  // Customize
  $("#btn-customize").addEventListener("click", () => {
    populateCustomizeInputs();
    $("#customize-modal").classList.remove("hidden");
  });

  $("#cust-apply").addEventListener("click", () => {
    const vars = readCustomizeInputs();
    rebuildBodyClasses();
    for (const [prop, val] of Object.entries(vars)) {
      document.body.style.setProperty(prop, val);
    }
    localStorage.setItem("sb-custom-vars", JSON.stringify(vars));
    $("#customize-modal").classList.add("hidden");
    renderGrimoire();
  });

  $("#cust-reset").addEventListener("click", () => {
    document.body.removeAttribute("style");
    localStorage.removeItem("sb-custom-vars");
    rebuildBodyClasses();
    $("#customize-modal").classList.add("hidden");
    renderGrimoire();
  });

  $("#customize-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) $("#customize-modal").classList.add("hidden");
  });

  $("#customize-modal .modal-close").addEventListener("click", () => {
    $("#customize-modal").classList.add("hidden");
  });

  // Zoom
  let zoomLevel = 100;
  const ZOOM_STEP = 10;
  const ZOOM_MIN = 30;
  const ZOOM_MAX = 200;

  function applyZoom() {
    const container = $("#pages-container");
    const scale = zoomLevel / 100;
    container.style.transform = `scale(${scale})`;
    container.style.transformOrigin = "top center";
    container.style.marginBottom = `${(scale - 1) * container.scrollHeight}px`;
    $("#zoom-level").textContent = `${zoomLevel}%`;
  }

  $("#zoom-in").addEventListener("click", () => {
    if (zoomLevel < ZOOM_MAX) { zoomLevel += ZOOM_STEP; applyZoom(); }
  });

  $("#zoom-out").addEventListener("click", () => {
    if (zoomLevel > ZOOM_MIN) { zoomLevel -= ZOOM_STEP; applyZoom(); }
  });

  // Responsive re-render
  let lastMobile = isMobile();
  window.addEventListener("resize", () => {
    const nowMobile = isMobile();
    if (nowMobile !== lastMobile) {
      lastMobile = nowMobile;
      if (spellbook.length > 0) renderGrimoire();
    }
  });
}

// ========================================
// PAGE SIZE & BODY CLASSES
// ========================================

function updatePrintPageSize() {
  const size = $("#page-size").value;
  const dim = PAGE_SIZES[size] || PAGE_SIZES.a4;
  let style = document.getElementById("print-page-style");
  if (!style) {
    style = document.createElement("style");
    style.id = "print-page-style";
    document.head.appendChild(style);
  }
  style.textContent = `@page { size: ${dim.w} ${dim.h}; margin: 0; }`;
}

function rebuildBodyClasses() {
  const size = $("#page-size").value;
  const transparent = $("#toggle-transparent").checked;
  const hasCustom = !!localStorage.getItem("sb-custom-vars");
  document.body.className = `theme-${currentTheme} size-${size}${transparent ? " bg-transparent" : ""}${hasCustom ? " has-custom-vars" : ""}`;
}

// ========================================
// INIT
// ========================================

init();