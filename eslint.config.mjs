// @ts-check
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import { importX } from "eslint-plugin-import-x";
import pluginPromise from "eslint-plugin-promise";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";
import { configs as tseslintConfigs } from "typescript-eslint";

const FEATURES = {
  react: true,
  next: true,
  typeAwareTs: true,
  importX: true,
  asyncHeavy: true,
  tanstackQuery: true,
  dedupeUnusedWithPlugin: true,
};

const has = (flag) => FEATURES[flag] === true;
const ALL_SRC = ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"];
const TS_SRC = ["**/*.{ts,mts,cts,tsx}"];
const REACT_SRC = ["**/*.{jsx,tsx}"];
const GENERATED_SRC = ["**/generated/**", "**/*.gen.*", "**/__generated__/**"];
const TOOLING_SRC = [
  "**/*.config.{js,mjs,cjs,ts,mts,cts}",
  "scripts/**/*.{js,mjs,cjs,ts,mts,cts}",
  "tools/**/*.{js,mjs,cjs,ts,mts,cts}",
];

const conditionContracts = [];
const VALID_CONDITION_CATEGORIES = new Set([
  "runtime",
  "zone",
  "tooling",
  "maturity",
  "risk",
]);

const assert = (ok, message) => {
  if (!ok) {
    throw new Error(`[eslint-policy] ${message}`);
  }
};

const isOffRule = (ruleValue) =>
  ruleValue === "off" || (Array.isArray(ruleValue) && ruleValue[0] === "off");

const withCondition = ({
  category,
  targets,
  owner,
  reason,
  revalidate,
  migration = false,
  inheritOffReason = false,
  blockId,
  rules,
  offReasons = {},
  ...config
}) => {
  assert(
    VALID_CONDITION_CATEGORIES.has(category),
    `${blockId}: invalid category`,
  );
  assert(
    Array.isArray(targets) && targets.length > 0,
    `${blockId}: missing targets`,
  );
  assert(
    typeof owner === "string" && owner.length > 0,
    `${blockId}: missing owner`,
  );
  assert(
    typeof reason === "string" && reason.length > 0,
    `${blockId}: missing reason`,
  );
  assert(
    typeof revalidate === "string" && revalidate.length > 0,
    `${blockId}: missing revalidation date/issue link`,
  );

  for (const [ruleName, ruleValue] of Object.entries(rules ?? {})) {
    if (isOffRule(ruleValue)) {
      const hasExplicitReason =
        typeof offReasons[ruleName] === "string" &&
        offReasons[ruleName].length > 0;
      const hasInheritedReason =
        inheritOffReason && typeof reason === "string" && reason.length > 0;
      assert(
        hasExplicitReason || hasInheritedReason,
        `${blockId}: rule '${ruleName}' is off without reason`,
      );
    }
  }

  if (migration) {
    assert(
      /#|\d{4}-\d{2}-\d{2}/.test(revalidate),
      `${blockId}: migration exception needs date or issue link`,
    );
  }

  conditionContracts.push({
    blockId,
    category,
    targets,
    owner,
    reason,
    revalidate,
    migration,
  });

  return {
    ...config,
    files: targets,
    ...(rules ? { rules } : {}),
  };
};

const NON_RECOMMENDED_PRESETS = [
  {
    preset: "typescript-eslint/recommendedTypeChecked",
    effect: "Enables TS type-aware correctness rules",
    useWhen: "Type info is wired via projectService",
    doNotUseWhen: "Repo cannot provide stable TS program graph",
  },
  {
    preset: "eslint-plugin-import-x/flatConfigs.typescript",
    effect: "TS-aware import resolution/rules",
    useWhen: "TypeScript + import-x enabled",
    doNotUseWhen: "Non-TS repos",
  },
  {
    preset: "eslint-config-next/core-web-vitals",
    effect: "Next framework correctness bundle",
    useWhen: "Next.js repository",
    doNotUseWhen: "Non-Next repositories",
  },
  {
    preset: "eslint-config-next/typescript",
    effect: "Next + TypeScript integration bundle",
    useWhen: "Next.js + TypeScript",
    doNotUseWhen: "No Next or no TypeScript",
  },
];

