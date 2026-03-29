import { SCHOOL_MAP, CLASS_LIST, LEVEL_LABELS } from './js/constants.js';
import { sourceLabel, formatRange, formatComponents, formatDuration, formatEntries, cleanTags, formatTable } from './js/formatters.js';
import { debounce, rgbToHex, lightenColor, downloadJSON, assignIndices, $, $$ } from './js/utils.js';
import { loadSpellData } from './js/dataLoader.js';
import { setTheme, applyCustomVars, loadSavedCustomVars, readCustomizeInputs, populateCustomizeInputs, exportThemeData } from './js/themeManager.js';
import {
  persistSpellbook, loadSpellbookFromStorage, getSavedSpellbooks,
  saveSpellbookToStorage, deleteSavedSpellbook, loadSavedSpellbook,
  exportSpellbookJSON, parseSpellbookImport,
} from './js/spellbook.js';

// ---- State ----
let allSpells = [];
let spellSources = {};
let booksMap = {};
let spellbook = [];
let allSourceCodes = [];
let activeFilters = { name: "", classes: new Set(), levels: new Set(), schools: new Set(), sources: new Set() };
let currentView = "grid";

// ---- DOM Elements ----
const dom = {
  loading: $("#loading-overlay"),
  filterName: $("#filter-name"),
  filterClass: $("#filter-class"),
  filterLevel: $("#filter-level"),
  filterSchool: $("#filter-school"),
  btnOpenSources: $("#btn-open-sources"),
  sourcesModal: $("#sources-modal"),
  sourcesList: $("#sources-list"),
  spellsContainer: $("#spells-container"),
  spellsCount: $("#spells-count"),
  bookContainer: $("#spellbook-container"),
  bookCount: $("#book-count"),
  themeSelect: $("#theme-select"),
  spellModal: $("#spell-modal"),
  modalBody: $("#modal-body"),
  customizeModal: $("#customize-modal"),
  savedModal: $("#saved-spellbooks-modal"),
  savedList: $("#saved-list"),
};

// ========================================
// DATA LOADING
// ========================================

async function init() {
  try {
    const data = await loadSpellData();
    allSpells = data.allSpells;
    spellSources = data.spellSources;
    booksMap = data.booksMap;

    initUI();
    loadSavedSources();
    spellbook = loadSpellbookFromStorage(allSpells);
    renderSpellbook();
    applyFilters();

    dom.loading.classList.add("hidden");
    setTimeout(() => dom.loading.remove(), 600);
  } catch (err) {
    console.error("Error loading data:", err);
    dom.loading.querySelector("p").textContent = "Error loading data. Check the console.";
  }
}

// ========================================
// UI INITIALIZATION
// ========================================

function initUI() {
  initClassFilter();
  initSchoolFilter();
  initSourceFilter();
  initEventListeners();
}

function initClassFilter() {
  for (const cls of CLASS_LIST) {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.dataset.value = cls;
    chip.textContent = cls;
    dom.filterClass.appendChild(chip);
  }
}

function initSchoolFilter() {
  for (const [code, info] of Object.entries(SCHOOL_MAP)) {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.dataset.value = code;
    chip.textContent = info.name;
    dom.filterSchool.appendChild(chip);
  }
}

function initSourceFilter() {
  const sources = new Set(allSpells.map(s => s.source));
  allSourceCodes = [...sources].sort((a, b) => {
    const nameA = booksMap[a] || a;
    const nameB = booksMap[b] || b;
    return nameA.localeCompare(nameB);
  });

  activeFilters.sources = new Set(allSourceCodes.filter(s => s !== "PHB"));
  updateSourceButtonLabel();
}

function loadSavedSources() {
  const saved = localStorage.getItem("sb-sources");
  if (saved) {
    try {
      const arr = JSON.parse(saved);
      activeFilters.sources = new Set(arr.filter(s => allSourceCodes.includes(s)));
      updateSourceButtonLabel();
    } catch (_) {}
  }
}

