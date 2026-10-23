// Builds the single-file app from src/ into:
//   server/public/index.html   the page the Docker image serves (fonts bundled, no outside requests)
//   dist/kisscut.html          the same page for hosts that add their own <html> wrapper (uses Google Fonts)
const fs = require('fs');
const path = require('path');
const root = __dirname;
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const shell = read('src/shell.html'), engine = read('src/engine.js'), app = read('src/app.js');
if (engine.includes('</script') || app.includes('</script')) throw new Error('A </script> sequence inside the source would break the page.');
const page = shell.replace('/*ENGINE*/', () => engine).replace('/*APP*/', () => app).replace('<style>\n', '<style>\n[hidden] { display: none !important; }\n');

const FONT_LINKS = /<link rel="preconnect" href="https:\/\/fonts.googleapis.com">\n<link rel="preconnect" href="https:\/\/fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https:\/\/fonts.googleapis.com[^>]+>/;
if (!FONT_LINKS.test(page)) throw new Error('Google Fonts links not found in src/shell.html');
const localFonts = `<style>
@font-face { font-family: "Archivo"; font-style: normal; font-display: swap; font-weight: 100 900; font-stretch: 62% 125%; src: url(/fonts/archivo-latin.woff2) format("woff2-variations"), url(/fonts/archivo-latin.woff2) format("woff2"); unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD; }
@font-face { font-family: "Archivo"; font-style: normal; font-display: swap; font-weight: 100 900; font-stretch: 62% 125%; src: url(/fonts/archivo-latin-ext.woff2) format("woff2-variations"), url(/fonts/archivo-latin-ext.woff2) format("woff2"); unicode-range: U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF; }
@font-face { font-family: "IBM Plex Mono"; font-style: normal; font-display: swap; font-weight: 400; src: url(/fonts/ibm-plex-mono-400.woff2) format("woff2"); }
@font-face { font-family: "IBM Plex Mono"; font-style: normal; font-display: swap; font-weight: 500; src: url(/fonts/ibm-plex-mono-500.woff2) format("woff2"); }
</style>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">`;
const served = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="light dark"></head><body>\n'
  + page.replace(FONT_LINKS, () => localFonts) + '\n</body></html>\n';
fs.mkdirSync(path.join(root, 'server/public'), { recursive: true });
fs.writeFileSync(path.join(root, 'server/public/index.html'), served);
if (!process.argv.includes('--server-only')) {
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist/kisscut.html'), page);
}
console.log('Built server/public/index.html (' + Math.round(served.length / 1024) + ' KB)');
