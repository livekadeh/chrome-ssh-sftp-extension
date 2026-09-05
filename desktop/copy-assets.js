const fs = require('fs');
const path = require('path');

function copyRecursiveSync(src, dest, ignorePatterns = []) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      if (ignorePatterns.some((pattern) => childItemName.includes(pattern))) {
        return;
      }
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName),
        ignorePatterns
      );
    });
  } else if (exists) {
    const parent = path.dirname(dest);
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
}

console.log('[Build] Synchronizing extension UI and server bridge assets into desktop bundle...');

const rootDir = path.resolve(__dirname, '..');
const desktopDir = __dirname;

// 1. Copy extension folder
const srcExtension = path.join(rootDir, 'extension');
const destExtension = path.join(desktopDir, 'extension');
copyRecursiveSync(srcExtension, destExtension);
console.log('✓ Extension assets synchronized');

// 2. Copy server files
const srcServer = path.join(rootDir, 'server');
const destServer = path.join(desktopDir, 'server');
copyRecursiveSync(srcServer, destServer, ['bin', 'node_modules', '.zip', '.tar.gz']);
console.log('✓ Server bridge synchronized');

console.log('[Build] Asset synchronization completed successfully.');
