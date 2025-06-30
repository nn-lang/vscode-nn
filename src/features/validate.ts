import { Diagnostic } from "vscode-languageserver/node";
import { URI } from "vscode-uri";

import { Workspace } from "@nn-lang/nn-language";

import { TypeChecker } from "@nn-lang/nn-type-checker";

import { LspContext } from "../types";
import { ResourceMap } from "../utils/resourceMap";

export async function validateAllDocuments(
  context: LspContext,
  files: ResourceMap<void>
): Promise<void> {
  for (const file of files.entries) {
    await validateTextDocument(file.resource, context);
  }
}

export async function validateTextDocument(
  textDocumentUri: URI,
  context: LspContext
): Promise<void> {
  const document = context.documents.get(textDocumentUri.toString());
  if (!document) {
    return;
  }

  const workspaceUri = Object.keys(context.workspaces).find((uri) =>
    document.uri.startsWith(uri)
  );
  if (!workspaceUri) {
    return;
  }

  const workspace = context.workspaces[workspaceUri];
  if (!(document.uri in workspace.sources)) {
    await Workspace.addFiles([document.uri], workspace);
  }

  const sourceFile = workspace.sources.get(document.uri);
  if (!sourceFile) {
    return;
  }
  const checkContext = TypeChecker.check(workspace);
  const diagnostics: Diagnostic[] = [];

  const tcDiagnostics = checkContext.diagnostics
    .filter(({ source }) => source === sourceFile);

  [...sourceFile.diagnostics, ...tcDiagnostics].forEach((diagnostic) => {
    const startPos = document.positionAt(diagnostic.position.pos);
    const endPos = document.positionAt(diagnostic.position.end);

    diagnostics.push({
      range: {
        start: startPos,
        end: endPos,
      },
      severity: 1,
      message: diagnostic.message,
      source: "nn-language-server",
    });
  });

  context.client.sendDiagnostics({
    uri: document.uri,
    diagnostics,
  });
}