function saveSources() {
  localStorage.setItem("sb-sources", JSON.stringify([...activeFilters.sources]));
}

function renderSourcesList() {
  dom.sourcesList.innerHTML = "";
  for (const src of allSourceCodes) {
    const label = document.createElement("label");
    label.className = "source-check-item";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = src;
    cb.checked = activeFilters.sources.has(src);

    const abbr = document.createElement("span");
    abbr.className = "source-abbr";
    abbr.textContent = sourceLabel(src);

    const name = document.createElement("span");
    name.className = "source-name";
    name.textContent = booksMap[src] || src;

    label.appendChild(cb);
    label.appendChild(abbr);
    label.appendChild(name);
    dom.sourcesList.appendChild(label);
  }
}

function updateSourceButtonLabel() {
  const total = allSourceCodes.length;
  const selected = activeFilters.sources.size;
  dom.btnOpenSources.textContent = `Sources (${selected}/${total})`;
}

function initEventListeners() {
  dom.filterName.addEventListener("input", debounce(() => {
    activeFilters.name = dom.filterName.value.trim().toLowerCase();
    applyFilters();
  }, 200));

  dom.filterClass.addEventListener("click", (e) => {
    if (!e.target.classList.contains("chip")) return;
    e.target.classList.toggle("active");
    toggleFilterSet(activeFilters.classes, e.target.dataset.value);
    applyFilters();
  });

  dom.filterLevel.addEventListener("click", (e) => {
    if (!e.target.classList.contains("chip")) return;
    e.target.classList.toggle("active");
    toggleFilterSet(activeFilters.levels, parseInt(e.target.dataset.value));
    applyFilters();
  });

  dom.filterSchool.addEventListener("click", (e) => {
    if (!e.target.classList.contains("chip")) return;
    e.target.classList.toggle("active");
    toggleFilterSet(activeFilters.schools, e.target.dataset.value);
    applyFilters();
  });

  dom.btnOpenSources.addEventListener("click", () => {
    renderSourcesList();
    dom.sourcesModal.classList.remove("hidden");
  });

  $("#sources-select-all").addEventListener("click", () => {
    activeFilters.sources = new Set(allSourceCodes);
    renderSourcesList();
  });

  $("#sources-deselect-all").addEventListener("click", () => {
    activeFilters.sources.clear();
    renderSourcesList();
  });

  $("#sources-apply").addEventListener("click", () => {
    const checkboxes = dom.sourcesList.querySelectorAll('input[type="checkbox"]');
    activeFilters.sources = new Set();
    for (const cb of checkboxes) {
      if (cb.checked) activeFilters.sources.add(cb.value);
    }
    updateSourceButtonLabel();
    dom.sourcesModal.classList.add("hidden");
    saveSources();
    applyFilters();
  });

  for (const btn of $$(".source-quick")) {
    btn.addEventListener("click", () => {
      const codes = btn.dataset.sources.split(",");
      const isActive = btn.classList.contains("active");

      if (isActive) {
        activeFilters.sources = new Set(allSourceCodes);
        btn.classList.remove("active");
      } else {
        for (const b of $$(".source-quick")) b.classList.remove("active");
        activeFilters.sources = new Set(codes);
        btn.classList.add("active");
      }

      updateSourceButtonLabel();
      saveSources();
      applyFilters();
    });
  }

  $("#btn-clear-filters").addEventListener("click", clearFilters);

  $("#view-grid").addEventListener("click", () => setView("grid"));
  $("#view-list").addEventListener("click", () => setView("list"));

  dom.themeSelect.addEventListener("change", () => {
    setTheme(dom.themeSelect.value);
  });

  $("#btn-customize").addEventListener("click", () => {
    populateCustomizeInputs();
    dom.customizeModal.classList.remove("hidden");
  });

  $("#btn-export-theme").addEventListener("click", () => {
    exportThemeData(dom.themeSelect.value, spellbook.map(s => s._key));
  });

  $("#btn-import-theme").addEventListener("click", () => $("#import-theme-file").click());
  $("#import-theme-file").addEventListener("change", handleImportTheme);

  for (const modal of $$(".modal-overlay")) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    });
    const close = modal.querySelector(".modal-close");
    if (close) close.addEventListener("click", () => modal.classList.add("hidden"));
  }

  $("#btn-view-grimoire").addEventListener("click", () => {
    if (spellbook.length === 0) {
      alert("Add spells to the spellbook before viewing.");
      return;
    }
    persistSpellbook(spellbook);
    window.location.href = "grimoire.html";
  });

  $("#btn-save-spellbook").addEventListener("click", handleSaveSpellbook);
  $("#btn-load-spellbook").addEventListener("click", openLoadModal);
  $("#btn-clear-spellbook").addEventListener("click", () => {
    if (spellbook.length === 0) return;
    if (confirm("Clear all spells from the spellbook?")) {
      spellbook = [];
      persistSpellbook(spellbook);
      renderSpellbook();
    }
  });

  $("#btn-export-spellbook").addEventListener("click", () => {
    exportSpellbookJSON(spellbook, dom.themeSelect.value);
  });
  $("#btn-import-spellbook").addEventListener("click", () => $("#import-spellbook-file").click());
  $("#import-spellbook-file").addEventListener("change", handleImportSpellbook);

  $("#cust-apply").addEventListener("click", () => {
    const vars = readCustomizeInputs();
    applyCustomVars(vars);
    localStorage.setItem("sb-custom-vars", JSON.stringify(vars));
    dom.customizeModal.classList.add("hidden");
  });

  $("#cust-reset").addEventListener("click", () => {
    document.body.removeAttribute("style");
    dom.customizeModal.classList.add("hidden");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      for (const m of $$(".modal-overlay:not(.hidden)")) m.classList.add("hidden");
      closeMobilePanels();
    }
  });

  const overlay = $("#mobile-overlay");

  $("#btn-mobile-filters").addEventListener("click", () => {
    closeMobilePanels();
    $("#filters-panel").classList.add("open");
    overlay.classList.remove("hidden");
  });

  $("#btn-close-filters").addEventListener("click", closeMobilePanels);

  $("#btn-mobile-spellbook").addEventListener("click", () => {
    closeMobilePanels();
    $("#spellbook-panel").classList.add("open");
    overlay.classList.remove("hidden");
  });

  $("#btn-close-spellbook").addEventListener("click", closeMobilePanels);
  overlay.addEventListener("click", closeMobilePanels);

  // Restore saved theme
  const savedTheme = localStorage.getItem("sb-theme");
  if (savedTheme) {
    dom.themeSelect.value = savedTheme;
    setTheme(savedTheme);
  }
  loadSavedCustomVars();
}

