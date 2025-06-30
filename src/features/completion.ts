import {
  CancellationToken,
  CompletionItemKind,
  CompletionList,
  CompletionParams,
} from "vscode-languageserver/node";

import { Workspace } from "@nn-lang/nn-language";
import { TypeChecker } from "@nn-lang/nn-type-checker";
import { isDeclaration, nodeOnPosition } from "@nn-lang/nn-language";

import { LspContext } from "../types";

export async function completion(
  params: CompletionParams,
  context: LspContext,
  _token?: CancellationToken
): Promise<CompletionList | null> {
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
  const completionPosition = document.offsetAt(params.position);

  const currentDeclaration = nodeOnPosition(
    source.declarations,
    completionPosition,
    isDeclaration
  );

  const flows = Object.values(fileScope.flows);
  const sizes = currentDeclaration
    ? Object.values(
        fileScope.declarations[currentDeclaration.name.value].sizes
      )
    : [];
  const values = currentDeclaration
    ? Object.values(
        fileScope.declarations[currentDeclaration.name.value].values
      )
    : [];

  const completions: CompletionList = {
    items: [
      ...flows.map((flow) => ({
        label: flow.declaration.declaration,
        kind: CompletionItemKind.Function,
        data: {
          uri: document.uri,
          position: flow.declaration.node.position.pos,
        },
      })),
      ...sizes.map((size) => ({
        label: size.ident,
        kind: CompletionItemKind.Variable,
        data: {
          uri: document.uri,
          position: size.first.position.pos,
        },
      })),
      ...values.map((value) => ({
        label: value.ident,
        kind: CompletionItemKind.Variable,
        data: {
          uri: document.uri,
          position: value.first.position.pos,
        },
      })),
    ],
    isIncomplete: false,
  };

  return completions;
}
