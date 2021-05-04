/* eslint-env node */
const { relative } = require('path');

const separator = '/';
const mainPackagePath = __dirname;
const invalidPackagePath = false;

const toPackagePath = (
  modulePath,
  main = mainPackagePath,
  invalid = invalidPackagePath
) => {
  const splitReverse = modulePath.split(separator).reverse();
  const nodeModulesIndex = splitReverse.findIndex((s) => s === 'node_modules');
  if (nodeModulesIndex < 0) {
    return main;
  }
  let packageIndex = nodeModulesIndex - 1;
  if (splitReverse[packageIndex].startsWith('@')) {
    packageIndex = nodeModulesIndex - 2;
  }
  if (nodeModulesIndex < 0) {
    return invalid;
  }
  return splitReverse.slice(packageIndex).reverse().join(separator);
};

const toDep = (modulePath) => {
  const relativeFilePath = relative('../..', modulePath);
  const packagePath = toPackagePath(modulePath);
  const relativePackagePath = relative('../..', packagePath);
  const package = require(`${packagePath}/package.json`);
  return {
    relativeFilePath,
    relativePackagePath,
    package: {
      name: package.name,
      version: package.version,
    },
  };
};

module.exports = {
  toDep,
};
