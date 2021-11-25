const glob = require('glob-promise');
const fs = require('fs');
const path = require('path');
const os = require('os');

// file system constants
const repoRoot = __dirname;
const headerFile = path.join(
  'packages',
  'explorer-for-endevor',
  'copyright-header.js'
);
// glob patterns
const sourceCodeFiles = '**/*(*.js|*.ts)';
const codeDumpLocation = 'packages/';
const globSearchLocation = `${codeDumpLocation}${sourceCodeFiles}`;
// os specifics
const lineSeparator = os.EOL;
const ENCODING = 'utf-8';

const insertCopyrightHeaders = async () => {
  const sourceCodeFiles = await glob.promise(globSearchLocation, { dot: true });
  const copyrightHeader = (
    await fs.promises.readFile(path.join(repoRoot, headerFile))
  ).toString(ENCODING);
  sourceCodeFiles
    .map((relativePath) => path.join(repoRoot, relativePath))
    .forEach(async (sourceCodeFile) => {
      const initialContent = (
        await fs.promises.readFile(sourceCodeFile)
      ).toString(ENCODING);
      if (!initialContent.startsWith(copyrightHeader)) {
        const resultContent = `${copyrightHeader}${lineSeparator}${initialContent}`;
        await fs.promises.writeFile(sourceCodeFile, resultContent, ENCODING);
      }
    });
};

(async () => {
  await insertCopyrightHeaders();
})().catch((error) => {
  console.log(error.message);
});