// ========================================
// FILTERING
// ========================================

function toggleFilterSet(set, value) {
  if (set.has(value)) set.delete(value);
  else set.add(value);
}

function applyFilters() {
  const search = activeFilters.name.trim().toLowerCase();
  
  // 1. Filter by Sources, Levels, Classes, and Schools (the "stable" criteria)
  const baseFiltered = allSpells.filter(spell => {
    if (!activeFilters.sources.has(spell.source)) return false;

    if (activeFilters.classes.size > 0) {
      let hasClass = false;
      for (const cls of activeFilters.classes) {
        if (spell._classes.has(cls)) { hasClass = true; break; }
      }
      if (!hasClass) return false;
    }

    if (activeFilters.levels.size > 0 && !activeFilters.levels.has(spell.level)) return false;
    if (activeFilters.schools.size > 0 && !activeFilters.schools.has(spell.school)) return false;

    return true;
  });

  assignIndices(baseFiltered);

  const finalFiltered = search ? baseFiltered.filter(spell => {
    const isNum = !isNaN(search) && search !== "";
    const isGlobalMatch = isNum && spell._globalIndex === parseInt(search);
    const isLevelIndexMatch = isNum && spell._levelIndex === parseInt(search);
    const isLevelPatternMatch = search.includes("-") && (
      `${spell.level === 0 ? 'c' : spell.level}-${spell._levelIndex}` === search ||
      `${spell.level}-${spell._levelIndex}` === search ||
      `l${spell.level}-${spell._levelIndex}` === search
    );
    const isNameMatch = spell.name.toLowerCase().includes(search);

    return isGlobalMatch || isLevelIndexMatch || isLevelPatternMatch || isNameMatch;
  }) : baseFiltered;

  dom.spellsCount.textContent = finalFiltered.length;
  renderSpellsList(finalFiltered);
}

