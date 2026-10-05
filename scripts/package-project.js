const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function createZip() {
  const rootDir = path.resolve(__dirname, '..');
  const zipName = 'Falcon_PBL_Project_Hub_V4.1.1_GMIT_Local.zip';
  const outPath = path.join(rootDir, zipName);

  console.log('Packaging project to:', outPath);

  // In Windows PowerShell, Compress-Archive can bundle selected directories and files
  const items = [
    'app',
    'components',
    'db',
    'docs',
    'lib',
    'public',
    'scripts',
    'seed-data',
    'source-data',
    'types',
    '.env.example',
    '.gitignore',
    'Dockerfile',
    'README.md',
    'VERSION',
    'docker-compose.yml',
    'eslint.config.mjs',
    'next-env.d.ts',
    'next.config.ts',
    'package.json',
    'package-lock.json',
    'render.yaml',
    'tsconfig.json',
    'vercel.json'
  ].filter(f => fs.existsSync(path.join(rootDir, f)));

  const itemsList = items.map(i => `"${path.join(rootDir, i)}"`).join(', ');
  const psCmd = `Compress-Archive -Path ${itemsList} -DestinationPath "${outPath}" -Force`;

  try {
    execSync(`powershell.exe -NoProfile -Command "${psCmd}"`, { stdio: 'inherit' });
    const stat = fs.statSync(outPath);
    console.log(`Successfully created ZIP archive: ${outPath} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
  } catch (err) {
    console.error('Failed to create ZIP using PowerShell:', err.message);
  }
}

if (require.main === module) {
  createZip();
}

module.exports = { createZip };
