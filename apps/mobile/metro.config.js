const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

// Expo Go's default entry is the hoisted `expo/AppEntry.js`, which does
// `import App from '../../App'`. With pnpm hoisting, that expo package lives at
// the repo root, so `../../App` resolves above the workspace and fails with
// "Unable to resolve module ../../App". Redirect just that one import to this
// app's real App so Expo Go works no matter which entry it requests (manifest
// entry `index.ts` or the cached default AppEntry).
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === '../../App' &&
    typeof context.originModulePath === 'string' &&
    context.originModulePath.includes(`${path.sep}expo${path.sep}AppEntry`)
  ) {
    return context.resolveRequest(context, path.resolve(projectRoot, 'App'), platform);
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
