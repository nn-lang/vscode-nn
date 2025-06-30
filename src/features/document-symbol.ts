import {
  CancellationToken,
  DocumentSymbol,
  DocumentSymbolParams,
  SymbolKind,
} from "vscode-languageserver/node";

import { Workspace } from "@nn-lang/nn-language";
import { Size, TypeChecker, Value } from "@nn-lang/nn-type-checker";

import { TextDocument } from "vscode-languageserver-textdocument";

import { LspContext } from "../types";

export async function documentSymbol(
  params: DocumentSymbolParams,
  context: LspContext,
  _token: CancellationToken
): Promise<DocumentSymbol[]> {
  const document = context.documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  const workspaceUri = Object.keys(context.workspaces).find((uri) =>
    document.uri.startsWith(uri)
  );
  if (!workspaceUri) {
    return [];
  }

  const workspace = context.workspaces[workspaceUri];
  if (!(document.uri in workspace.sources)) {
    await Workspace.addFiles([document.uri], workspace);
  }

  const checkContext = TypeChecker.check(workspace);
  const fileScope = checkContext.scope.files[document.uri];

  console.log(fileScope);

  const declarationSymbols = Object.values(
    fileScope.declarations
  ).map<DocumentSymbol>((scope) => ({
    name: scope.declaration,
    kind: SymbolKind.Function,
    range: {
      start: document.positionAt(scope.node.position.pos),
      end: document.positionAt(scope.node.position.end),
    },
    selectionRange: {
      start: document.positionAt(scope.node.name.position.pos),
      end: document.positionAt(scope.node.name.position.end),
    },
    children: [
      ...Object.values(scope.values).flatMap((value) =>
        valueSymbols(document, value)
      ),
      ...Object.values(scope.sizes).flatMap((size) =>
        sizeSymbols(document, size)
      ),
    ],
  }));

  return declarationSymbols;
}

function valueSymbols(document: TextDocument, value: Value): DocumentSymbol {
  return {
    name: value.ident,
    kind: SymbolKind.Variable,
    range: {
      start: document.positionAt(value.first.position.pos),
      end: document.positionAt(value.first.position.end),
    },
    selectionRange: {
      start: document.positionAt(value.first.position.pos),
      end: document.positionAt(value.first.position.end),
    },
    children: [],
  };
}

function sizeSymbols(document: TextDocument, size: Size): DocumentSymbol {
  return {
    name: size.ident,
    kind: SymbolKind.Variable,
    range: {
      start: document.positionAt(size.first.position.pos),
      end: document.positionAt(size.first.position.end),
    },
    selectionRange: {
      start: document.positionAt(size.first.position.pos),
      end: document.positionAt(size.first.position.end),
    },
    children: [],
  };
}
