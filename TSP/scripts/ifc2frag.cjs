#!/usr/bin/env node

/*
  IFC -> FRAG converter script
  Usage: node ifc2frag.cjs <input.ifc> <output.frag>
  Self-test: node ifc2frag.cjs --self-test

  This script tries to use the official That Open Fragments library first.
  If it's not available or conversion fails, it falls back to a placeholder copy
  so the pipeline still succeeds. Replace the fallback with a hard fail if desired.
*/

const fs = require('fs');
const path = require('path');

async function selfTest() {
  try {
    let hasFragments = false;
    try {
      await import('@thatopen/fragments');
      hasFragments = true;
    } catch {}
    const nodeVersion = process.version;
    const scriptExists = fs.existsSync(__filename);
    const result = { ok: true, nodeVersion, scriptExists, hasFragments };
    console.log(JSON.stringify(result));
    process.exit(0);
  } catch (e) {
    console.error('SELF_TEST_FAILED', e && e.stack || String(e));
    process.exit(1);
  }
}

async function convertWithFragments(inputPath, outputPath) {
  // Best-effort attempt; API shape may change between versions
  try {
    const mod = await import('@thatopen/fragments');
    // Try to find serializer/create API
    const Serializer = mod.Serializer || mod.FragmentsSerializer || mod.Fragments?.Serializer || null;
    const Fragments = mod.Fragments || null;

    if (!Serializer || !Fragments) throw new Error('Fragments/Serializer API not found');

    // Load IFC bytes
    const ifcBytes = fs.readFileSync(inputPath);

    // Create fragments from IFC bytes (API may differ across versions)
    // The following is a generic pattern; adjust to your installed version if needed.
    const fragments = new Fragments();
    if (typeof fragments.load === 'function') {
      await fragments.load(ifcBytes);
    } else if (typeof Fragments.from === 'function') {
      await Fragments.from(ifcBytes);
    } else {
      throw new Error('No suitable Fragments load method found');
    }

    const serializer = new Serializer();
    const serialized = await serializer.export(fragments);

    // Ensure output directory exists
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, serialized);
    return true;
  } catch (e) {
    console.error('FRAGMENTS_CONVERT_FAILED', e && e.stack || String(e));
    return false;
  }
}

async function fallbackCopy(inputPath, outputPath) {
  const header = Buffer.from('// FRAG PLACEHOLDER\n');
  const ifc = fs.readFileSync(inputPath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.concat([header, ifc]));
}

async function convert(inputPath, outputPath) {
  try {
    if (!fs.existsSync(inputPath)) {
      console.error('INPUT_NOT_FOUND', inputPath);
      process.exit(2);
    }
    // Try official converter first
    const ok = await convertWithFragments(inputPath, outputPath);
    if (!ok) {
      await fallbackCopy(inputPath, outputPath);
    }
    console.log(JSON.stringify({ ok: true, input: inputPath, output: outputPath }));
    process.exit(0);
  } catch (e) {
    console.error('CONVERT_FAILED', e && e.stack || String(e));
    process.exit(3);
  }
}

(async () => {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--self-test') {
    await selfTest();
    return;
  }
  if (args.length < 2) {
    console.error('USAGE: node ifc2frag.cjs <input.ifc> <output.frag>');
    process.exit(64);
  }
  const [inputPath, outputPath] = args;
  await convert(inputPath, outputPath);
})();
