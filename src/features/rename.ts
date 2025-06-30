import {
  CancellationToken,
  RenameParams,
  TextEdit,
  WorkspaceEdit,
} from "vscode-languageserver/node";

import {
  CallExpression,
  Declaration,
  isCallExpression,
  isDeclaration,
  isIdentifier,
  isIdentifierExpression,
  isIdentifierSizeNode,
  isSizeDeclList,
  Node,
  nodeOnPosition,
  travel,
  Workspace,
} from "@nn-lang/nn-language";
import { TypeChecker } from "@nn-lang/nn-type-checker";

import { LspContext } from "../types";
import { between } from "../utils";

export async function rename(
  params: RenameParams,
  context: LspContext,
  _token: CancellationToken
): Promise<WorkspaceEdit | null> {
  const document = context.documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  const workspaceUri = Object.keys(context.workspaces).find((uri) =>
    document.uri.startsWith(uri)
  );
  if (!workspaceUri) {
    return null;
  }

  const workspace = context.workspaces[workspaceUri];
  if (!(document.uri in workspace.sources)) {
    await Workspace.addFiles([document.uri], workspace);
  }

  const source = workspace.sources.get(document.uri);
  if (!source) {
    return null;
  }

  const checkContext = TypeChecker.check(workspace);
  const fileScope = checkContext.scope.files[document.uri];

  const renamePosition = document.offsetAt(params.position);

  const processed =
    processRename(
      source.declarations,
      renamePosition,
      isIdentifierSizeNode,
      (node) => {
        const declaration = nodeOnPosition(
          source.declarations,
          node.position.pos,
          isDeclaration
        );
        if (!declaration) return null;

        const scope = fileScope.declarations[declaration.name.value];
        if (!scope) return null;

        const size = scope.sizes[node.ident.value];

        return [...size.nodes].map((node) => ({
          range: {
            start: document.positionAt(node.position.pos),
            end: document.positionAt(node.position.end),
          },
          newText: params.newName,
        }));
      }
    ) ||
    processRename(
      source.declarations,
      renamePosition,
      isIdentifierExpression,
      (node) => {
        const declaration = nodeOnPosition(
          source.declarations,
          node.position.pos,
          isDeclaration
        );
        if (!declaration) return null;

        const scope = fileScope.declarations[declaration.name.value];
        if (!scope) return null;

        const value = scope.values[node.ident.value];

        return [...value.nodes].map((node) => ({
          range: {
            start: document.positionAt(node.position.pos),
            end: document.positionAt(node.position.end),
          },
          newText: params.newName,
        }));
      }
    ) ||
    processRename(
      source.declarations,
      renamePosition,
      isSizeDeclList,
      (node) => {
        const actual = nodeOnPosition(node, renamePosition, isIdentifier);
        if (!actual) return null;

        const declaration = nodeOnPosition(
          source.declarations,
          node.position.pos,
          isDeclaration
        );
        if (!declaration) return null;

        const scope = fileScope.declarations[declaration.name.value];
        if (!scope) return null;

        const size = scope.sizes[actual.value];
        if (!size) return null;

        return [...size.nodes].map((node) => ({
          range: {
            start: document.positionAt(node.position.pos),
            end: document.positionAt(node.position.end),
          },
          newText: params.newName,
        }));
      }
    ) ||
    processRename(
      source.declarations,
      renamePosition,
      isCallExpression,
      (node) => {
        const actual = between(
          node.callee.position.pos,
          node.callee.position.end
        )(renamePosition)
          ? node.callee
          : null;
        if (!actual) return null;

        const original = fileScope.flows[actual.value].declaration.node;
        const calls = travel<CallExpression>(source.declarations, (node) => {
          return isCallExpression(node) && node.callee.value === actual.value;
        });

        return [
          {
            range: {
              start: document.positionAt(original.name.position.pos),
              end: document.positionAt(original.name.position.end),
            },
            newText: params.newName,
          },
          ...calls.map((node) => ({
            range: {
              start: document.positionAt(node.callee.position.pos),
              end: document.positionAt(node.callee.position.end),
            },
            newText: params.newName,
          })),
        ];
      }
    ) ||
    processRename(
      source.declarations,
      renamePosition,
      isDeclaration,
      (node) => {
        const actual = between(
          node.name.position.pos,
          node.name.position.end
        )(renamePosition)
          ? node.name
          : null;
        if (!actual) return null;

        const calls = travel<CallExpression>(source.declarations, (node) => {
          return isCallExpression(node) && node.callee.value === actual.value;
        });

        return [
          {
            range: {
              start: document.positionAt(actual.position.pos),
              end: document.positionAt(actual.position.end),
            },
            newText: params.newName,
          },
          ...calls.map((node) => ({
            range: {
              start: document.positionAt(node.callee.position.pos),
              end: document.positionAt(node.callee.position.end),
            },
            newText: params.newName,
          })),
        ];
      }
    );

  if (!processed) return null;

  const [, changes] = processed;

  return {
    changes: {
      [document.uri]: changes,
    },
  };
}

function processRename<T extends Node>(
  tree: Declaration[],
  hoverPosition: number,
  constraint: (node: Node) => node is T,
  toChanges: (node: T) => TextEdit[] | null
): [T, TextEdit[]] | null {
  const node = nodeOnPosition(tree, hoverPosition, constraint);

  if (!node) {
    return null;
  }

  const changes = toChanges(node);
  if (!changes) {
    return null;
  }

  return [node, changes];
}
