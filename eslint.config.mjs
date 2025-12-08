// @ts-check
import pluginQuery from "@tanstack/eslint-plugin-query";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import { importX } from "eslint-plugin-import-x";
import pluginPromise from "eslint-plugin-promise";
import reactHooks from "eslint-plugin-react-hooks";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";
import { configs as tseslintConfigs } from "typescript-eslint";

const eslintConfig = defineConfig([
  // Next.js recommended configs (includes React, React Hooks, and Next.js rules)
  ...nextVitals,
  ...nextTs,

  // TypeScript type-checked rules
  ...tseslintConfigs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.config.{js,cjs,mjs,ts}"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Import plugin configuration
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  {
    settings: {
      "import-x/resolver-next": [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
          project: "tsconfig.json",
        }),
      ],
    },
  },

  // Promise plugin
  // NOTE: eslint-plugin-promise is not properly typed
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  pluginPromise.configs["flat/recommended"],

  // TanStack Query plugin
  ...pluginQuery.configs["flat/recommended"],

  // Simple import sort
  {
    plugins: {
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      "simple-import-sort/imports": "warn",
      "simple-import-sort/exports": "warn",
    },
  },

  // Unused imports configuration
  {
    plugins: {
      "unused-imports": unusedImports,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
    },
  },

  // React-specific rules
  {
    files: ["**/*.{jsx,tsx}"],
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      "react/self-closing-comp": ["error", { component: true, html: true }],
      "react/prop-types": "off",
      "react/hook-use-state": "error",
      "react/button-has-type": "error",
      "react/jsx-handler-names": "error",
      "react/jsx-fragments": "error",
      "react/jsx-pascal-case": "error",
      "react/no-unstable-nested-components": ["error", { allowAsProps: false }],
      "react/jsx-curly-brace-presence": [
        "error",
        { props: "never", children: "ignore" },
      ],
      "react/function-component-definition": [
        "warn",
        {
          namedComponents: "arrow-function",
          unnamedComponents: "arrow-function",
        },
      ],
      "react/jsx-sort-props": [
        "warn",
        { callbacksLast: true, shorthandFirst: true, reservedFirst: true },
      ],
      "react/jsx-no-useless-fragment": "warn",
    },
  },

  // React Hooks configuration
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  // Prettier – disables conflicting stylistic rules
  prettier,

  // Custom rules AFTER Prettier
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    rules: {
      curly: ["warn", "all"],
      eqeqeq: "error",
      "object-shorthand": "warn",
      "padding-line-between-statements": [
        "warn",
        {
          blankLine: "always",
          prev: "*",
          next: "return",
        },
      ],
      "import-x/extensions": ["error", "never", { json: "always" }],
    },
  },

  // TS-only rules that need type info
  {
    files: ["**/*.{ts,mts,cts,tsx}"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "warn",
      "no-shadow": "off",
      "@typescript-eslint/no-shadow": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "no-return-await": "off",
      "@typescript-eslint/return-await": [
        "error",
        "error-handling-correctness-only",
      ],
    },
  },

  // Config files
  {
    files: ["**/*.config.{js,mjs,cjs,ts,mts,cts}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "import-x/no-default-export": "off",
    },
  },

  // Override default ignores of eslint-config-next
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    "coverage/**",
    "dist/**",
  ]),
]);

export default eslintConfig;
