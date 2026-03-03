/* ========================================
   SPELLBOOK CREATOR — D&D 5e
   Main Application Script
   ======================================== */

const DATA_BASE = "./data";

const SOURCE_ALIAS = { XPHB: "PHB (2024)" };
function sourceLabel(code) { return SOURCE_ALIAS[code] || code; }

const SCHOOL_MAP = {
  A: { name: "Abjuration", var: "--school-abjuration" },
  C: { name: "Conjuration", var: "--school-conjuration" },
  D: { name: "Divination", var: "--school-divination" },
  E: { name: "Enchantment", var: "--school-enchantment" },
  V: { name: "Evocation", var: "--school-evocation" },
  I: { name: "Illusion", var: "--school-illusion" },
  N: { name: "Necromancy", var: "--school-necromancy" },
  T: { name: "Transmutation", var: "--school-transmutation" },
};

const CLASS_LIST = [
  "Artificer", "Bard", "Cleric", "Druid", "Monk",
  "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard",
];

const LEVEL_LABELS = {
  0: "Cantrip", 1: "1st Level", 2: "2nd Level", 3: "3rd Level",
  4: "4th Level", 5: "5th Level", 6: "6th Level", 7: "7th Level",
  8: "8th Level", 9: "9th Level",
};

// ---- State ----
let allSpells = [];
let spellSources = {};
let booksMap = {};
let spellbook = [];
let allSourceCodes = [];
let activeFilters = { name: "", classes: new Set(), levels: new Set(), schools: new Set(), sources: new Set() };
let currentView = "grid";

// ---- DOM Elements ----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

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

async function loadData() {
  try {
    const [indexRes, booksRes, adventuresRes, sourcesRes] = await Promise.all([
      fetch(`${DATA_BASE}/spells/index.json`).then(r => r.json()),
      fetch(`${DATA_BASE}/books.json`).then(r => r.json()),
      fetch(`${DATA_BASE}/adventures.json`).then(r => r.json()).catch(() => ({ adventure: [] })),
      fetch(`${DATA_BASE}/spells/sources.json`).then(r => r.json()),
    ]);

    spellSources = sourcesRes;

    for (const book of booksRes.book) {
      booksMap[book.source] = book.name;
    }
    for (const adv of (adventuresRes.adventure || [])) {
      if (!booksMap[adv.source]) booksMap[adv.source] = adv.name;
    }

    const spellFiles = Object.values(indexRes);
    const spellPromises = spellFiles.map(file =>
      fetch(`${DATA_BASE}/spells/${file}`).then(r => r.json())
    );
    const spellResults = await Promise.all(spellPromises);

    for (const result of spellResults) {
      if (result.spell) {
        for (const spell of result.spell) {
          spell._classes = getSpellClasses(spell.name, spell.source);
          spell._key = `${spell.name}|${spell.source}`;
          allSpells.push(spell);
        }
      }
    }

    allSpells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

    initUI();
    loadSpellbookFromStorage();
    applyFilters();

    dom.loading.classList.add("hidden");
    setTimeout(() => dom.loading.remove(), 600);
  } catch (err) {
    console.error("Error loading data:", err);
    dom.loading.querySelector("p").textContent = "Error loading data. Check the console.";
  }
}

function getSpellClasses(spellName, source) {
  const classes = new Set();
  const sourceData = spellSources[source];
  if (sourceData && sourceData[spellName]) {
    const classList = sourceData[spellName].class;
    if (classList) {
      for (const c of classList) {
        classes.add(c.name);
      }
    }
  }
  return classes;
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

  activeFilters.sources = new Set(allSourceCodes);
  renderSourcesList();
  updateSourceButtonLabel();
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
      applyFilters();
    });
  }

  $("#btn-clear-filters").addEventListener("click", clearFilters);

  $("#view-grid").addEventListener("click", () => setView("grid"));
  $("#view-list").addEventListener("click", () => setView("list"));

  dom.themeSelect.addEventListener("change", () => {
    setTheme(dom.themeSelect.value);
  });

  $("#btn-customize").addEventListener("click", openCustomizeModal);
  $("#btn-export-theme").addEventListener("click", exportTheme);
  $("#btn-import-theme").addEventListener("click", () => $("#import-theme-file").click());
  $("#import-theme-file").addEventListener("change", importTheme);

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
    persistSpellbook();
    window.location.href = "grimoire.html";
  });

  $("#btn-save-spellbook").addEventListener("click", saveSpellbook);
  $("#btn-load-spellbook").addEventListener("click", openLoadModal);
  $("#btn-clear-spellbook").addEventListener("click", () => {
    if (spellbook.length === 0) return;
    if (confirm("Clear all spells from the spellbook?")) {
      spellbook = [];
      persistSpellbook();
      renderSpellbook();
    }
  });

  $("#btn-export-spellbook").addEventListener("click", exportSpellbookJSON);
  $("#btn-import-spellbook").addEventListener("click", () => $("#import-spellbook-file").click());
  $("#import-spellbook-file").addEventListener("change", importSpellbookJSON);

  $("#cust-apply").addEventListener("click", applyCustomTheme);
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

  const savedTheme = localStorage.getItem("sb-theme");
  if (savedTheme) {
    dom.themeSelect.value = savedTheme;
    setTheme(savedTheme);
  }

  const savedCustom = localStorage.getItem("sb-custom-vars");
  if (savedCustom) {
    try {
      const vars = JSON.parse(savedCustom);
      applyCustomVars(vars);
    } catch (_) { /* ignore */ }
  }
}

