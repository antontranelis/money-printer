#!/usr/bin/env node
/**
 * Validate a template package for correctness.
 *
 * Checks:
 *  1. template.json exists and parses
 *  2. JSON Schema validation
 *  3. All referenced asset files exist
 *  4. Image dimensions: all layers match, minimum resolution
 *  5. Badge files: exist, square, have alpha channel
 *  6. Silver masks: exist (if enabled), same dimensions, B/W only
 *  7. Reference images present
 *
 * Usage:
 *   node scripts/validate-template.mjs <template-dir>
 *   node scripts/validate-template.mjs ../templates/01-spiritual-natur-blaetter
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, relative, basename } from 'path';
import sharp from 'sharp';

// ─── Helpers ───

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const errors = [];
const warnings = [];

function error(msg) { errors.push(msg); console.log(`  ${RED}✗${RESET} ${msg}`); }
function warn(msg) { warnings.push(msg); console.log(`  ${YELLOW}⚠${RESET} ${msg}`); }
function ok(msg) { console.log(`  ${GREEN}✓${RESET} ${msg}`); }
function info(msg) { console.log(`  ${DIM}${msg}${RESET}`); }

// ─── Main ───

const templateDir = process.argv[2];
if (!templateDir) {
  console.error('Usage: node scripts/validate-template.mjs <template-dir>');
  process.exit(1);
}

const absDir = resolve(templateDir);
if (!existsSync(absDir)) {
  console.error(`Directory not found: ${absDir}`);
  process.exit(1);
}

console.log(`\n${CYAN}=== Template Validation ===${RESET}`);
console.log(`${DIM}Directory: ${absDir}${RESET}\n`);

// ─── 1. Parse template.json ───

console.log(`${CYAN}1. Template Manifest${RESET}`);

const manifestPath = resolve(absDir, 'template.json');
if (!existsSync(manifestPath)) {
  error('template.json not found');
  printSummary();
  process.exit(1);
}

let template;
try {
  template = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  ok(`template.json parsed — "${template.name || '(unnamed)'}"`);
} catch (e) {
  error(`template.json parse error: ${e.message}`);
  printSummary();
  process.exit(1);
}

// ─── 2. Schema Validation ───

console.log(`\n${CYAN}2. Schema Validation${RESET}`);

const schemaPath = resolve(import.meta.dirname, '../../templates/template.schema.json');
if (existsSync(schemaPath)) {
  try {
    const Ajv = (await import('ajv/dist/2020.js')).default;
    const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(schema);
    if (validate(template)) {
      ok('JSON Schema validation passed');
    } else {
      for (const err of validate.errors) {
        error(`Schema: ${err.instancePath} ${err.message}`);
      }
    }
  } catch (e) {
    warn(`Schema validation skipped: ${e.message}`);
  }
} else {
  warn(`Schema file not found at ${schemaPath} — skipping schema validation`);
}

// Basic required fields check (works without schema)
const requiredFields = ['id', 'name', 'version', 'layout'];
for (const field of requiredFields) {
  if (!template[field]) error(`Missing required field: ${field}`);
}

if (template.layout?.dimensions) {
  const { width, height, dpi } = template.layout.dimensions;
  if (width) ok(`Dimensions: ${width}×${height} px @ ${dpi} DPI`);
  if (width && dpi) {
    const physicalWidthMm = (width / dpi) * 25.4;
    info(`Physical width: ${physicalWidthMm.toFixed(1)} mm`);
    if (width < 1622) warn(`Width ${width}px is below 300 DPI minimum (1622px for 137mm)`);
  }
} else {
  error('Missing layout.dimensions');
}

// ─── 3. Asset Files ───

console.log(`\n${CYAN}3. Asset Files${RESET}`);

// Resolve asset paths: absolute paths (starting with /) are relative to public/,
// relative paths are relative to the template directory.
const publicDir = resolve(import.meta.dirname, '../public');

function resolveAssetPath(filepath) {
  if (filepath.startsWith('/')) {
    return resolve(publicDir, filepath.slice(1));
  }
  return resolve(absDir, filepath);
}

function checkFile(filepath, label, required = true) {
  const abs = resolveAssetPath(filepath);
  if (existsSync(abs)) {
    ok(`${label}: ${filepath}`);
    return true;
  } else if (required) {
    error(`${label} missing: ${filepath}`);
    return false;
  } else {
    info(`${label} not provided: ${filepath} (optional)`);
    return false;
  }
}

// Reference images
checkFile('reference-front.png', 'Reference Front', false);
checkFile('reference-back.png', 'Reference Back', false);

// Collect all layer files referenced in layout
const layerFiles = new Set();

for (const side of ['front', 'back']) {
  const layers = template.layout?.[side]?.layers || [];
  for (const layer of layers) {
    if (layer.source && template.assets?.[layer.source]) {
      const asset = template.assets[layer.source];
      if (typeof asset === 'string') layerFiles.add(asset);
    }
  }
}

// Also check string assets directly
if (template.assets) {
  for (const [key, value] of Object.entries(template.assets)) {
    if (typeof value === 'string' && value.endsWith('.png') || typeof value === 'string' && value.endsWith('.webp')) {
      checkFile(value, `Asset "${key}"`);
      layerFiles.add(value);
    }
  }
}

// ─── 4. Image Dimensions ───

console.log(`\n${CYAN}4. Image Dimensions${RESET}`);

const dimensions = new Map();
const imageFiles = [];

// Collect all image files in the template directory
const allFiles = [];
try {
  const entries = readdirSync(absDir, { withFileTypes: true, recursive: true });
  for (const entry of entries) {
    if (entry.isFile() && /\.(png|webp|jpg|jpeg)$/i.test(entry.name)) {
      const rel = relative(absDir, resolve(entry.parentPath || entry.path, entry.name));
      allFiles.push(rel);
    }
  }
} catch (e) {
  warn(`Could not scan directory: ${e.message}`);
}

// Check dimensions of existing image files
for (const file of allFiles) {
  const abs = resolve(absDir, file);
  if (!existsSync(abs)) continue;

  try {
    const meta = await sharp(abs).metadata();
    dimensions.set(file, { width: meta.width, height: meta.height, channels: meta.channels, hasAlpha: meta.channels === 4 });
    imageFiles.push(file);
    info(`${file}: ${meta.width}×${meta.height} ${meta.channels}ch`);
  } catch (e) {
    warn(`Could not read metadata of ${file}: ${e.message}`);
  }
}

// Check that background layers have consistent dimensions
const bgFiles = imageFiles.filter(f =>
  f.includes('background') || f.includes('frame') || f.includes('area')
);

if (bgFiles.length > 1) {
  const firstDim = dimensions.get(bgFiles[0]);
  let allMatch = true;
  for (const f of bgFiles.slice(1)) {
    const d = dimensions.get(f);
    if (d && firstDim && (d.width !== firstDim.width || d.height !== firstDim.height)) {
      error(`Dimension mismatch: ${f} (${d.width}×${d.height}) vs ${bgFiles[0]} (${firstDim.width}×${firstDim.height})`);
      allMatch = false;
    }
  }
  if (allMatch) ok(`All layer files have consistent dimensions`);
}

// ─── 5. Badges ───

console.log(`\n${CYAN}5. Badges${RESET}`);

const badgeAssets = template.assets?.badges;
if (badgeAssets && badgeAssets.variants) {
  for (const variant of badgeAssets.variants) {
    const badgePath = variant.image;
    const abs = resolveAssetPath(badgePath);
    if (!existsSync(abs)) {
      error(`Badge missing: ${badgePath} (value=${variant.value})`);
      continue;
    }
    const meta = await sharp(abs).metadata();
    if (meta.width !== meta.height) {
      warn(`Badge ${badgePath} is not square: ${meta.width}×${meta.height}`);
    }
    if (meta.channels !== 4) {
      warn(`Badge ${badgePath} has no alpha channel (${meta.channels} channels)`);
    }
    ok(`Badge ${badgePath}: ${meta.width}×${meta.height} ${meta.channels}ch`);
  }
} else {
  // Check for badge layers in layout
  let hasBadgeLayers = false;
  for (const side of ['front', 'back']) {
    for (const layer of (template.layout?.[side]?.layers || [])) {
      if (layer.type === 'badges') hasBadgeLayers = true;
    }
  }
  if (hasBadgeLayers) {
    warn('Layout has badge layers but no badge assets defined in template.assets.badges');
  } else {
    info('No badges defined (optional)');
  }
}

// ─── 6. Silver Masks ───

console.log(`\n${CYAN}6. Silver Masks${RESET}`);

if (template.silver?.enabled) {
  for (const [key, file] of [['Front', template.silver.maskFront], ['Back', template.silver.maskBack]]) {
    if (!file) { error(`Silver enabled but ${key.toLowerCase()} mask path missing`); continue; }

    const abs = resolveAssetPath(file);
    if (!existsSync(abs)) {
      error(`Silver mask ${key} missing: ${file}`);
      continue;
    }

    const meta = await sharp(abs).metadata();
    ok(`Silver mask ${key}: ${file} (${meta.width}×${meta.height})`);

    // Check dimensions match layout
    const layoutW = template.layout?.dimensions?.width;
    const layoutH = template.layout?.dimensions?.height;
    if (layoutW && layoutH && (meta.width !== layoutW || meta.height !== layoutH)) {
      warn(`Silver mask ${key} dimensions (${meta.width}×${meta.height}) differ from layout (${layoutW}×${layoutH})`);
    }

    // Sample pixels to check if it's roughly B/W
    try {
      const { data, info: imgInfo } = await sharp(abs)
        .resize(100, 50, { fit: 'fill' })
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

      let grayPixels = 0;
      for (let i = 0; i < data.length; i++) {
        const v = data[i];
        if (v > 20 && v < 235) grayPixels++;
      }
      const grayRatio = grayPixels / data.length;
      if (grayRatio > 0.3) {
        warn(`Silver mask ${key} has ${(grayRatio * 100).toFixed(0)}% gray pixels — should be mostly black/white`);
      } else {
        ok(`Silver mask ${key}: ${(100 - grayRatio * 100).toFixed(0)}% B/W`);
      }
    } catch (e) {
      warn(`Could not analyze silver mask pixels: ${e.message}`);
    }
  }
} else {
  info('Silver not enabled (optional)');
}

// ─── 7. Schema Fields ↔ Layout Cross-check ───

console.log(`\n${CYAN}7. Field ↔ Layout Consistency${RESET}`);

const schemaFieldIds = new Set((template.schema?.fields || []).map(f => f.id));
const layoutFieldIds = new Set();

for (const side of ['front', 'back']) {
  for (const layer of (template.layout?.[side]?.layers || [])) {
    if (layer.fieldId) layoutFieldIds.add(layer.fieldId);
  }
}

for (const fieldId of layoutFieldIds) {
  if (schemaFieldIds.has(fieldId)) {
    ok(`Field "${fieldId}" defined in schema and used in layout`);
  } else {
    warn(`Field "${fieldId}" used in layout but not defined in schema`);
  }
}

for (const fieldId of schemaFieldIds) {
  if (!layoutFieldIds.has(fieldId)) {
    info(`Field "${fieldId}" defined in schema but not placed in layout (will be in form only)`);
  }
}

// ─── Summary ───

printSummary();

function printSummary() {
  console.log(`\n${CYAN}═══ Summary ═══${RESET}`);
  if (errors.length === 0 && warnings.length === 0) {
    console.log(`${GREEN}✓ Template is valid — no issues found${RESET}\n`);
  } else {
    if (errors.length > 0) console.log(`${RED}✗ ${errors.length} error(s)${RESET}`);
    if (warnings.length > 0) console.log(`${YELLOW}⚠ ${warnings.length} warning(s)${RESET}`);
    console.log('');
  }
  process.exit(errors.length > 0 ? 1 : 0);
}
