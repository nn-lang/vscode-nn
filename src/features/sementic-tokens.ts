import {
  DocumentSymbolParams,
  SemanticTokens,
  SemanticTokensBuilder,
  SymbolKind,
} from "vscode-languageserver/node";
import { LspContext } from "../types";

import { isCallExpression, travel, Workspace } from "@nn-lang/nn-language";

export async function semanticTokens(
  params: DocumentSymbolParams,
  context: LspContext
): Promise<SemanticTokens> {
  const document = context.documents.get(params.textDocument.uri);
  const builder = new SemanticTokensBuilder();

  if (!document) {
    console.warn(`Document not found: ${params.textDocument.uri}`);
    return builder.build();
  }

  const workspaceUri = Object.keys(context.workspaces).find((uri) =>
    document.uri.startsWith(uri)
  );
  if (!workspaceUri) {
    return builder.build();
  }

  const workspace = context.workspaces[workspaceUri];
  if (!(document.uri in workspace.sources)) {
    await Workspace.addFiles([document.uri], workspace);
  }

  const source = workspace.sources.get(document.uri);
  if (!source) {
    return builder.build();
  }
  const callExpressions = travel(source.declarations, isCallExpression);

  for (const decl of source.declarations) {
    const { position } = decl.name;
    const startPos = document.positionAt(position.pos);

    builder.push(
      startPos.line,
      startPos.character,
      position.end - position.pos,
      SymbolKind.Function,
      0
    );
  }

  for (const call of callExpressions) {
    const { position } = call.callee;
    const startPos = document.positionAt(position.pos);

    builder.push(
      startPos.line,
      startPos.character,
      position.end - position.pos,
      SymbolKind.Function,
      0
    );
  }

  source.dependencies.forEach((importClause) => {
    importClause.idents.forEach((ident) => {
      const { position } = ident;
      const startPos = document.positionAt(position.pos);

      builder.push(
        startPos.line,
        startPos.character,
        position.end - position.pos,
        SymbolKind.Function,
        0
      );
    });
  });

  return builder.build();
}