// ========================================
// FILTERING
// ========================================

function toggleFilterSet(set, value) {
  if (set.has(value)) set.delete(value);
  else set.add(value);
}

function applyFilters() {
  const filtered = allSpells.filter(spell => {
    if (activeFilters.name && !spell.name.toLowerCase().includes(activeFilters.name)) {
      return false;
    }

    if (activeFilters.classes.size > 0) {
      let hasClass = false;
      for (const cls of activeFilters.classes) {
        if (spell._classes.has(cls)) { hasClass = true; break; }
      }
      if (!hasClass) return false;
    }

    if (activeFilters.levels.size > 0 && !activeFilters.levels.has(spell.level)) {
      return false;
    }

    if (activeFilters.schools.size > 0 && !activeFilters.schools.has(spell.school)) {
      return false;
    }

    if (activeFilters.sources.size < allSourceCodes.length && !activeFilters.sources.has(spell.source)) {
      return false;
    }

    return true;
  });

  dom.spellsCount.textContent = filtered.length;
  renderSpellsList(filtered);
}

function clearFilters() {
  dom.filterName.value = "";
  activeFilters = {
    name: "",
    classes: new Set(),
    levels: new Set(),
    schools: new Set(),
    sources: new Set(allSourceCodes),
  };

  for (const chip of $$(".chip.active")) chip.classList.remove("active");
  updateSourceButtonLabel();

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

  const MAX_RENDER = 200;
  const toRender = spells.slice(0, MAX_RENDER);

  const fragment = document.createDocumentFragment();
  for (let i = 0; i < toRender.length; i++) {
    const spell = toRender[i];
    const card = createSpellCard(spell, i);
    fragment.appendChild(card);
  }
  container.appendChild(fragment);

  if (spells.length > MAX_RENDER) {
    const more = document.createElement("p");
    more.className = "spellbook-empty";
    more.textContent = `Showing ${MAX_RENDER} of ${spells.length} spells. Use filters to narrow down.`;
    container.appendChild(more);
  }
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

  card.innerHTML = `
    <span class="spell-name">${spell.name}</span>
    <div class="spell-meta">
      <span class="spell-school-dot" style="background:${schoolColor}" title="${school.name}"></span>
      <span>${school.name}</span>
      <span>·</span>
      <span>${LEVEL_LABELS[spell.level]}</span>
      <span>·</span>
      <span title="${srcFull}">${srcAbbr}</span>
    </div>
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
    <button class="spell-remove-btn" title="Remover">×</button>
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
  persistSpellbook();
  renderSpellbook();
  refreshAddButtons();
}

function removeFromBook(key) {
  spellbook = spellbook.filter(s => s._key !== key);
  persistSpellbook();
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

function persistSpellbook() {
  const keys = spellbook.map(s => s._key);
  localStorage.setItem("sb-current", JSON.stringify(keys));
}

function loadSpellbookFromStorage() {
  try {
    const data = localStorage.getItem("sb-current");
    if (!data) return;
    const keys = JSON.parse(data);
    const spellMap = new Map(allSpells.map(s => [s._key, s]));
    spellbook = keys.map(k => spellMap.get(k)).filter(Boolean);
    renderSpellbook();
  } catch (_) { /* ignore */ }
}

// ========================================
// SPELL DETAIL MODAL
// ========================================

function openSpellModal(spell) {
  const school = SCHOOL_MAP[spell.school] || { name: spell.school };

  const castingTime = spell.time
    ? spell.time.map(t => `${t.number} ${translateUnit(t.unit)}`).join(", ")
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

function translateUnit(unit) {
  return unit;
}

function formatRange(range) {
  if (!range) return "—";
  if (range.type === "point") {
    if (range.distance) {
      if (range.distance.type === "self") return "Self";
      if (range.distance.type === "touch") return "Touch";
      if (range.distance.type === "sight") return "Sight";
      if (range.distance.type === "unlimited") return "Unlimited";
      return `${range.distance.amount} ${range.distance.type}`;
    }
    return "Self";
  }
  if (range.type === "special") return "Special";
  if (range.distance) {
    return `${range.type} (${range.distance.amount} ${range.distance.type})`;
  }
  return "—";
}

function formatComponents(comp) {
  if (!comp) return "—";
  const parts = [];
  if (comp.v) parts.push("V");
  if (comp.s) parts.push("S");
  if (comp.m) {
    const mat = typeof comp.m === "string" ? comp.m : (comp.m.text || "material");
    parts.push(`M (${mat})`);
  }
  return parts.join(", ") || "—";
}

function formatDuration(dur) {
  if (dur.type === "instant") return "Instantaneous";
  if (dur.type === "permanent") return "Permanent";
  if (dur.type === "special") return "Special";
  if (dur.type === "timed" && dur.duration) {
    const amt = dur.duration.amount;
    const unit = dur.duration.type;
    const plural = amt > 1 ? "s" : "";
    return `${amt} ${unit}${plural}`;
  }
  return dur.type || "—";
}

function formatEntries(entries) {
  return entries.map(entry => {
    if (typeof entry === "string") {
      return `<p>${cleanTags(entry)}</p>`;
    }
    if (entry.type === "entries" && entry.entries) {
      const sub = formatEntries(entry.entries);
      const heading = entry.name ? `<strong>${entry.name}.</strong> ` : "";
      return `<div>${heading}${sub}</div>`;
    }
    if (entry.type === "list" && entry.items) {
      const items = entry.items.map(item => {
        if (typeof item === "string") return `<li>${cleanTags(item)}</li>`;
        if (item.type === "item" && item.entries) {
          return `<li><strong>${item.name}.</strong> ${formatEntries(item.entries)}</li>`;
        }
        return `<li>${cleanTags(JSON.stringify(item))}</li>`;
      }).join("");
      return `<ul>${items}</ul>`;
    }
    if (entry.type === "table") {
      return formatTable(entry);
    }
    return "";
  }).join("");
}

function formatTable(table) {
  let html = "<table style='border-collapse:collapse;width:100%;margin:0.5rem 0;font-size:0.85rem;'>";
  if (table.caption) html += `<caption style="text-align:left;font-weight:bold;margin-bottom:0.3rem;">${cleanTags(table.caption)}</caption>`;
  if (table.colLabels) {
    html += "<thead><tr>";
    for (const col of table.colLabels) html += `<th style="border-bottom:1px solid var(--border-color);padding:0.3rem 0.5rem;text-align:left;">${cleanTags(col)}</th>`;
    html += "</tr></thead>";
  }
  if (table.rows) {
    html += "<tbody>";
    for (const row of table.rows) {
      html += "<tr>";
      for (const cell of row) {
        const text = typeof cell === "string" ? cell : (cell.roll ? `${cell.roll.min || cell.roll.exact}${cell.roll.max ? '–' + cell.roll.max : ''}` : JSON.stringify(cell));
        html += `<td style="border-bottom:1px solid var(--border-color);padding:0.3rem 0.5rem;">${cleanTags(text)}</td>`;
      }
      html += "</tr>";
    }
    html += "</tbody>";
  }
  html += "</table>";
  return html;
}

function cleanTags(text) {
  if (typeof text !== "string") return String(text);
  return text
    .replace(/\{@damage ([^}]+)\}/g, '<strong>$1</strong>')
    .replace(/\{@dice ([^}]+)\}/g, '<strong>$1</strong>')
    .replace(/\{@hit ([^}]+)\}/g, '+$1')
    .replace(/\{@spell ([^|}]+)\|?[^}]*\}/g, '<em>$1</em>')
    .replace(/\{@condition ([^|}]+)\|?[^}]*\}/g, '<em>$1</em>')
    .replace(/\{@creature ([^|}]+)\|?[^}]*\}/g, '<em>$1</em>')
    .replace(/\{@item ([^|}]+)\|?[^}]*\}/g, '<em>$1</em>')
    .replace(/\{@filter ([^|}]+)\|?[^}]*\}/g, '$1')
    .replace(/\{@sense ([^|}]+)\|?[^}]*\}/g, '$1')
    .replace(/\{@skill ([^|}]+)\|?[^}]*\}/g, '$1')
    .replace(/\{@action ([^|}]+)\|?[^}]*\}/g, '$1')
    .replace(/\{@scaledamage [^}]+\|[^}]+\|([^}]+)\}/g, '<strong>$1</strong>')
    .replace(/\{@scaledice [^}]+\|[^}]+\|([^}]+)\}/g, '<strong>$1</strong>')
    .replace(/\{@b ([^}]+)\}/g, '<strong>$1</strong>')
    .replace(/\{@i ([^}]+)\}/g, '<em>$1</em>')
    .replace(/\{@atk ([^}]+)\}/g, (_, m) => {
      const types = [];
      if (m.includes("mw")) types.push("melee weapon");
      if (m.includes("rw")) types.push("ranged weapon");
      if (m.includes("ms")) types.push("melee spell");
      if (m.includes("rs")) types.push("ranged spell");
      return types.join(" or ");
    })
    .replace(/\{@(\w+) ([^|}]+)\|?[^}]*\}/g, '$2');
}

// ========================================
// THEMES
// ========================================

function setTheme(theme) {
  document.body.className = `theme-${theme}`;
  document.body.removeAttribute("style");
  localStorage.setItem("sb-theme", theme);
  localStorage.removeItem("sb-custom-vars");
}

function openCustomizeModal() {
  const cs = getComputedStyle(document.body);
  $("#cust-bg-color").value = rgbToHex(cs.getPropertyValue("--bg-color").trim());
  $("#cust-text-color").value = rgbToHex(cs.getPropertyValue("--text-color").trim());
  $("#cust-accent-color").value = rgbToHex(cs.getPropertyValue("--accent-color").trim());
  $("#cust-card-bg").value = rgbToHex(cs.getPropertyValue("--card-bg").trim());
  $("#cust-border-color").value = rgbToHex(cs.getPropertyValue("--border-color").trim());
  $("#cust-header-bg").value = rgbToHex(cs.getPropertyValue("--header-bg").trim());
  dom.customizeModal.classList.remove("hidden");
}

function applyCustomTheme() {
  const vars = {
    "--bg-color": $("#cust-bg-color").value,
    "--text-color": $("#cust-text-color").value,
    "--accent-color": $("#cust-accent-color").value,
    "--accent-hover": lightenColor($("#cust-accent-color").value, 20),
    "--card-bg": $("#cust-card-bg").value,
    "--border-color": $("#cust-border-color").value,
    "--header-bg": $("#cust-header-bg").value,
    "--font-title": $("#cust-font-title").value,
    "--font-body": $("#cust-font-body").value,
    "--font-size-base": $("#cust-font-size").value + "px",
    "--border-radius": $("#cust-border-radius").value + "px",
    "--border-width": $("#cust-border-width").value + "px",
    "--card-shadow": $("#cust-card-shadow").value,
  };

  applyCustomVars(vars);
  localStorage.setItem("sb-custom-vars", JSON.stringify(vars));
  dom.customizeModal.classList.add("hidden");
}

function applyCustomVars(vars) {
  for (const [prop, val] of Object.entries(vars)) {
    document.body.style.setProperty(prop, val);
  }
  if (vars["--font-size-base"]) {
    document.documentElement.style.fontSize = vars["--font-size-base"];
  }
}

function exportTheme() {
  const cs = getComputedStyle(document.body);
  const themeData = {
    type: "spellbook-theme",
    version: 1,
    name: `Custom Theme — ${new Date().toLocaleDateString("en-US")}`,
    baseTheme: dom.themeSelect.value,
    variables: {
      "--bg-color": cs.getPropertyValue("--bg-color").trim(),
      "--bg-secondary": cs.getPropertyValue("--bg-secondary").trim(),
      "--text-color": cs.getPropertyValue("--text-color").trim(),
      "--text-muted": cs.getPropertyValue("--text-muted").trim(),
      "--accent-color": cs.getPropertyValue("--accent-color").trim(),
      "--accent-hover": cs.getPropertyValue("--accent-hover").trim(),
      "--card-bg": cs.getPropertyValue("--card-bg").trim(),
      "--card-hover": cs.getPropertyValue("--card-hover").trim(),
      "--border-color": cs.getPropertyValue("--border-color").trim(),
      "--header-bg": cs.getPropertyValue("--header-bg").trim(),
      "--font-title": cs.getPropertyValue("--font-title").trim(),
      "--font-body": cs.getPropertyValue("--font-body").trim(),
      "--font-size-base": cs.getPropertyValue("--font-size-base").trim(),
      "--border-radius": cs.getPropertyValue("--border-radius").trim(),
      "--border-width": cs.getPropertyValue("--border-width").trim(),
      "--card-shadow": cs.getPropertyValue("--card-shadow").trim(),
    },
    spellbook: spellbook.map(s => s._key),
  };

  downloadJSON(themeData, "spellbook-theme.json");
}

function importTheme(e) {
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
          persistSpellbook();
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

// ========================================
// SAVE / LOAD SPELLBOOKS
// ========================================

function saveSpellbook() {
  const name = prompt("Name for this spellbook:", `Spellbook ${new Date().toLocaleDateString("en-US")}`);
  if (!name) return;

  const saved = getSavedSpellbooks();
  saved.push({
    id: Date.now(),
    name,
    date: new Date().toISOString(),
    spells: spellbook.map(s => s._key),
    theme: dom.themeSelect.value,
  });

  localStorage.setItem("sb-saved", JSON.stringify(saved));
  alert(`"${name}" saved with ${spellbook.length} spells!`);
}

function getSavedSpellbooks() {
  try {
    return JSON.parse(localStorage.getItem("sb-saved") || "[]");
  } catch (_) { return []; }
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
      loadSavedSpellbook(sb);
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

function loadSavedSpellbook(sb) {
  const spellMap = new Map(allSpells.map(s => [s._key, s]));
  spellbook = sb.spells.map(k => spellMap.get(k)).filter(Boolean);
  persistSpellbook();
  renderSpellbook();
  applyFilters();

  if (sb.theme) {
    dom.themeSelect.value = sb.theme;
    setTheme(sb.theme);
  }
}

function deleteSavedSpellbook(id) {
  const saved = getSavedSpellbooks().filter(s => s.id !== id);
  localStorage.setItem("sb-saved", JSON.stringify(saved));
}


function exportSpellbookJSON() {
  if (spellbook.length === 0) {
    alert("Spellbook is empty. Add spells first.");
    return;
  }

  const data = {
    type: "spellbook-export",
    version: 1,
    name: `Spellbook ${new Date().toLocaleDateString("en-US")}`,
    date: new Date().toISOString(),
    theme: dom.themeSelect.value,
    spells: spellbook.map(s => s._key),
  };

  downloadJSON(data, "spellbook.json");
}

function importSpellbookJSON(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (data.type !== "spellbook-export" || !Array.isArray(data.spells)) {
        alert("Invalid file. Select a spellbook JSON exported from this app.");
        return;
      }

      const spellMap = new Map(allSpells.map(s => [s._key, s]));
      const loaded = data.spells.map(k => spellMap.get(k)).filter(Boolean);

      if (loaded.length === 0) {
        alert("No matching spells found in this file.");
        return;
      }

      const merge = spellbook.length > 0
        ? confirm(`You already have ${spellbook.length} spells. Merge with imported ${loaded.length} spells?\n\nOK = Merge  |  Cancel = Replace`)
        : false;

      if (merge) {
        const existing = new Set(spellbook.map(s => s._key));
        for (const sp of loaded) {
          if (!existing.has(sp._key)) spellbook.push(sp);
        }
      } else {
        spellbook = loaded;
      }

      persistSpellbook();
      renderSpellbook();
      applyFilters();

      if (data.theme) {
        dom.themeSelect.value = data.theme;
        setTheme(data.theme);
      }

      alert(`Imported ${loaded.length} spells successfully!`);
    } catch (err) {
      alert("Error reading file: " + err.message);
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
  persistSpellbook();
  renderSpellbook();
});

// ========================================
// UTILITIES
// ========================================

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function rgbToHex(color) {
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

function lightenColor(hex, amount) {
  hex = hex.replace("#", "");
  const r = Math.min(255, parseInt(hex.substring(0, 2), 16) + amount);
  const g = Math.min(255, parseInt(hex.substring(2, 4), 16) + amount);
  const b = Math.min(255, parseInt(hex.substring(4, 6), 16) + amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ========================================
// INIT
// ========================================

loadData();
