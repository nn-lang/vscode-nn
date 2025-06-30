import {
  CancellationToken,
  Hover,
  MarkupContent,
  TextDocumentPositionParams,
} from "vscode-languageserver/node";

import {
  Declaration,
  getTypeNodeString,
  Import,
  isArgumentList,
  isAssignmentExpression,
  isCallExpression,
  isDeclaration,
  isIdentifier,
  isIdentifierExpression,
  isIdentifierSizeNode,
  Node,
  nodeOnPosition,
  travel,
  Workspace,
} from "@nn-lang/nn-language";
import { Type, TypeChecker } from "@nn-lang/nn-type-checker";

import { LspContext } from "../types";
import { MarkdownString } from "../utils";

export async function hover(
  params: TextDocumentPositionParams,
  context: LspContext,
  _token?: CancellationToken
): Promise<Hover | null> {
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

  const hoverPosition = document.offsetAt(params.position);

  const getTypeStringForNode = (node: Node) => {
    const vertex = checkContext.vertices.get(node);
    if (!vertex) {
      return "Unknown";
    }

    return vertex.type.isSome()
      ? Type.toString(vertex.type.unwrap())
      : "Unknown";
  };

  const hoverContent =
    processHover(source.dependencies, hoverPosition, isIdentifier, (node) => {
      const clause = source.dependencies.find((importClause) =>
        travel(importClause, (targetNode) => targetNode === node)
      );

      if (!clause) return null;

      const resolvedUri = context.lspFileSystem.dependencyResolver(
        document.uri,
        clause.target,
        { cwd: workspaceUri, fileSystem: context.lspFileSystem },
      )

      const targetFileScope = checkContext.scope.files[resolvedUri];
      if (!targetFileScope) return null;

      const flow = targetFileScope.flows[node.value];
      if (!flow) {
        return null;
      }

      const sizeArgs: string[] = flow.declaration.node.sizeDeclList.decls.map(
        (decl) => decl.value
      );

      const args: string[] = flow.args.map(
        (arg) => `${arg.ident}: ${getTypeStringForNode(arg.first)}`
      );

      const returnType =
        (flow.returnType && getTypeNodeString(flow.returnType)) ||
        (flow.return && getTypeStringForNode(flow.return)) ||
        "Unknown";

      return new MarkdownString()
        .appendCodeblock(
          `(function) ${node.value}[${sizeArgs.join(
            ", "
          )}](${args.join(", ")}): ${returnType}`,
          "nn"
        )
        .toMarkupContent();
    }) ||
    processHover(
      source.declarations,
      hoverPosition,
      isIdentifierSizeNode,
      (node) =>
        new MarkdownString()
          .appendCodeblock(`(size type) ${node.ident.value}`, "nn")
          .toMarkupContent()
    ) ||
    processHover(
      source.declarations,
      hoverPosition,
      isIdentifierExpression,
      (node) => {
        const vertex = checkContext.vertices.get(node);
        if (!vertex) {
          return null;
        }

        const typeString = vertex.type.isSome()
          ? Type.toString(vertex.type.unwrap())
          : "Unknown";

        return new MarkdownString()
          .appendCodeblock(`(value) ${node.ident.value}: ${typeString}`, "nn")
          .toMarkupContent();
      }
    ) ||
    processHover(
      source.declarations,
      hoverPosition,
      isCallExpression,
      (node) => {
        const flow = fileScope.flows[node.callee.value];
        if (!flow) {
          return null;
        }

        const sizeArgs: string[] = flow.declaration.node.sizeDeclList.decls.map(
          (decl) => decl.value
        );

        const args: string[] = flow.args.map(
          (arg) => `${arg.ident}: ${getTypeStringForNode(arg.first)}`
        );

        const returnType =
          (flow.returnType && getTypeNodeString(flow.returnType)) ||
          (flow.return && getTypeStringForNode(flow.return)) ||
          "Unknown";

        return new MarkdownString()
          .appendCodeblock(
            `(function) ${node.callee.value}[${sizeArgs.join(
              ", "
            )}](${args.join(", ")}): ${returnType}`,
            "nn"
          )
          .toMarkupContent();
      }
    ) ||
    processHover(
      source.declarations,
      hoverPosition,
      isAssignmentExpression,
      (node) => {
        const vertex = checkContext.vertices.get(node);
        if (!vertex) {
          return null;
        }

        const typeString = vertex.type.isSome()
          ? Type.toString(vertex.type.unwrap())
          : "Unknown";

        return new MarkdownString()
          .appendCodeblock(`(value) ${node.left.value}: ${typeString}`, "nn")
          .toMarkupContent();
      }
    ) ||
    processHover(source.declarations, hoverPosition, isDeclaration, (node) => {
      const flow = fileScope.flows[node.name.value];
      if (!flow) {
        return null;
      }

      const sizeArgs: string[] = flow.declaration.node.sizeDeclList.decls.map(
        (decl) => decl.value
      );

      const args: string[] = flow.args.map(
        (arg) => `${arg.ident}: ${getTypeStringForNode(arg.first)}`
      );

      const returnType =
        (flow.returnType && getTypeNodeString(flow.returnType)) ||
        (flow.return && getTypeStringForNode(flow.return)) ||
        "Unknown";

      return new MarkdownString()
        .appendCodeblock(
          `(function) ${node.name.value}[${sizeArgs.join(", ")}](${args.join(
            ", "
          )}): ${returnType}`,
          "nn"
        )
        .appendMarkdown("\n")
        .appendMarkdown(node.commentLeading.join("\n\n"))
        .appendMarkdown("\n")
        .appendMarkdown(node.commentTrailing.join("\n\n"))
        .toMarkupContent();
    });

  if (!hoverContent) {
    return null;
  }

  const [hoverNode, markdown] = hoverContent;

  return {
    contents: markdown,
    range: {
      start: document.positionAt(hoverNode.position.pos),
      end: document.positionAt(hoverNode.position.end),
    },
  };
}

function processHover<T extends Node>(
  tree: Declaration[] | Import[],
  hoverPosition: number,
  constraint: (node: Node) => node is T,
  toMarkdown: (node: T) => MarkupContent | null
): [Node, MarkupContent] | null {
  const node = nodeOnPosition(tree, hoverPosition, constraint);

  if (!node) {
    return null;
  }

  const markdown = toMarkdown(node);
  if (!markdown) {
    return null;
  }

  return [node, markdown];
}
