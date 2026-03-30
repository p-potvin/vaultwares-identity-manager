#!/usr/bin/env node
/**
 * Generates simple PNG extension icons using HTML Canvas via Node.js.
 * Run with: node public/icons/create-icons.js
 */
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const sizes = [16, 48, 128];
const outDir = __dirname;

for (const size of sizes) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Background gradient: gold → cyan
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#cc9b21');
    grad.addColorStop(1, '#21b8cc');

    // Rounded rectangle
    const r = size * 0.2;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(size - r, 0);
    ctx.arcTo(size, 0, size, r, r);
    ctx.lineTo(size, size - r);
    ctx.arcTo(size, size, size - r, size, r);
    ctx.lineTo(r, size);
    ctx.arcTo(0, size, 0, size - r, r);
    ctx.lineTo(0, r);
    ctx.arcTo(0, 0, r, 0, r);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Shield "V" text
    ctx.fillStyle = '#1a1f23';
    ctx.font = `bold ${Math.round(size * 0.55)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('V', size / 2, size / 2 + size * 0.03);

    const buffer = canvas.toBuffer('image/png');
    const outPath = path.join(outDir, `icon${size}.png`);
    fs.writeFileSync(outPath, buffer);
    console.log(`Created ${outPath}`);
}
