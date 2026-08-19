const { defineConfig } = require("eslint/config");
const globals = require("globals");
const expoConfig = require("eslint-config-expo/flat");
const eslintConfigPrettier = require("eslint-config-prettier");

module.exports = defineConfig([
  expoConfig,
  eslintConfigPrettier,
  {
    // El archivo de guía contiene ejemplos de código embebidos como documentación, no código de la app.
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      ".expo/**",
      "android/**",
      "ios/**",
      "src/hooks/APNEA_DETECTION_GUIDE.js",
    ],
  },
  {
    files: [
      "__tests__/**",
      "**/*.test.js",
      "**/*.test.ts",
      "**/*.spec.js",
      "**/*.spec.ts",
    ],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
]);
