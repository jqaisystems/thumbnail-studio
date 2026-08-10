// Optional generation providers. The default flow stays browser-based (zero
// APIs); these only run when the user configures them in Settings.

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// OpenAI Images API (gpt-image-1) with the reference photos as input images.
async function generateWithOpenAI({ prompt, refPaths, outPath, apiKey }) {
  if (!apiKey) throw new Error('no OpenAI API key in Settings');
  const fd = new FormData();
  fd.append('model', 'gpt-image-1');
  fd.append('prompt', prompt);
  fd.append('size', '1536x1024');
  for (const rp of refPaths) {
    const mime = /\.png$/i.test(rp) ? 'image/png' : 'image/jpeg';
    fd.append('image[]', new Blob([fs.readFileSync(rp)], { type: mime }), path.basename(rp));
  }
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
    signal: AbortSignal.timeout(5 * 60 * 1000),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error?.message || `openai http ${res.status}`);
  fs.writeFileSync(outPath, Buffer.from(j.data[0].b64_json, 'base64'));
  return j.usage || null; // {input_tokens, output_tokens, total_tokens} for gpt-image-1
}

// Custom command template: wire hermes, local Stable Diffusion, any CLI.
// Placeholders: {prompt} = path to a text file with the full prompt,
// {refs} = reference image paths joined with ";", {out} = target PNG path.
async function generateWithCustom({ prompt, refPaths, outPath, template }) {
  if (!template) throw new Error('no custom command in Settings');
  const promptFile = `${outPath}.prompt.txt`;
  fs.writeFileSync(promptFile, prompt);
  const cmd = template
    .replaceAll('{prompt}', `"${promptFile}"`)
    .replaceAll('{refs}', `"${refPaths.join(';')}"`)
    .replaceAll('{out}', `"${outPath}"`);
  try {
    await new Promise((resolve, reject) => {
      exec(cmd, { timeout: 10 * 60 * 1000 }, (err, stdout, stderr) =>
        err ? reject(new Error(stderr || err.message)) : resolve()
      );
    });
    if (!fs.existsSync(outPath)) throw new Error('command finished but did not create the output file');
  } finally {
    fs.rmSync(promptFile, { force: true });
  }
}

module.exports = { generateWithOpenAI, generateWithCustom };