function clearFilters() {
  dom.filterName.value = "";
  activeFilters = {
    name: "",
    classes: new Set(),
    levels: new Set(),
    schools: new Set(),
    sources: new Set(allSourceCodes.filter(s => s !== "PHB")),
  };

  for (const chip of $$(".chip.active")) chip.classList.remove("active");
  updateSourceButtonLabel();
  saveSources();
  applyFilters();
}

// ========================================
// RENDERING — SPELLS LIST
// ========================================

function renderSpellsList(spells) {
  const container = dom.spellsContainer;
  container.innerHTML = "";

  if (spells.length === 0) {
    container.innerHTML = '<p class="spellbook-empty">No spells found with current filters.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();
  for (let i = 0; i < spells.length; i++) {
    const card = createSpellCard(spells[i], i);
    fragment.appendChild(card);
  }
  container.appendChild(fragment);
}

function createSpellCard(spell, index) {
  const card = document.createElement("div");
  card.className = "spell-card";
  card.dataset.key = spell._key;
  card.style.animationDelay = `${Math.min(index * 15, 300)}ms`;

  const school = SCHOOL_MAP[spell.school] || { name: spell.school, var: "--school-abjuration" };
  const schoolColor = getComputedStyle(document.documentElement).getPropertyValue(school.var).trim() || "#999";
  const inBook = spellbook.some(s => s._key === spell._key);

  const srcAbbr = sourceLabel(spell.source);
  const srcFull = booksMap[spell.source] || spell.source;

  const tags = [];
  if (spell.meta?.ritual) tags.push('<span class="spell-card-tag tag-ritual">Ritual</span>');
  if (spell.duration?.some(d => d.concentration)) tags.push('<span class="spell-card-tag tag-conc">Conc.</span>');

  const condRegex = /\{@condition ([^|}]+)\|?[^}]*\}/g;
  const spellText = JSON.stringify(spell.entries || []) + JSON.stringify(spell.entriesHigherLevel || []);
  const condNames = new Set();
  let cm;
  while ((cm = condRegex.exec(spellText)) !== null) condNames.add(cm[1]);
  for (const cn of [...condNames].sort()) {
    tags.push(`<span class="spell-card-tag tag-cond">${cn}</span>`);
  }

  card.innerHTML = `
    <div class="spell-name-row">
      <span class="spell-name">${spell.name}</span>
      <span class="spell-index">#${spell._globalIndex || '-'} <small>(${spell.level === 0 ? 'C' : spell.level}-${spell._levelIndex || '-'})</small></span>
    </div>
    <div class="spell-meta">
      <span class="spell-school-dot" style="background:${schoolColor}" title="${school.name}"></span>
      <span>${school.name}</span>
      <span>·</span>
      <span>${LEVEL_LABELS[spell.level]}</span>
      <span>·</span>
      <span title="${srcFull}">${srcAbbr}</span>
    </div>
    ${tags.length ? `<div class="spell-card-tags">${tags.join("")}</div>` : ""}
    <button class="spell-add-btn ${inBook ? 'in-book' : ''}" title="${inBook ? 'In spellbook' : 'Add to spellbook'}">
      ${inBook ? '✓' : '+'}
    </button>
  `;

  card.querySelector(".spell-name").addEventListener("click", () => openSpellModal(spell));
  card.querySelector(".spell-add-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    toggleSpellInBook(spell);
  });

  return card;
}

function closeMobilePanels() {
  $("#filters-panel").classList.remove("open");
  $("#spellbook-panel").classList.remove("open");
  $("#mobile-overlay").classList.add("hidden");
}