const RULE_STATE_CLASSIFICATION = {
  "unused-imports/no-unused-imports": "default",
  "simple-import-sort/imports": "conditional",
  "simple-import-sort/exports": "default",
  "@typescript-eslint/consistent-type-imports": "default",
  "@typescript-eslint/no-unnecessary-condition": "default",
  "@typescript-eslint/return-await": "default",
  "react-hooks/rules-of-hooks": "default",
  "react-hooks/exhaustive-deps": "conditional",
  "import-x/no-default-export": "conditional",
  "@typescript-eslint/no-explicit-any": "conditional",
};

const COMPOUND_CONTRACTS = [
  {
    id: "react-recommended-plus-ts-disables-prop-types",
    trigger: "react runtime + TS React zones",
    effect: "Disable react/prop-types in TS/TSX; keep hooks correctness",
    rollback:
      "Re-enable react/prop-types for JS/JSX zones if TS not source of truth",
  },
  {
    id: "next-plus-importx-requires-next-resolver",
    trigger: "Next.js + import-x unresolved/import checks",
    effect: "Require Next-aware resolver layered with TS resolver",
    rollback:
      "Remove only when Next import-resolution checks intentionally disabled",
  },
  {
    id: "unused-imports-plus-ts-no-unused-vars-dedup",
    trigger: "unused-imports + @typescript-eslint/no-unused-vars in same zone",
    effect:
      "Disable TS unused-vars and route unused checks to unused-imports rules",
    rollback: "Restore TS unused-vars if unused-imports is removed",
  },
  {
    id: "typed-baseline-plus-tooling-files-disable-typechecked",
    trigger: "Typed baseline active + tooling files outside TS program graph",
    effect:
      "Keep typed app/lib baseline, disable type-aware rules in tooling globs",
    rollback: "Remove once tooling files are in valid TS project graph",
  },
  {
    id: "next-app-strict-entrypoint-exception",
    trigger: "Next app + strict import boundary policy",
    effect:
      "Scoped off import-x/no-default-export in required app-router entrypoints",
    rollback: "Remove if framework entrypoint conventions change",
  },
];

