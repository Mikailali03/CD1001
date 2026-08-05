const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Exclude maath's ephemeral tmp directories from Metro's file watcher.
// The maath package creates and deletes maath_tmp_* directories during
// install/postinstall; if Metro tries to watch one that was already removed
// it throws ENOENT and crashes the bundler.
config.watchFolders = (config.watchFolders ?? []);
config.resolver = config.resolver ?? {};
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
    ? [config.resolver.blockList]
    : []),
  /maath_tmp_[^/]+\//,
];

module.exports = config;