function setView(view) {
  currentView = view;
  dom.spellsContainer.className = view === "grid" ? "spells-grid" : "spells-list";
  $("#view-grid").classList.toggle("active", view === "grid");
  $("#view-list").classList.toggle("active", view === "list");
}

// ========================================
// RENDERING — SPELLBOOK
// ========================================

function renderSpellbook() {
  const container = dom.bookContainer;
  container.innerHTML = "";
  dom.bookCount.textContent = spellbook.length;

  if (spellbook.length === 0) {
    container.innerHTML = '<p class="spellbook-empty">Your spellbook is empty.<br>Add spells from the list.</p>';
    return;
  }

  const grouped = {};
  for (const spell of spellbook) {
    const lvl = spell.level;
    if (!grouped[lvl]) grouped[lvl] = [];
    grouped[lvl].push(spell);
  }

  for (const level of Object.keys(grouped).sort((a, b) => a - b)) {
    const group = document.createElement("div");
    group.className = "spellbook-level-group";

    const header = document.createElement("div");
    header.className = "spellbook-level-header";
    header.textContent = LEVEL_LABELS[level];
    group.appendChild(header);

    for (const spell of grouped[level]) {
      const item = createBookSpellItem(spell);
      group.appendChild(item);
    }

    container.appendChild(group);
  }

  refreshAddButtons();
}

function createBookSpellItem(spell) {
  const item = document.createElement("div");
  item.className = "book-spell";
  item.draggable = true;
  item.dataset.key = spell._key;

  const school = SCHOOL_MAP[spell.school] || { name: spell.school, var: "--school-abjuration" };
  const schoolColor = getComputedStyle(document.documentElement).getPropertyValue(school.var).trim() || "#999";

  item.innerHTML = `
    <span class="spell-school-dot" style="background:${schoolColor}" title="${school.name}"></span>
    <span class="spell-level-badge">${spell.level === 0 ? 'T' : spell.level}</span>
    <span class="spell-name">${spell.name}</span>
    <button class="spell-remove-btn" title="Remove">×</button>
  `;

  item.querySelector(".spell-name").addEventListener("click", () => openSpellModal(spell));
  item.querySelector(".spell-remove-btn").addEventListener("click", () => {
    removeFromBook(spell._key);
  });

  item.addEventListener("dragstart", (e) => {
    item.classList.add("dragging");
    e.dataTransfer.setData("text/plain", spell._key);
  });

  item.addEventListener("dragend", () => {
    item.classList.remove("dragging");
  });

  return item;
}

// ========================================
// SPELLBOOK OPERATIONS
// ========================================

function toggleSpellInBook(spell) {
  const idx = spellbook.findIndex(s => s._key === spell._key);
  if (idx >= 0) {
    spellbook.splice(idx, 1);
  } else {
    spellbook.push(spell);
  }
  persistSpellbook(spellbook);
  renderSpellbook();
  refreshAddButtons();
}

function removeFromBook(key) {
  spellbook = spellbook.filter(s => s._key !== key);
  persistSpellbook(spellbook);
  renderSpellbook();
  refreshAddButtons();
}

function refreshAddButtons() {
  const bookKeys = new Set(spellbook.map(s => s._key));
  for (const btn of $$(".spell-add-btn")) {
    const card = btn.closest(".spell-card");
    if (!card || !card.dataset.key) continue;
    const inBook = bookKeys.has(card.dataset.key);
    btn.classList.toggle("in-book", inBook);
    btn.textContent = inBook ? "✓" : "+";
    btn.title = inBook ? "In spellbook" : "Add to spellbook";
  }
}

// ========================================
// SPELL DETAIL MODAL
// ========================================

