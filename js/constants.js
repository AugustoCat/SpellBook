export const DATA_BASE = "./data";

export const SOURCE_ALIAS = { XPHB: "PHB (2024)" };

export const SCHOOL_MAP = {
  A: { name: "Abjuration", var: "--school-abjuration" },
  C: { name: "Conjuration", var: "--school-conjuration" },
  D: { name: "Divination", var: "--school-divination" },
  E: { name: "Enchantment", var: "--school-enchantment" },
  V: { name: "Evocation", var: "--school-evocation" },
  I: { name: "Illusion", var: "--school-illusion" },
  N: { name: "Necromancy", var: "--school-necromancy" },
  T: { name: "Transmutation", var: "--school-transmutation" },
};

export const SCHOOL_NAME_MAP = {
  A: "Abjuration", C: "Conjuration", D: "Divination",
  E: "Enchantment", V: "Evocation", I: "Illusion",
  N: "Necromancy", T: "Transmutation",
};

export const CLASS_LIST = [
  "Artificer", "Bard", "Cleric", "Druid", "Monk",
  "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard",
];

export const LEVEL_LABELS = {
  0: "Cantrip", 1: "1st Level", 2: "2nd Level", 3: "3rd Level",
  4: "4th Level", 5: "5th Level", 6: "6th Level", 7: "7th Level",
  8: "8th Level", 9: "9th Level",
};

export const THEME_LIST = [
  { value: "medieval", label: "Classic Medieval" },
  { value: "elfico", label: "Elvish" },
  { value: "runico", label: "Runic" },
  { value: "dragao", label: "Dragon" },
  { value: "arcano", label: "Arcane" },
  { value: "simples", label: "Simple" },
  { value: "necronomicon", label: "Necronomicon" },
  { value: "scroll", label: "Scroll" },
  { value: "spellcard", label: "Spellcard" },
  { value: "codex", label: "Ancient Codex" },
];

export const THEME_LAYOUTS = {
  medieval: { perPage: 4, css: "layout-4quad" },
  elfico: { perPage: 4, css: "layout-4quad" },
  runico: { perPage: 4, css: "layout-4quad" },
  dragao: { perPage: 4, css: "layout-4quad" },
  arcano: { perPage: 4, css: "layout-4quad" },
  simples: { perPage: 4, css: "layout-4quad" },
  necronomicon: { perPage: 1, css: "layout-single" },
  scroll: { perPage: 2, css: "layout-2row" },
  spellcard: { perPage: 6, css: "layout-6grid" },
  codex: { perPage: 3, css: "layout-3stack" },
};

export const THEME_SEPARATORS = {
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
  simples: { center: "", h: "", v: "" },
  necronomicon: { center: "", h: "", v: "" },
  scroll: { center: "❈", h: "═══ ❈ ═══", v: "" },
  spellcard: { center: "", h: "", v: "" },
  codex: { center: "", h: "❦═══════❧", v: "" },
};

export const PAGE_SIZES = {
  a4: { w: "210mm", h: "297mm" },
  a5: { w: "148mm", h: "210mm" },
  letter: { w: "215.9mm", h: "279.4mm" },
  legal: { w: "215.9mm", h: "355.6mm" },
};

export const LAYOUT_OPTIONS = [
  { value: "auto", label: "Auto (Theme)" },
  { value: "layout-modular", label: "Modular — Flow", perPage: 0 },
  { value: "layout-modular-1col", label: "Modular — 1 Column", perPage: 0 },
  { value: "layout-single", label: "1 per page — Full", perPage: 1 },
  { value: "layout-2row", label: "2 per page — Rows", perPage: 2 },
  { value: "layout-3stack", label: "3 per page — Stack", perPage: 3 },
  { value: "layout-4quad", label: "4 per page — Quad", perPage: 4 },
  { value: "layout-6grid", label: "6 per page — Grid", perPage: 6 },
];
