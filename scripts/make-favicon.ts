/**
 * Crop the hexagon "1" mark out of the wide Jojan One lockup and emit a square
 * icon Next.js uses as the favicon (app/icon.png). Run once:
 *   ./node_modules/.bin/tsx scripts/make-favicon.ts
 */
import sharp from "sharp";

async function main() {
  const src = "public/assets/logo.jpg"; // 1920x819
  await sharp(src)
    .extract({ left: 70, top: 130, width: 560, height: 560 }) // the hexagon mark
    .resize(512, 512)
    .png()
    .toFile("app/icon.png");
  console.log("wrote app/icon.png (512x512)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
