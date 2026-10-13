// Validates research/creator-stories.json: valid JSON, consistent schema, attribution on every record.
import fs from "node:fs";

const data = JSON.parse(fs.readFileSync(new URL("../research/creator-stories.json", import.meta.url), "utf8"));
const required = ["id", "name", "nameType", "country", "region", "category", "startingSituation", "strategy", "products", "channels", "revenueModel", "reportedOutcomes", "challenges", "lessons", "sources", "confidence", "evidenceNotes", "patterns"];
const errors = [];
const ids = new Set();
for (const s of data.stories) {
  for (const k of required) if (!(k in s)) errors.push(`${s.id ?? "?"}: missing ${k}`);
  if (ids.has(s.id)) errors.push(`duplicate id ${s.id}`);
  ids.add(s.id);
  if (!["real-public", "pseudonym", "organisation", "group"].includes(s.nameType)) errors.push(`${s.id}: bad nameType`);
  if (!["high", "medium", "low"].includes(s.confidence)) errors.push(`${s.id}: bad confidence`);
  if (!Array.isArray(s.sources) || s.sources.length === 0) errors.push(`${s.id}: no sources`);
  for (const src of s.sources ?? []) for (const k of ["title", "publisher", "url", "published", "accessed"]) if (!src[k]) errors.push(`${s.id}: source missing ${k}`);
  for (const o of s.reportedOutcomes ?? []) if (typeof o.selfReported !== "boolean" || !o.attribution) errors.push(`${s.id}: outcome lacks attribution/selfReported`);
  for (const p of s.patterns ?? []) if (!/^P\d+-/.test(p)) errors.push(`${s.id}: bad pattern ${p}`);
}
const nigerian = data.stories.filter((s) => !/comparator/i.test(s.name) && !/NOT a Nigerian/i.test(s.evidenceNotes)).length;
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`creator-stories.json OK: ${data.stories.length} records (${nigerian} primary, ${data.stories.length - nigerian} non-Nigerian comparator).`);
