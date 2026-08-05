const { withPodfile } = require('@expo/config-plugins');

/**
 * Config plugin that injects explicit modular-header declarations for pods that
 * AppCheckCore requires but that the global `use_modular_headers!` flag alone
 * does not cover reliably on all CocoaPods versions.
 *
 * What this adds to the generated Podfile (inside the main app target block):
 *   pod 'GoogleUtilities', :modular_headers => true
 *   pod 'RecaptchaInterop', :modular_headers => true
 *
 * `use_modular_headers!` is already injected globally by expo-build-properties
 * (ios.modularHeaders: true). This plugin handles the pods that still need an
 * explicit override even when the global flag is set.
 */
const withModularHeaders = (config) => {
  return withPodfile(config, (config) => {
    let contents = config.modResults.contents;

    const podLines = [
      "  pod 'GoogleUtilities', :modular_headers => true",
      "  pod 'RecaptchaInterop', :modular_headers => true",
    ];

    for (const line of podLines) {
      if (contents.includes(line.trim())) continue; // already present

      // Inject right after `use_expo_modules!` inside the target block, which
      // is the canonical injection point in Expo-generated Podfiles.
      const anchor = /(\n[ \t]+use_expo_modules![ \t]*\n)/;
      if (anchor.test(contents)) {
        contents = contents.replace(anchor, `$1${line}\n`);
      } else {
        // Fallback: inject before the first `end` that closes a target block.
        contents = contents.replace(/(\n[ \t]*end[ \t]*\n)/, `\n${line}$1`);
      }
    }

    config.modResults.contents = contents;
    return config;
  });
};

module.exports = withModularHeaders;
