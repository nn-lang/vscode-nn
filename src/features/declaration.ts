import {
  CancellationToken,
  Declaration,
  DeclarationParams,
} from "vscode-languageserver/node";
import { LspContext } from "../types";

import {
  isDeclaration,
  isIdentifierExpression,
  isIdentifierSizeNode,
  nodeOnPosition,
  Workspace,
} from "@nn-lang/nn-language";

import { TypeChecker } from "@nn-lang/nn-type-checker";

export async function declaration(
  params: DeclarationParams,
  context: LspContext,
  _token?: CancellationToken
): Promise<Declaration | null> {
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

  const requestedPosition = document.offsetAt(params.position);

  const identNode = nodeOnPosition(
    source.declarations,
    requestedPosition,
    (node) => isIdentifierExpression(node) || isIdentifierSizeNode(node)
  );

  const declarationNode = nodeOnPosition(
    source.declarations,
    requestedPosition,
    isDeclaration
  );

  if (!identNode || !declarationNode) {
    return null;
  }

  const declarationScope =
    fileScope.declarations[declarationNode.name.value];

  if (isIdentifierSizeNode(identNode)) {
    const size = declarationScope.sizes[identNode.ident.value];
    return {
      uri: params.textDocument.uri,
      range: {
        start: document.positionAt(size.first.position.pos),
        end: document.positionAt(size.first.position.end),
      },
    };
  }

  if (isIdentifierExpression(identNode)) {
    const value = declarationScope.values[identNode.ident.value];
    return {
      uri: params.textDocument.uri,
      range: {
        start: document.positionAt(value.first.position.pos),
        end: document.positionAt(value.first.position.end),
      },
    };
  }

  return null;
}
