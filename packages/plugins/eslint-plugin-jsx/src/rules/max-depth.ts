// Ported from https://github.com/jsx-eslint/eslint-plugin-react/blob/b4b7497eaf49360449883d5fe80e7590e69ae143/tests/lib/rules/jsx-max-depth.js
// with some modifications, credits to the original authors.
import { is, isOneOf, NodeType } from "@eslint-react/ast";
import { F, O } from "@eslint-react/tools";
import type { TSESTree } from "@typescript-eslint/types";
import type { ESLintUtils } from "@typescript-eslint/utils";
import type { JSONSchema4 } from "@typescript-eslint/utils/json-schema";
import type { ReportDescriptor } from "@typescript-eslint/utils/ts-eslint";
import type { ConstantCase } from "string-ts";

import { createRule } from "../utils";

export const RULE_NAME = "max-depth";

export type MessageID = ConstantCase<typeof RULE_NAME>;

const DEFAULT_MAX_DEPTH = 12;

/* eslint-disable no-restricted-syntax */
type Options = [
  {
    max?: number;
  }?,
];
/* eslint-enable no-restricted-syntax */

const defaultOptions = [{
  max: DEFAULT_MAX_DEPTH,
}] as const satisfies Options;

const schema = [{
  type: "object",
  properties: {
    max: {
      type: "integer",
      minimum: 0,
    },
  },
  additionalProperties: false,
}] satisfies [JSONSchema4];

const isJSX = isOneOf([NodeType.JSXElement, NodeType.JSXFragment]);
const isExpression = is(NodeType.JSXExpressionContainer);

function hasJSX(node: TSESTree.Node) {
  if (isJSX(node)) {
    return true;
  }

  return isExpression(node) && isJSX(node.expression);
}

function isLeaf(node: TSESTree.JSXElement | TSESTree.JSXFragment) {
  const { children } = node;

  return children.length === 0 || !children.some(hasJSX);
}

function getDepth(node: TSESTree.Node, depth = 0) {
  if (isJSX(node)) {
    return getDepth(node.parent, depth + 1);
  }

  if (isExpression(node)) {
    return getDepth(node.parent, depth);
  }

  return depth;
}

function checkJSX(maxDepth: number) {
  return (node: TSESTree.JSXElement | TSESTree.JSXFragment): O.Option<ReportDescriptor<MessageID>> => {
    if (!isLeaf(node)) {
      return O.none();
    }

    const depth = getDepth(node);
    if (depth > maxDepth) {
      return O.some({
        node,
        messageId: "MAX_DEPTH",
        data: {
          maxDepth,
          depth,
        },
      });
    }

    return O.none();
  };
}

export default createRule<Options, MessageID>({
  name: RULE_NAME,
  meta: {
    type: "problem",
    docs: {
      description: "enforce a maximum depth that JSX can be nested",
      requiresTypeChecking: false,
    },
    schema,
    messages: {
      MAX_DEPTH: "Expected the depth of nested JSX elements to be <= {{maxDepth}}, but found {{depth}}.",
    },
  },
  defaultOptions,
  create(context) {
    const maxDepth = context.options[0]?.max ?? defaultOptions[0].max;

    return {
      "JSXElement, JSXFragment": F.flow(checkJSX(maxDepth), O.map(context.report)),
    };
  },
});