const normalizeImportXPolicyConfig = (config) => {
  const rules = Object.fromEntries(
    Object.entries(config.rules ?? {}).map(([ruleName, ruleValue]) => [
      ruleName.startsWith("import/")
        ? ruleName.replace(/^import\//, "import-x/")
        : ruleName,
      ruleValue,
    ]),
  );
  const settings = { ...(config.settings ?? {}) };
  const plugins = { ...(config.plugins ?? {}) };

  delete settings["import/resolver"];
  delete plugins.import;

  return {
    ...config,
    ...(Object.keys(rules).length > 0 ? { rules } : {}),
    ...(Object.keys(settings).length > 0 ? { settings } : {}),
    ...(Object.keys(plugins).length > 0 ? { plugins } : {}),
  };
};

const normalizeImportXPolicyConfigs = (configs) => {
  const seenPlugins = new Set();

  return configs.map((config) => {
    const normalized = normalizeImportXPolicyConfig(config);
    const plugins = { ...(normalized.plugins ?? {}) };
    const { plugins: _plugins, ...configWithoutPlugins } = normalized;

    for (const pluginName of Object.keys(plugins)) {
      if (seenPlugins.has(pluginName)) {
        delete plugins[pluginName];
      } else {
        seenPlugins.add(pluginName);
      }
    }

    return {
      ...configWithoutPlugins,
      ...(Object.keys(plugins).length > 0 ? { plugins } : {}),
    };
  });
};

const eslintConfig = defineConfig(
  normalizeImportXPolicyConfigs([
    js.configs.recommended,

    // TypeScript type-checked rules
    ...tseslintConfigs.recommendedTypeChecked,

    // Next.js recommended configs (includes React, React Hooks, and Next.js rules)
    ...nextVitals,
    ...nextTs,
    {
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir: import.meta.dirname,
        },
      },
    },

    // Import plugin configuration
    importX.flatConfigs.recommended,
    importX.flatConfigs.typescript,
    {
      settings: {
        "import-x/resolver": {
          typescript: true,
          node: true,
        },
        "import-x/resolver-next": [
          createTypeScriptImportResolver({
            alwaysTryTypes: true,
            project: "tsconfig.json",
          }),
        ],
      },
    },

    // Promise plugin - using manual configuration instead of configs
    {
      plugins: {
        promise: pluginPromise,
      },
      rules: {
        "promise/always-return": "error",
        "promise/no-return-wrap": "error",
        "promise/param-names": "error",
        "promise/catch-or-return": "error",
        "promise/no-nesting": "warn",
        "promise/no-promise-in-callback": "warn",
        "promise/no-callback-in-promise": "warn",
        "promise/avoid-new": "off",
        "promise/no-new-statics": "error",
        "promise/no-return-in-finally": "warn",
        "promise/valid-params": "warn",
      },
    },

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
      files: REACT_SRC,
      plugins: {
        react,
      },
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
        "react/no-unstable-nested-components": [
          "error",
          { allowAsProps: false },
        ],
        "react/jsx-curly-brace-presence": [
          "error",
          { props: "never", children: "ignore" },
        ],
        "react/function-component-definition": ["warn"],
        "react/jsx-sort-props": [
          "warn",
          { callbacksLast: true, shorthandFirst: true, reservedFirst: true },
        ],
        "react/jsx-no-useless-fragment": "warn",
      },
    },

    // React Hooks configuration
    {
      files: ALL_SRC,
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
      files: ALL_SRC,
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
        "no-array-constructor": "off",
        "@typescript-eslint/no-array-constructor": "error",
        "no-implied-eval": "off",
        "@typescript-eslint/no-implied-eval": "error",
        "no-unused-expressions": "off",
        "@typescript-eslint/no-unused-expressions": "error",
        "no-throw-literal": "off",
        "@typescript-eslint/only-throw-error": "error",
        "prefer-promise-reject-errors": "off",
        "@typescript-eslint/prefer-promise-reject-errors": "error",
        "require-await": "off",
        "@typescript-eslint/require-await": "error",
        "no-use-before-define": "off",
        "@typescript-eslint/no-use-before-define": "error",
        "no-redeclare": "off",
        "@typescript-eslint/no-redeclare": "error",
        "import-x/order": "off",
        "import-x/no-duplicates": "error",
        "import-x/extensions": ["error", "never", { json: "always" }],
      },
    },

    // TS-only rules that need type info
    {
      files: TS_SRC,
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

    withCondition({
      blockId: "react-recommended-plus-ts-disables-prop-types",
      category: "runtime",
      targets: REACT_SRC,
      owner: "frontend",
      reason: "TS handles prop contracts in TS React zones",
      revalidate: "2026-12-31",
      offReasons: {
        "react/prop-types": "TypeScript is source of truth for props in TS/TSX",
      },
      rules: {
        "react/prop-types": "off",
      },
    }),

    withCondition({
      blockId: "next-plus-importx-requires-next-resolver",
      category: "runtime",
      targets: ALL_SRC,
      owner: "frontend-platform",
      reason: "Next path resolution requires Next-aware resolver layering",
      revalidate: "2026-12-31",
      settings: {
        "import-x/resolver-next": [
          createTypeScriptImportResolver({
            alwaysTryTypes: true,
            project: "tsconfig.json",
          }),
        ],
      },
    }),

    withCondition({
      blockId: "next-app-strict-entrypoint-exception",
      category: "zone",
      targets: [
        "src/app/**/page.tsx",
        "src/app/**/layout.tsx",
        "src/app/**/template.tsx",
        "src/app/**/error.tsx",
        "src/app/**/loading.tsx",
        "src/app/**/not-found.tsx",
      ],
      owner: "frontend-platform",
      reason: "Next app-router entrypoints require default exports",
      revalidate: "2026-12-31",
      offReasons: {
        "import-x/no-default-export": "Framework-mandated default export files",
      },
      rules: {
        "import-x/no-default-export": "off",
      },
    }),

    withCondition({
      blockId: "node-cli-tooling-pragmatic-interop",
      category: "zone",
      targets: TOOLING_SRC,
      owner: "platform",
      reason: "Config/scripts require CJS interop and weakly typed APIs",
      revalidate: "2026-10-01",
      offReasons: {
        "@typescript-eslint/no-require-imports":
          "CJS interop required by tooling ecosystem",
        "import-x/no-default-export":
          "Config file conventions commonly default-export",
        "@typescript-eslint/no-unsafe-assignment": "Tooling APIs often untyped",
      },
      rules: {
        "@typescript-eslint/no-require-imports": "off",
        "import-x/no-default-export": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
      },
    }),

    withCondition({
      blockId: "generated-code-relaxations",
      category: "zone",
      targets: GENERATED_SRC,
      owner: "platform",
      reason: "Generated output should not weaken hand-written code defaults",
      revalidate: "2026-10-01",
      offReasons: {
        "@typescript-eslint/no-explicit-any": "Generators frequently emit any",
        "@typescript-eslint/no-unsafe-assignment":
          "Generated serializers are often weakly typed",
        "import-x/no-default-export":
          "Generator entrypoints may require default exports",
      },
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "import-x/no-default-export": "off",
      },
    }),

    ...(has("typeAwareTs") && tseslintConfigs.disableTypeChecked
      ? [
          withCondition({
            blockId: "typed-baseline-plus-tooling-files-disable-typechecked",
            category: "tooling",
            targets: TOOLING_SRC,
            owner: "platform",
            reason: "Tooling files often outside app TS program graph",
            revalidate: "2026-09-15",
            inheritOffReason: true,
            ...tseslintConfigs.disableTypeChecked,
          }),
        ]
      : []),

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
  ]),
);