function openSpellModal(spell) {
  const school = SCHOOL_MAP[spell.school] || { name: spell.school };

  const castingTime = spell.time
    ? spell.time.map(t => `${t.number} ${t.unit}`).join(", ")
    : "—";

  const range = formatRange(spell.range);
  const components = formatComponents(spell.components);
  const duration = spell.duration ? spell.duration.map(formatDuration).join(", ") : "—";
  const concentration = spell.duration?.some(d => d.concentration) ? " (Concentration)" : "";
  const ritual = spell.meta?.ritual ? " [Ritual]" : "";
  const classes = [...spell._classes].sort().join(", ") || "—";

  const entries = formatEntries(spell.entries || []);
  const higherLevel = spell.entriesHigherLevel ? formatEntries(spell.entriesHigherLevel) : "";

  const inBook = spellbook.some(s => s._key === spell._key);

  dom.modalBody.innerHTML = `
    <h3>${spell.name}${ritual}</h3>
    <div class="spell-detail-meta">
      <span class="spell-detail-tag">${LEVEL_LABELS[spell.level]}</span>
      <span class="spell-detail-tag">${school.name}</span>
      <span class="spell-detail-tag">${booksMap[spell.source] || spell.source}</span>
    </div>

    <div class="spell-detail-section">
      <strong>Casting Time:</strong>
      <p>${castingTime}</p>
    </div>
    <div class="spell-detail-section">
      <strong>Range:</strong>
      <p>${range}</p>
    </div>
    <div class="spell-detail-section">
      <strong>Components:</strong>
      <p>${components}</p>
    </div>
    <div class="spell-detail-section">
      <strong>Duration:</strong>
      <p>${duration}${concentration}</p>
    </div>
    <div class="spell-detail-section">
      <strong>Classes:</strong>
      <p>${classes}</p>
    </div>

    <hr style="border-color: var(--border-color); margin: 1rem 0;">

    <div class="spell-detail-entries">${entries}</div>
    ${higherLevel ? `<div class="spell-detail-section"><strong>At Higher Levels:</strong><div class="spell-detail-entries">${higherLevel}</div></div>` : ''}

    <div class="spell-detail-add">
      <button class="btn-primary" id="modal-add-btn">
        ${inBook ? '✓ In Spellbook' : '+ Add to Spellbook'}
      </button>
    </div>
  `;

  $("#modal-add-btn").addEventListener("click", () => {
    toggleSpellInBook(spell);
    const nowInBook = spellbook.some(s => s._key === spell._key);
    $("#modal-add-btn").textContent = nowInBook ? "✓ In Spellbook" : "+ Add to Spellbook";
  });

  dom.spellModal.classList.remove("hidden");
}

// ========================================
// IMPORT / EXPORT HANDLERS
// ========================================

