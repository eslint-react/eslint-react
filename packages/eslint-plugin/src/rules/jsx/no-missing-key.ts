import { getNestedReturnStatements, is, isOneOf, NodeType } from "@eslint-react/ast";
import { hasProp, unsafeIsArrayFromCall, unsafeIsMapCall } from "@eslint-react/jsx";
import { getFragmentFromContext, getPragmaFromContext } from "@eslint-react/pragma";
import { E, MutRef, O } from "@eslint-react/tools";
import type { TSESTree } from "@typescript-eslint/types";
import type { ESLintUtils } from "@typescript-eslint/utils";
import type { ReportDescriptor } from "@typescript-eslint/utils/ts-eslint";
import { match } from "ts-pattern";

import { createRule, getChildrenToArraySelector } from "../../utils";

export const RULE_NAME = "jsx/no-missing-key";

type MessageID = "INVALID" | "INVALID_FRAGMENT";

export default createRule<[], MessageID>({
    name: RULE_NAME,
    meta: {
        type: "problem",
        docs: {
            description: "disallow comments from being inserted as text nodes",
            recommended: "recommended",
            requiresTypeChecking: false,
        },
        schema: [],
        messages: {
            INVALID: "Missing key prop for element when rendering list",
            INVALID_FRAGMENT:
                "Missing key prop for element when rendering list. Use `{{reactPragma}}.{{fragmentPragma}}` component instead of `<>` because it does not support key prop",
        },
    },
    defaultOptions: [],
    // eslint-disable-next-line sonarjs/cognitive-complexity
    create(context) {
        const maybeReactPragma = getPragmaFromContext(context);
        const maybeFragmentPragma = getFragmentFromContext(context);
        if (E.isLeft(maybeReactPragma)) {
            return {};
        }

        if (E.isLeft(maybeFragmentPragma)) {
            return {};
        }

        const reactPragma = maybeReactPragma.right;
        const fragmentPragma = maybeFragmentPragma.right;
        const childrenToArraySelector = getChildrenToArraySelector(reactPragma);
        const isWithinChildrenToArrayRef = MutRef.make(false);

        function checkIteratorElement(node: TSESTree.Node): O.Option<ReportDescriptor<MessageID>> {
            if (node.type === NodeType.JSXElement && !hasProp(node.openingElement.attributes, "key", context)) {
                return O.some({
                    messageId: "INVALID",
                    node,
                });
            }
            if (node.type === NodeType.JSXFragment) {
                return O.some({
                    messageId: "INVALID_FRAGMENT",
                    data: {
                        reactPragma,
                        fragmentPragma,
                    },
                    node,
                });
            }

            return O.none();
        }

        function checkExpression(node: TSESTree.Expression): O.Option<ReportDescriptor<MessageID>> {
            return match(node)
                .with({ type: NodeType.JSXElement }, checkIteratorElement)
                .with({ type: NodeType.JSXFragment }, checkIteratorElement)
                .with({ type: NodeType.ConditionalExpression }, (n) => {
                    if (!("consequent" in n)) {
                        return O.none();
                    }

                    return O.orElse(checkIteratorElement(n.consequent), () => checkIteratorElement(n.alternate));
                })
                .with({ type: NodeType.LogicalExpression }, (n) => {
                    if (!("left" in n)) {
                        return O.none();
                    }

                    return O.orElse(checkIteratorElement(n.left), () => checkIteratorElement(n.right));
                })
                .otherwise(O.none);
        }

        function checkBlockStatement(node: TSESTree.BlockStatement) {
            const statements = getNestedReturnStatements(node);

            return statements.reduce<ReportDescriptor<MessageID>[]>((acc, statement) => {
                if (!statement.argument) {
                    return acc;
                }
                const maybeMessageId = checkIteratorElement(statement.argument);
                if (O.isNone(maybeMessageId)) {
                    return acc;
                }

                return [...acc, maybeMessageId.value];
            }, []);
        }

        return {
            [childrenToArraySelector]() {
                MutRef.set(isWithinChildrenToArrayRef, true);
            },
            [`${childrenToArraySelector}:exit`]() {
                MutRef.set(isWithinChildrenToArrayRef, false);
            },
            ArrayExpression(node) {
                if (MutRef.get(isWithinChildrenToArrayRef)) {
                    return;
                }
                const JSXElements = node.elements.filter(is(NodeType.JSXElement));
                if (JSXElements.length === 0) {
                    return;
                }
                for (const element of JSXElements) {
                    if (!hasProp(element.openingElement.attributes, "key", context)) {
                        context.report({
                            messageId: "INVALID",
                            node: element,
                        });
                    }
                }
            },
            JSXFragment(node) {
                if (MutRef.get(isWithinChildrenToArrayRef)) {
                    return;
                }
                if (node.parent.type === NodeType.ArrayExpression) {
                    context.report({
                        messageId: "INVALID_FRAGMENT",
                        data: {
                            reactPragma,
                            fragmentPragma,
                        },
                        node,
                    });
                }
            },
            CallExpression(node) {
                const isMapCall = unsafeIsMapCall(node);
                const isArrayFromCall = unsafeIsArrayFromCall(node);
                if (!isMapCall && !isArrayFromCall) {
                    return;
                }
                if (MutRef.get(isWithinChildrenToArrayRef)) {
                    return;
                }
                const fn = node.arguments[isMapCall ? 0 : 1];
                if (!isOneOf([NodeType.ArrowFunctionExpression, NodeType.FunctionExpression])(fn)) {
                    return;
                }
                if (fn.body.type === NodeType.BlockStatement) {
                    const messages = checkBlockStatement(fn.body);

                    for (const message of messages) {
                        context.report(message);
                    }

                    return;
                }
                O.map(checkExpression(fn.body), context.report);
            },
        };
    },
});
