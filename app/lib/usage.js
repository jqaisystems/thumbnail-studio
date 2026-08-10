// Token/image usage log. API generations record REAL token counts from the
// OpenAI response; ChatGPT-web generations record honest ESTIMATES (the web
// UI exposes no token meter). Estimate rule: ~4 characters per token.

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'data', 'usage.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return { events: [] };
  }
}

function estTokens(text) {
  return Math.round(String(text || '').length / 4);
}

// event: {kind, model, images?, tokensIn?, tokensOut?, estTokens?, cost?, note?}
function record(event) {
  const data = load();
  data.events.push({ ts: new Date().toISOString(), ...event });
  // keep the log bounded
  if (data.events.length > 5000) data.events = data.events.slice(-4000);
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function summary() {
  const byMonth = {};
  for (const e of load().events) {
    const month = String(e.ts).slice(0, 7);
    const m = (byMonth[month] ||= {});
    const key = e.model || e.kind;
    const row = (m[key] ||= { model: key, images: 0, tokensReal: 0, tokensEst: 0, cost: 0, events: 0 });
    row.events++;
    row.images += e.images || 0;
    row.tokensReal += (e.tokensIn || 0) + (e.tokensOut || 0);
    row.tokensEst += e.estTokens || 0;
    row.cost += e.cost || 0;
  }
  return byMonth;
}

module.exports = { record, summary, estTokens };
