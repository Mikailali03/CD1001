const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Ignore temporary pnpm package directories before the fallback watcher tries
// to watch them. These can disappear mid-install, causing an ENOENT crash.
config.resolver = config.resolver ?? {};
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
    ? [config.resolver.blockList]
    : []),
  /[/\\]node_modules[/\\][^/\\]+_tmp_[^/\\]+(?:[/\\]|$)/,
];

module.exports = config;
