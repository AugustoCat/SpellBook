/* ========================================
   GRIMOIRE VIEW — Render & Print
   ======================================== */

   const DATA_BASE = "./data";

   const SOURCE_ALIAS = { XPHB: "PHB (2024)" };
   function sourceLabel(code) { return SOURCE_ALIAS[code] || code; }
   
   const SCHOOL_MAP = {
     A: "Abjuration", C: "Conjuration", D: "Divination",
     E: "Enchantment", V: "Evocation", I: "Illusion",
     N: "Necromancy", T: "Transmutation",
   };
   
   const LEVEL_LABELS = {
     0: "Cantrip", 1: "1st Level", 2: "2nd Level", 3: "3rd Level",
     4: "4th Level", 5: "5th Level", 6: "6th Level", 7: "7th Level",
     8: "8th Level", 9: "9th Level",
   };
   
   const THEME_LAYOUTS = {
     medieval:     { perPage: 4, css: "layout-4quad" },
     elfico:       { perPage: 4, css: "layout-4quad" },
     runico:       { perPage: 4, css: "layout-4quad" },
     dragao:       { perPage: 4, css: "layout-4quad" },
     arcano:       { perPage: 4, css: "layout-4quad" },
     simples:      { perPage: 4, css: "layout-4quad" },
     necronomicon: { perPage: 1, css: "layout-single" },
     scroll:       { perPage: 2, css: "layout-2row" },
     spellcard:    { perPage: 6, css: "layout-6grid" },
     codex:        { perPage: 3, css: "layout-3stack" },
   };
   
   const THEME_SEPARATORS = {
  medieval: {
      center: "❖",
      h: "⚜ ✠ ⚜ ✠ ⚜ ✠ ⚜ ✠ ⚜",
      v: "⚜ ✠ ⚜ ✠ ⚜ ✠ ⚜ ✠ ⚜",
    },
     elfico: {
       center: "❦",
       h: "❧ ✿ ❧ ✿ ❧ ✿ ❧",
       v: "❧ ✿ ❧ ✿ ❧ ✿ ❧",
     },
     runico: {
       center: "ᛟ",
       h: "ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ ᚺ ᚾ ᛁ ᛃ ᛇ ᛈ ᛉ ᛊ ᛏ ᛒ ᛖ ᛗ ᛚ ᛞ",
       v: "ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ ᚺ ᚾ ᛁ ᛃ ᛇ ᛈ ᛉ ᛊ ᛏ ᛒ ᛖ ᛗ ᛚ ᛞ",
     },
     dragao: {
       center: "☬",
       h: "⟡ ⬥ ⟡ ⬥ ⟡ ⬥ ⟡ ⬥ ⟡",
       v: "⟡ ⬥ ⟡ ⬥ ⟡ ⬥ ⟡ ⬥ ⟡",
     },
     arcano: {
       center: "✴",
       h: "⊹ ✦ ⊹ ✦ ⊹ ✦ ⊹ ✦ ⊹",
       v: "⊹ ✦ ⊹ ✦ ⊹ ✦ ⊹ ✦ ⊹",
     },
     simples: {
       center: "",
       h: "",
       v: "",
     },
     necronomicon: {
       center: "",
       h: "",
       v: "",
     },
     scroll: {
       center: "❈",
       h: "═══ ❈ ═══",
       v: "",
     },
     spellcard: {
       center: "",
       h: "",
       v: "",
     },
     codex: {
       center: "",
       h: "❦═══════❧",
       v: "",
     },
   };
   
   let allSpells = [];
   let spellSources = {};
   let booksMap = {};
   let spellbook = [];
   let currentTheme = "medieval";
   
   // ========================================
   // DATA LOADING
   // ========================================
   
   async function loadData() {
     const [indexRes, booksRes, adventuresRes, sourcesRes] = await Promise.all([
       fetch(`${DATA_BASE}/spells/index.json`).then(r => r.json()),
       fetch(`${DATA_BASE}/books.json`).then(r => r.json()),
       fetch(`${DATA_BASE}/adventures.json`).then(r => r.json()).catch(() => ({ adventure: [] })),
       fetch(`${DATA_BASE}/spells/sources.json`).then(r => r.json()),
     ]);
   
     spellSources = sourcesRes;
   
     for (const book of booksRes.book) booksMap[book.source] = book.name;
     for (const adv of (adventuresRes.adventure || [])) {
       if (!booksMap[adv.source]) booksMap[adv.source] = adv.name;
     }
   
     const spellFiles = Object.values(indexRes);
     const results = await Promise.all(
       spellFiles.map(f => fetch(`${DATA_BASE}/spells/${f}`).then(r => r.json()))
     );
   
     for (const res of results) {
       if (res.spell) {
         for (const spell of res.spell) {
           spell._key = `${spell.name}|${spell.source}`;
           allSpells.push(spell);
         }
       }
     }
   
     const keys = JSON.parse(localStorage.getItem("sb-current") || "[]");
     const spellMap = new Map(allSpells.map(s => [s._key, s]));
     spellbook = keys.map(k => spellMap.get(k)).filter(Boolean);
     spellbook.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
   
     const savedTheme = localStorage.getItem("sb-theme") || "medieval";
     currentTheme = savedTheme;
     document.getElementById("theme-select").value = savedTheme;
     rebuildBodyClasses();
   
     const savedCustom = localStorage.getItem("sb-custom-vars");
     if (savedCustom) {
       try {
         const vars = JSON.parse(savedCustom);
         for (const [prop, val] of Object.entries(vars)) {
           document.body.style.setProperty(prop, val);
         }
       } catch (_) { /* ignore */ }
     }
   
     updatePrintPageSize();
     document.getElementById("grimoire-loading").classList.add("hidden");
     renderGrimoire();
   }
   
   // ========================================
   // RENDERING
   // ========================================
   
   function isMobile() {
     return window.innerWidth <= 768;
   }

   function getLayout() {
     const base = THEME_LAYOUTS[currentTheme] || THEME_LAYOUTS.medieval;
     if (isMobile() && base.perPage > 2) {
       return { perPage: 2, css: "layout-2row" };
     }
     return base;
   }
   
   function renderGrimoire() {
     const container = document.getElementById("pages-container");
     container.innerHTML = "";
   
     if (spellbook.length === 0) {
       container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:4rem;font-size:1.2rem;font-family:var(--font-title);">Spellbook is empty. Go back and add spells.</p>';
       return;
     }
   
     const layout = getLayout();
     const pages = chunkArray(spellbook, layout.perPage);
   
     for (let i = 0; i < pages.length; i++) {
       const page = createPage(pages[i], i + 1, pages.length, layout);
       container.appendChild(page);
     }

     requestAnimationFrame(() => {
       requestAnimationFrame(() => shrinkOverflowingQuadrants());
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
   
     const school = SCHOOL_MAP[spell.school] || spell.school;
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

     q.innerHTML = `
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
   // FORMAT HELPERS (mirrors script.js logic)
   // ========================================
   
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
     if (range.distance) return `${range.type} (${range.distance.amount} ${range.distance.type})`;
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
   
   function formatDurationShort(durations) {
     if (!durations || !durations.length) return "—";
     const dur = durations[0];
     if (dur.type === "instant") return "Instantaneous";
     if (dur.type === "permanent") return "Permanent";
     if (dur.type === "special") return "Special";
     if (dur.type === "timed" && dur.duration) {
       const unitMap = { minute: "min", hour: "hr", day: "day(s)", round: "rnd", year: "yr(s)" };
       return `${dur.duration.amount} ${unitMap[dur.duration.type] || dur.duration.type}`;
     }
     return dur.type || "—";
   }
   
   function formatEntries(entries) {
     return entries.map(entry => {
       if (typeof entry === "string") return `<p>${cleanTags(entry)}</p>`;
       if (entry.type === "entries" && entry.entries) {
         const heading = entry.name ? `<strong>${entry.name}.</strong> ` : "";
         return `<div>${heading}${formatEntries(entry.entries)}</div>`;
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
       if (entry.type === "table") return formatTable(entry);
       return "";
     }).join("");
   }
   
   function formatTable(table) {
     let html = "<table style='border-collapse:collapse;width:100%;font-size:6pt;margin:1mm 0;'>";
     if (table.colLabels) {
       html += "<thead><tr>";
       for (const col of table.colLabels) html += `<th style="border-bottom:1px solid var(--border-color);padding:0.5mm 1mm;text-align:left;font-size:6pt;">${cleanTags(col)}</th>`;
       html += "</tr></thead>";
     }
     if (table.rows) {
       html += "<tbody>";
       for (const row of table.rows) {
         html += "<tr>";
         for (const cell of row) {
           const text = typeof cell === "string" ? cell : (cell.roll ? `${cell.roll.min || cell.roll.exact}${cell.roll.max ? '–' + cell.roll.max : ''}` : JSON.stringify(cell));
           html += `<td style="border-bottom:1px solid var(--border-color);padding:0.5mm 1mm;font-size:6pt;">${cleanTags(text)}</td>`;
         }
         html += "</tr>";
       }
       html += "</tbody>";
     }
     return html + "</table>";
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
   // UTILITIES
   // ========================================
   
   function chunkArray(arr, size) {
     const chunks = [];
     for (let i = 0; i < arr.length; i += size) {
       chunks.push(arr.slice(i, i + size));
     }
     return chunks;
   }
   
   // ========================================
   // EVENT LISTENERS
   // ========================================
   
   const PAGE_SIZES = {
     a4:     { w: "210mm",   h: "297mm" },
     a5:     { w: "148mm",   h: "210mm" },
     letter: { w: "215.9mm", h: "279.4mm" },
     legal:  { w: "215.9mm", h: "355.6mm" },
   };
   
   function updatePrintPageSize() {
     const size = document.getElementById("page-size").value;
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
     const size = document.getElementById("page-size").value;
     const transparent = document.getElementById("toggle-transparent").checked;
     const hasCustom = !!localStorage.getItem("sb-custom-vars");
     document.body.className = `theme-${currentTheme} size-${size}${transparent ? " bg-transparent" : ""}${hasCustom ? " has-custom-vars" : ""}`;
   }
   
   document.getElementById("page-size").addEventListener("change", () => {
     rebuildBodyClasses();
     updatePrintPageSize();
   });
   
   document.getElementById("theme-select").addEventListener("change", (e) => {
     currentTheme = e.target.value;
     rebuildBodyClasses();
   
     const savedCustom = localStorage.getItem("sb-custom-vars");
     if (savedCustom) {
       try {
         const vars = JSON.parse(savedCustom);
         for (const [prop, val] of Object.entries(vars)) {
           document.body.style.setProperty(prop, val);
         }
       } catch (_) { /* ignore */ }
     }
   
     renderGrimoire();
   });
   
   document.getElementById("toggle-transparent").addEventListener("change", () => {
     rebuildBodyClasses();
   
     const savedCustom = localStorage.getItem("sb-custom-vars");
     if (!document.getElementById("toggle-transparent").checked && savedCustom) {
       try {
         const vars = JSON.parse(savedCustom);
         for (const [prop, val] of Object.entries(vars)) {
           document.body.style.setProperty(prop, val);
         }
       } catch (_) { /* ignore */ }
     }
   });
   
  document.getElementById("btn-print").addEventListener("click", () => {
    updatePrintPageSize();

    const container = document.getElementById("pages-container");
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
   
   document.getElementById("btn-pdf").addEventListener("click", async () => {
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

     const btn = document.getElementById("btn-pdf");
     btn.disabled = true;
     btn.textContent = "Generating...";

     const container = document.getElementById("pages-container");
     const savedTransform = container.style.transform;
     const savedOrigin = container.style.transformOrigin;
     const savedMargin = container.style.marginBottom;
     container.style.transform = "none";
     container.style.transformOrigin = "";
     container.style.marginBottom = "";

     await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

     try {
       const size = document.getElementById("page-size").value;
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
   
   // ========================================
   // CUSTOMIZE APPEARANCE
   // ========================================
   
   const $ = (sel) => document.querySelector(sel);
   
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
   
   function openCustomizeModal() {
     const cs = getComputedStyle(document.body);
     $("#cust-bg-color").value = rgbToHex(cs.getPropertyValue("--bg-color").trim());
     $("#cust-text-color").value = rgbToHex(cs.getPropertyValue("--text-color").trim());
     $("#cust-accent-color").value = rgbToHex(cs.getPropertyValue("--accent-color").trim());
     $("#cust-card-bg").value = rgbToHex(cs.getPropertyValue("--card-bg").trim());
     $("#cust-border-color").value = rgbToHex(cs.getPropertyValue("--border-color").trim());
     $("#cust-header-bg").value = rgbToHex(cs.getPropertyValue("--header-bg").trim());
     $("#customize-modal").classList.remove("hidden");
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
   
     rebuildBodyClasses();
     for (const [prop, val] of Object.entries(vars)) {
       document.body.style.setProperty(prop, val);
     }
   
     localStorage.setItem("sb-custom-vars", JSON.stringify(vars));
     $("#customize-modal").classList.add("hidden");
     renderGrimoire();
   }
   
   function resetCustomTheme() {
     document.body.removeAttribute("style");
     localStorage.removeItem("sb-custom-vars");
     rebuildBodyClasses();
     $("#customize-modal").classList.add("hidden");
     renderGrimoire();
   }
   
   $("#btn-customize").addEventListener("click", openCustomizeModal);
   $("#cust-apply").addEventListener("click", applyCustomTheme);
   $("#cust-reset").addEventListener("click", resetCustomTheme);
   
   $("#customize-modal").addEventListener("click", (e) => {
     if (e.target === e.currentTarget) $("#customize-modal").classList.add("hidden");
   });
   
   $("#customize-modal .modal-close").addEventListener("click", () => {
     $("#customize-modal").classList.add("hidden");
   });
   
   // ========================================
   // ZOOM
   // ========================================

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

   // ========================================
   // RESPONSIVE RE-RENDER
   // ========================================

   let lastMobile = isMobile();
   window.addEventListener("resize", () => {
     const nowMobile = isMobile();
     if (nowMobile !== lastMobile) {
       lastMobile = nowMobile;
       if (spellbook.length > 0) renderGrimoire();
     }
   });

   // ========================================
   // INIT
   // ========================================
   
   loadData();
   