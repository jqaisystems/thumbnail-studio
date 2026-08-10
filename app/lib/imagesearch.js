// Keyless image search (DuckDuckGo vqd flow) + safe download for reference
// photos. No API keys; results are re-encoded through sharp so saved files are
// clean JPGs with metadata stripped.

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

async function ddgImageSearch(query) {
  const q = encodeURIComponent(query);
  const htmlRes = await fetch(`https://duckduckgo.com/?q=${q}&iax=images&ia=images`, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(15000),
  });
  const html = await htmlRes.text();
  const vqd = (html.match(/vqd=([\d-]+)/) || [])[1];
  if (!vqd) throw new Error('image search token not found');
  const jsRes = await fetch(`https://duckduckgo.com/i.js?l=us-en&o=json&q=${q}&vqd=${vqd}`, {
    headers: { 'User-Agent': UA, Referer: 'https://duckduckgo.com/' },
    signal: AbortSignal.timeout(15000),
  });
  const data = await jsRes.json();
  return (data.results || []).map((r) => ({ url: r.image, width: r.width, height: r.height }));
}

async function downloadImageAsJpg(url, dest, sharp) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`http ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 10_000 || buf.length > 15_000_000) throw new Error('bad file size');
  const img = sharp(buf);
  const meta = await img.metadata();
  if (!meta.width || meta.width < 400) throw new Error('too small');
  await img.rotate().jpeg({ quality: 92 }).toFile(dest);
}

module.exports = { ddgImageSearch, downloadImageAsJpg };