const validatePresetRegistry = () => {
  for (const item of NON_RECOMMENDED_PRESETS) {
    assert(item.preset, "non-recommended preset missing name");
    assert(item.effect, `${item.preset}: missing effect`);
    assert(item.useWhen, `${item.preset}: missing use-when`);
    assert(item.doNotUseWhen, `${item.preset}: missing do-not-use-when`);
  }
};

const validateNoImportMix = (configs) => {
  for (const cfg of configs) {
    const rules = cfg?.rules ?? {};
    const settings = cfg?.settings ?? {};

    for (const ruleName of Object.keys(rules)) {
      assert(
        !ruleName.startsWith("import/"),
        `legacy import rule '${ruleName}' is forbidden; use import-x/*`,
      );
    }

    assert(
      !("import/resolver" in settings),
      "settings['import/resolver'] forbidden in import-x policy",
    );
  }
};

const validateTypeAwareWiring = (configs) => {
  const typedEnabled = has("typeAwareTs");
  if (!typedEnabled) {
    return;
  }

  const hasProjectService = configs.some(
    (cfg) => cfg?.languageOptions?.parserOptions?.projectService === true,
  );
  const hasExplicitProject = configs.some(
    (cfg) =>
      typeof cfg?.languageOptions?.parserOptions?.project !== "undefined",
  );

  assert(
    hasProjectService || hasExplicitProject,
    "type-aware TS preset requires projectService: true or parserOptions.project",
  );
};

const validateConditionContracts = () => {
  assert(conditionContracts.length > 0, "no conditional contracts recorded");

  for (const contract of conditionContracts) {
    assert(contract.blockId, "conditional block missing id");
    assert(contract.owner, `${contract.blockId}: missing owner`);
    assert(contract.reason, `${contract.blockId}: missing reason`);
  }
};

const validateRuleStateClassification = () => {
  const allowed = new Set(["default", "conditional", "migration", "legacy"]);

  for (const [rule, state] of Object.entries(RULE_STATE_CLASSIFICATION)) {
    assert(allowed.has(state), `rule '${rule}' has invalid state '${state}'`);
  }
};

const validateCompoundContracts = () => {
  for (const contract of COMPOUND_CONTRACTS) {
    assert(contract.id, "compound missing id");
    assert(contract.trigger, `${contract.id}: missing trigger`);
    assert(contract.effect, `${contract.id}: missing effect`);
    assert(contract.rollback, `${contract.id}: missing rollback`);
  }
};

validatePresetRegistry();
validateNoImportMix(eslintConfig);
validateTypeAwareWiring(eslintConfig);
validateConditionContracts();
validateRuleStateClassification();
validateCompoundContracts();

export default eslintConfig;
