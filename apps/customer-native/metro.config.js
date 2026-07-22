// Monorepo-aware Metro config: this app pulls @chaselaundry/shared-native from
// ../../packages/shared-native (an npm workspace symlink), so Metro needs to watch the
// repo root and resolve node_modules from both this app and the workspace root.
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
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
