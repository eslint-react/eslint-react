# eslint-plugin-react-naming-convention

Naming convention rules.

## Install

```sh
# npm
npm install --save-dev eslint-plugin-react-naming-convention
```

## Setup

```js
// @ts-check

import js from "@eslint/js";
import reactNamingConvention from "eslint-plugin-react-naming-convention";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-naming-convention": reactNamingConvention,
    },
    rules: {
      // react-naming-convention recommended rules
      "react-naming-convention/filename-extension": ["warn", "as-needed"],
      "react-naming-convention/use-state": "warn",
    },
  },
];
```

## Rules

<https://eslint-react.xyz/docs/rules/overview#naming-convention-rules>