function handleImportTheme(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (data.type !== "spellbook-theme") {
        alert("Invalid file. Select an exported theme JSON.");
        return;
      }

      if (data.baseTheme) {
        dom.themeSelect.value = data.baseTheme;
        document.body.className = `theme-${data.baseTheme}`;
        localStorage.setItem("sb-theme", data.baseTheme);
      }

      if (data.variables) {
        applyCustomVars(data.variables);
        localStorage.setItem("sb-custom-vars", JSON.stringify(data.variables));
      }

      if (data.spellbook && data.spellbook.length > 0) {
        const doLoad = confirm(`This theme includes ${data.spellbook.length} spells. Load the spellbook too?`);
        if (doLoad) {
          const spellMap = new Map(allSpells.map(s => [s._key, s]));
          spellbook = data.spellbook.map(k => spellMap.get(k)).filter(Boolean);
          persistSpellbook(spellbook);
          renderSpellbook();
          applyFilters();
        }
      }

      alert("Theme imported successfully!");
    } catch (err) {
      alert("Error reading file: " + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}

function handleSaveSpellbook() {
  const name = prompt("Name for this spellbook:", `Spellbook ${new Date().toLocaleDateString("en-US")}`);
  if (!name) return;
  saveSpellbookToStorage(name, spellbook, dom.themeSelect.value);
  alert(`"${name}" saved with ${spellbook.length} spells!`);
}

function openLoadModal() {
  const saved = getSavedSpellbooks();
  dom.savedList.innerHTML = "";

  if (saved.length === 0) {
    dom.savedList.innerHTML = '<p class="spellbook-empty">No saved spellbooks.</p>';
    dom.savedModal.classList.remove("hidden");
    return;
  }

  for (const sb of saved) {
    const item = document.createElement("div");
    item.className = "saved-item";
    item.innerHTML = `
      <div class="saved-item-info">
        <div class="saved-item-name">${sb.name}</div>
        <div class="saved-item-count">${sb.spells.length} spells · ${new Date(sb.date).toLocaleDateString("en-US")}</div>
      </div>
      <div class="saved-item-actions">
        <button class="btn-secondary sb-load-btn">Load</button>
        <button class="btn-secondary sb-export-btn">📤</button>
        <button class="btn-secondary btn-danger sb-delete-btn">🗑</button>
      </div>
    `;

    item.querySelector(".sb-load-btn").addEventListener("click", () => {
      spellbook = loadSavedSpellbook(sb, allSpells);
      persistSpellbook(spellbook);
      renderSpellbook();
      applyFilters();
      if (sb.theme) {
        dom.themeSelect.value = sb.theme;
        setTheme(sb.theme);
      }
      dom.savedModal.classList.add("hidden");
    });

    item.querySelector(".sb-export-btn").addEventListener("click", () => {
      downloadJSON({
        type: "spellbook-theme",
        version: 1,
        name: sb.name,
        baseTheme: sb.theme || dom.themeSelect.value,
        variables: {},
        spellbook: sb.spells,
      }, `${sb.name.replace(/\s+/g, '-')}.json`);
    });

    item.querySelector(".sb-delete-btn").addEventListener("click", () => {
      if (confirm(`Delete "${sb.name}"?`)) {
        deleteSavedSpellbook(sb.id);
        openLoadModal();
      }
    });

    dom.savedList.appendChild(item);
  }

  dom.savedModal.classList.remove("hidden");
}

function handleImportSpellbook(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const result = parseSpellbookImport(ev.target.result, allSpells);

      const merge = spellbook.length > 0
        ? confirm(`You already have ${spellbook.length} spells. Merge with imported ${result.spells.length} spells?\n\nOK = Merge  |  Cancel = Replace`)
        : false;

      if (merge) {
        const existing = new Set(spellbook.map(s => s._key));
        for (const sp of result.spells) {
          if (!existing.has(sp._key)) spellbook.push(sp);
        }
      } else {
        spellbook = result.spells;
      }

      persistSpellbook(spellbook);
      renderSpellbook();
      applyFilters();

      if (result.theme) {
        dom.themeSelect.value = result.theme;
        setTheme(result.theme);
      }

      alert(`Imported ${result.spells.length} spells successfully!`);
    } catch (err) {
      alert(err.message || "Error reading file.");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}

// ========================================
// DRAG AND DROP (Spellbook reorder)
// ========================================

document.addEventListener("dragover", (e) => {
  e.preventDefault();
  const bookPanel = dom.bookContainer;
  const dragging = bookPanel.querySelector(".dragging");
  if (!dragging) return;

  const siblings = [...bookPanel.querySelectorAll(".book-spell:not(.dragging)")];
  const next = siblings.find(s => {
    const box = s.getBoundingClientRect();
    return e.clientY < box.top + box.height / 2;
  });

  if (next) {
    next.parentNode.insertBefore(dragging, next);
  } else if (siblings.length > 0) {
    const last = siblings[siblings.length - 1];
    last.parentNode.insertBefore(dragging, last.nextSibling);
  }
});

document.addEventListener("drop", (e) => {
  e.preventDefault();
  const items = [...dom.bookContainer.querySelectorAll(".book-spell")];
  const newOrder = items.map(item => item.dataset.key);
  const spellMap = new Map(spellbook.map(s => [s._key, s]));
  spellbook = newOrder.map(k => spellMap.get(k)).filter(Boolean);
  persistSpellbook(spellbook);
  renderSpellbook();
});

// ========================================
// INIT
// ========================================

init();
