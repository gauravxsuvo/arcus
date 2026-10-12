const fs = require('fs');

function hexToRgb(hex) {
    if (hex.length === 4) {
        hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function desaturate(hex) {
    // Some specific overrides for the accent colors
    if (hex.toLowerCase() === '#c4ed76') return '#ffffff';
    if (hex.toLowerCase() === '#d4f59a') return '#e5e5e5';
    if (hex.toLowerCase() === '#e0ffc0') return '#f5f5f5';

    let [r, g, b] = hexToRgb(hex);
    // Calculate luminance/grayscale
    let gray = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
    
    // For a minimal dark theme (slate/zinc), we can just use the gray value.
    // We'll keep it pure grayscale (zinc) for ultimate minimalism.
    return rgbToHex(gray, gray, gray);
}

let css = fs.readFileSync('src/app/globals.css', 'utf-8');

// Replace standard hex codes
css = css.replace(/#[0-9a-fA-F]{6}\b/g, match => desaturate(match));
// Replace 3-digit hex codes
css = css.replace(/#[0-9a-fA-F]{3}\b/g, match => desaturate(match));

fs.writeFileSync('src/app/globals.css', css);
console.log('CSS desaturated successfully.');
