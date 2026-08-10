// Background-removal worker. Runs in its own process because onnxruntime-node
// and sharp (both native modules) crash when loaded into the same process.
// Usage: node lib/removebg-worker.js <srcPath> <outPath>
const fs = require('fs');

const [src, out] = process.argv.slice(2);

(async () => {
  const { removeBackground } = await import('@imgly/background-removal-node');
  const mime = /\.png$/i.test(src) ? 'image/png' : /\.webp$/i.test(src) ? 'image/webp' : 'image/jpeg';
  const blob = await removeBackground(new Blob([fs.readFileSync(src)], { type: mime }));
  fs.writeFileSync(out, Buffer.from(await blob.arrayBuffer()));
  console.log('ok');
})().catch((err) => {
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
});
