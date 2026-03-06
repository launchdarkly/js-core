// We need to use a custom metro config for monorepo workspaces to work.
// https://docs.expo.dev/guides/monorepos/#modify-the-metro-config
/**
 * @type {import('expo/metro-config')}
 */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

// Find the project and workspace directories
const projectRoot = __dirname;
// This can be replaced with `find-yarn-workspace-root`
const workspaceRoot = path.resolve(projectRoot, '../../../../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [workspaceRoot];
// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// 3. Force Metro to resolve (sub)dependencies only from the `nodeModulesPaths`
config.resolver.disableHierarchicalLookup = true;
// 4. Enable package.json "exports" field resolution for subpath imports
config.resolver.unstable_enablePackageExports = true;
// 5. Handle TypeScript .js extension convention: when a .js import is not found,
//    try resolving the .ts equivalent (needed for workspace packages using ESM imports)
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    const tsName = moduleName.replace(/\.js$/, '.ts');
    const fromDir = path.dirname(context.originModulePath);
    const tsPath = path.resolve(fromDir, tsName);
    if (fs.existsSync(tsPath)) {
      return context.resolveRequest(context, tsName, platform);
    }
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
