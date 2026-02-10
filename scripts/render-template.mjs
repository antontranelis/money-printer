#!/usr/bin/env node
/**
 * Server-side template renderer using Sharp.
 *
 * Composites template layers + renders text fields + places badges
 * to produce a preview PNG. This is a simplified version of the
 * browser-based genericRenderer.ts — it validates that the template
 * assets work together and produces a visual output for comparison.
 *
 * Usage:
 *   node scripts/render-template.mjs <template-dir> [--output <path>]
 *   node scripts/render-template.mjs public/templates/spiritual-natur-blaetter
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import sharp from 'sharp';

// ─── Config ───

const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

// ─── Parse Args ───

const args = process.argv.slice(2);
const templateDir = args[0];
const outputIdx = args.indexOf('--output');
const outputPath = outputIdx >= 0 ? args[outputIdx + 1] : null;

if (!templateDir) {
  console.error('Usage: node scripts/render-template.mjs <template-dir> [--output <dir>]');
  process.exit(1);
}

const absDir = resolve(templateDir);
const publicDir = resolve(import.meta.dirname, '../public');

function resolveAssetPath(filepath) {
  if (filepath.startsWith('/')) return resolve(publicDir, filepath.slice(1));
  return resolve(absDir, filepath);
}

// ─── Load Template ───

const template = JSON.parse(readFileSync(resolve(absDir, 'template.json'), 'utf-8'));
const { width, height } = template.layout.dimensions;
const outDir = outputPath || resolve(absDir, '_rendered');

console.log(`\n${CYAN}=== Template Renderer ===${RESET}`);
console.log(`${DIM}Template: ${template.name} (${width}×${height})${RESET}\n`);

// ─── Example Data ───

const exampleData = {
  name: 'Max Mustermann',
  hours: 1,
  email: 'max@beispiel.de',
  phone: '+49 123 456789',
  description: 'Für diesen Gutschein erhältst du 1 Stunde meiner Zeit oder ein vergleichbares Dankeschön.',
  website: 'www.beispiel.de',
};

// ─── Render a Side ───

async function renderSide(side) {
  console.log(`${CYAN}Rendering ${side}...${RESET}`);
  const layers = template.layout[side]?.layers || [];

  // Start with a transparent canvas
  let canvas = sharp({
    create: { width, height: side === 'back' ? height + 1 : height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).png().toBuffer();

  canvas = await canvas;
  const composites = [];

  for (const layer of layers) {
    switch (layer.type) {
      case 'background': {
        // Load background image
        const source = layer.source;
        const assetPath = template.assets[source];
        if (!assetPath || typeof assetPath !== 'string') {
          console.log(`  ${DIM}Skip background: no asset for "${source}"${RESET}`);
          break;
        }
        const imgPath = resolveAssetPath(assetPath);
        if (!existsSync(imgPath)) {
          console.log(`  ${DIM}Skip background: file not found: ${imgPath}${RESET}`);
          break;
        }
        const bg = await sharp(imgPath)
          .resize(width, side === 'back' ? height + 1 : height, { fit: 'fill' })
          .png()
          .toBuffer();
        composites.push({ input: bg, left: 0, top: 0 });
        console.log(`  ${GREEN}✓${RESET} Background: ${assetPath}`);
        break;
      }

      case 'frame': {
        const source = layer.source;
        const assetPath = template.assets[source];
        if (!assetPath || typeof assetPath !== 'string') break;
        const imgPath = resolveAssetPath(assetPath);
        if (!existsSync(imgPath)) break;
        const frame = await sharp(imgPath)
          .resize(width, side === 'back' ? height + 1 : height, { fit: 'fill' })
          .png()
          .toBuffer();
        composites.push({ input: frame, left: 0, top: 0 });
        console.log(`  ${GREEN}✓${RESET} Frame: ${assetPath}`);
        break;
      }

      case 'badges': {
        const fieldId = layer.fieldId;
        const selectedValue = exampleData[fieldId] || 1;
        const badgeConfig = template.assets.badges;
        if (!badgeConfig?.variants) break;

        const variant = badgeConfig.variants.find(v => v.value === selectedValue);
        if (!variant) break;

        const badgePath = resolveAssetPath(variant.image);
        if (!existsSync(badgePath)) {
          console.log(`  ${DIM}Skip badges: file not found: ${variant.image}${RESET}`);
          break;
        }

        const positions = layer.positions || [];
        for (const pos of positions) {
          const size = pos.size || variant.size || 80;
          const badge = await sharp(badgePath)
            .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toBuffer();
          const left = Math.round(pos.x - size / 2);
          const top = Math.round(pos.y - size / 2);
          composites.push({ input: badge, left, top });
        }
        console.log(`  ${GREEN}✓${RESET} Badges: ${positions.length} positions (value=${selectedValue})`);
        break;
      }

      case 'field': {
        const fieldId = layer.fieldId;
        const value = exampleData[fieldId];
        if (!value) break;

        const field = template.schema.fields.find(f => f.id === fieldId);
        if (!field) break;

        if (field.type === 'image') {
          // Skip image fields in this simplified renderer
          console.log(`  ${DIM}Skip image field "${fieldId}" (no image compositing in CLI)${RESET}`);
          break;
        }

        // For text fields: create a text overlay using SVG
        const style = layer.style || {};
        const fontSize = style.fontSize || 24;
        const fontFamily = (style.fontFamily || 'serif').split(',')[0].trim();
        const fontWeight = style.fontWeight || 'normal';
        const color = style.color || '#FFFFFF';
        const align = layer.align || 'center';
        const maxWidth = layer.maxWidth || width;
        const pos = layer.position || { x: 0, y: 0 };

        // Create SVG text overlay
        const text = String(value);
        const svgText = text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

        let textAnchor = 'middle';
        let svgX = maxWidth / 2;
        if (align === 'left') { textAnchor = 'start'; svgX = 0; }
        if (align === 'right') { textAnchor = 'end'; svgX = maxWidth; }

        const svgHeight = layer.multiline ? fontSize * 6 : fontSize * 2;
        const svg = Buffer.from(`<svg width="${maxWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
          <text x="${svgX}" y="${fontSize}"
            font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}"
            fill="${color}" text-anchor="${textAnchor}" dominant-baseline="hanging">
            ${svgText}
          </text>
        </svg>`);

        const textBuf = await sharp(svg).png().toBuffer();

        const left = Math.round(pos.x - (align === 'center' ? maxWidth / 2 : align === 'right' ? maxWidth : 0));
        const top = Math.round(pos.y - fontSize / 2);

        composites.push({ input: textBuf, left: Math.max(0, left), top: Math.max(0, top) });
        console.log(`  ${GREEN}✓${RESET} Text "${fieldId}": "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`);
        break;
      }

      case 'text': {
        // Static text (like "Unterschrift")
        const content = layer.content;
        if (!content) break;
        const text = typeof content === 'object' ? (content.de || Object.values(content)[0]) : String(content);
        if (text.includes('{{')) break; // Skip template expressions

        const style = layer.style || {};
        const fontSize = style.fontSize || 16;
        const color = style.color || '#FFFFFF';
        const pos = layer.position || { x: 0, y: 0 };
        const maxWidth = 400;

        const svgText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const svg = Buffer.from(`<svg width="${maxWidth}" height="${fontSize * 2}" xmlns="http://www.w3.org/2000/svg">
          <text x="${maxWidth / 2}" y="${fontSize}"
            font-family="serif" font-size="${fontSize}"
            fill="${color}" text-anchor="middle" dominant-baseline="hanging"
            font-style="${style.fontStyle || 'normal'}">
            ${svgText}
          </text>
        </svg>`);

        const textBuf = await sharp(svg).png().toBuffer();
        composites.push({
          input: textBuf,
          left: Math.max(0, Math.round(pos.x - maxWidth / 2)),
          top: Math.max(0, Math.round(pos.y - fontSize / 2)),
        });
        console.log(`  ${GREEN}✓${RESET} Static text: "${text}"`);
        break;
      }

      default:
        console.log(`  ${DIM}Skip unknown layer type: ${layer.type}${RESET}`);
    }
  }

  // Composite all layers
  if (composites.length === 0) {
    console.log(`  No layers to composite`);
    return null;
  }

  const result = await sharp(canvas)
    .composite(composites)
    .png()
    .toBuffer();

  console.log(`  ${GREEN}✓ Composited ${composites.length} layers${RESET}`);
  return result;
}

// ─── Main ───

async function main() {
  // Ensure output directory
  const { mkdirSync } = await import('fs');
  mkdirSync(outDir, { recursive: true });

  for (const side of ['front', 'back']) {
    const result = await renderSide(side);
    if (result) {
      const outFile = resolve(outDir, `${side}.png`);
      writeFileSync(outFile, result);
      const meta = await sharp(result).metadata();
      console.log(`  → Saved: ${outFile} (${meta.width}×${meta.height})\n`);
    }
  }

  console.log(`${GREEN}Done!${RESET} Output in: ${outDir}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
