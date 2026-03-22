import { SOURCE_ALIAS } from './constants.js';

export function sourceLabel(code) {
  return SOURCE_ALIAS[code] || code;
}

export function translateUnit(unit) {
  return unit;
}

export function formatRange(range) {
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

export function formatComponents(comp) {
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

export function formatDuration(dur) {
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

export function formatDurationShort(durations) {
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

export function formatEntries(entries) {
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

export function formatTable(table, compact = false) {
  const fontSize = compact ? "6pt" : "0.85rem";
  const margin = compact ? "1mm 0" : "0.5rem 0";
  const padding = compact ? "0.5mm 1mm" : "0.3rem 0.5rem";

  let html = `<table style='border-collapse:collapse;width:100%;font-size:${fontSize};margin:${margin};'>`;
  if (table.caption) {
    html += `<caption style="text-align:left;font-weight:bold;margin-bottom:0.3rem;">${cleanTags(table.caption)}</caption>`;
  }
  if (table.colLabels) {
    html += "<thead><tr>";
    for (const col of table.colLabels) {
      html += `<th style="border-bottom:1px solid var(--border-color);padding:${padding};text-align:left;font-size:${fontSize};">${cleanTags(col)}</th>`;
    }
    html += "</tr></thead>";
  }
  if (table.rows) {
    html += "<tbody>";
    for (const row of table.rows) {
      html += "<tr>";
      for (const cell of row) {
        const text = typeof cell === "string"
          ? cell
          : (cell.roll ? `${cell.roll.min || cell.roll.exact}${cell.roll.max ? '–' + cell.roll.max : ''}` : JSON.stringify(cell));
        html += `<td style="border-bottom:1px solid var(--border-color);padding:${padding};font-size:${fontSize};">${cleanTags(text)}</td>`;
      }
      html += "</tr>";
    }
    html += "</tbody>";
  }
  return html + "</table>";
}

export function cleanTags(text) {
  if (typeof text !== "string") return String(text);
  return text
    .replace(/summonSpellLevel/g, "the spell's level")
    .replace(/\{@damage ([^}]+)\}/g, '<strong>$1</strong>')
    .replace(/\{@dice ([^}]+)\}/g, '<strong>$1</strong>')
    .replace(/\{@hit ([^}]+)\}/g, '+$1')
    .replace(/\{@hitYourSpellAttack\s?[^}]*\}/g, '<em>your spell attack modifier</em>')
    .replace(/\{@h\}/g, '<em>Hit: </em>')
    .replace(/\{@atkr ([^}]+)\}/g, (_, m) => {
      if (m.trim() === "m") return "<em>Melee Attack Roll:</em>";
      if (m.trim() === "r") return "<em>Ranged Attack Roll:</em>";
      return "<em>Attack Roll:</em>";
    })
    .replace(/\{@actSave (\w+)\}/g, (_, ab) => `<strong>${ab.charAt(0).toUpperCase() + ab.slice(1)} Saving Throw:</strong>`)
    .replace(/\{@actSaveFail\}/g, '<em>Failure:</em>')
    .replace(/\{@actSaveSuccess\}/g, '<em>Success:</em>')
    .replace(/\{@actTrigger\}/g, '<em>Trigger:</em>')
    .replace(/\{@actResponse\}/g, '<em>Response:</em>')
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
