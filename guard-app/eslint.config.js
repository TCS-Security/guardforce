const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  { settings: { react: { version: "19.2" } }, rules: { "react-hooks/set-state-in-effect": "warn", "react-hooks/purity": "warn" }, ignores: ["android/*", "ios/*", "node_modules/*", ".expo/*"] },
]);
