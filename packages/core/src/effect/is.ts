import * as AST from "@eslint-react/ast";
import { _ } from "@eslint-react/eff";
import type { TSESTree } from "@typescript-eslint/types";
import { AST_NODE_TYPES as T } from "@typescript-eslint/types";

import { isUseEffectCallLoose } from "../hook";

export function isFunctionOfUseEffectSetup(node: TSESTree.Node | _) {
  if (node == null) return _;
  return node.parent?.type === T.CallExpression
    && node.parent.callee !== node
    && node.parent.callee.type === T.Identifier
    && node.parent.arguments.at(0) === node
    && isUseEffectCallLoose(node.parent);
}

export function isFunctionOfUseEffectCleanup(node: TSESTree.Node) {
  const nearReturn = AST.findParentNode(node, AST.is(T.ReturnStatement));
  const nearFunction = AST.findParentNode(node, AST.isFunction);
  const nearFunctionOfReturn = AST.findParentNode(nearReturn, AST.isFunction);
  return nearFunction === nearFunctionOfReturn && isFunctionOfUseEffectSetup(nearFunction);
}
