import sharp from "sharp";
import { fileURLToPath } from "node:url";

// Sharp is supplied by Next.js. Commit the generated PNG so runtime rendering
// and external fonts are unnecessary for social crawlers.
const source = fileURLToPath(new URL("../public/og/arcus-share.svg", import.meta.url));
const logo = await sharp(fileURLToPath(new URL("../public/icons/icon-192.png", import.meta.url))).resize(46, 46).png().toBuffer();
await sharp(source).composite([{ input: logo, left: 68, top: 66 }]).png({ compressionLevel: 9 }).toFile(fileURLToPath(new URL("../public/og/arcus-share.png", import.meta.url)));
console.log("Generated public/og/arcus-share.png (1200 × 630).");
