import { rgbToHex, lightenColor, $, downloadJSON } from './utils.js';

export function setTheme(theme) {
  document.body.className = `theme-${theme}`;
  document.body.removeAttribute("style");
  localStorage.setItem("sb-theme", theme);
  localStorage.removeItem("sb-custom-vars");
}

export function applyCustomVars(vars) {
  for (const [prop, val] of Object.entries(vars)) {
    document.body.style.setProperty(prop, val);
  }
  if (vars["--font-size-base"]) {
    document.documentElement.style.fontSize = vars["--font-size-base"];
  }
}

export function loadSavedCustomVars() {
  const savedCustom = localStorage.getItem("sb-custom-vars");
  if (savedCustom) {
    try {
      const vars = JSON.parse(savedCustom);
      applyCustomVars(vars);
    } catch (_) {}
  }
}

export function readCustomizeInputs() {
  return {
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
}

export function populateCustomizeInputs() {
  const cs = getComputedStyle(document.body);
  $("#cust-bg-color").value = rgbToHex(cs.getPropertyValue("--bg-color").trim());
  $("#cust-text-color").value = rgbToHex(cs.getPropertyValue("--text-color").trim());
  $("#cust-accent-color").value = rgbToHex(cs.getPropertyValue("--accent-color").trim());
  $("#cust-card-bg").value = rgbToHex(cs.getPropertyValue("--card-bg").trim());
  $("#cust-border-color").value = rgbToHex(cs.getPropertyValue("--border-color").trim());
  $("#cust-header-bg").value = rgbToHex(cs.getPropertyValue("--header-bg").trim());
}

export function exportThemeData(themeSelectValue, spellbookKeys) {
  const cs = getComputedStyle(document.body);
  const themeData = {
    type: "spellbook-theme",
    version: 1,
    name: `Custom Theme — ${new Date().toLocaleDateString("en-US")}`,
    baseTheme: themeSelectValue,
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
    spellbook: spellbookKeys,
  };
  downloadJSON(themeData, "spellbook-theme.json");
}
