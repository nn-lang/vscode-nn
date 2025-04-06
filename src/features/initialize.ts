import {
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
} from "vscode-languageserver/node";
import { Language, Parser } from "web-tree-sitter";
import _language from "@nn-lang/nn-tree-sitter/tree-sitter-nn.wasm";

import * as fs from "fs";
import * as path from "path";

import { LspContext } from "../types";

export async function initialize(
  params: InitializeParams,
  context: Partial<LspContext>
): Promise<InitializeResult> {
  context.initializeParams = params;
  context.workspaceRoots = params.workspaceFolders?.map((f) => f.uri) ?? [];

  await Parser.init();
  const language = await Language.load(
    fs.readFileSync(path.join(__dirname, _language))
  );
  const parser = new Parser();
  parser.setLanguage(language);
  context.parser = parser;

  const initializeResult: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        triggerCharacters: [":", "[", "(", ","],
      },
      // codeActionProvider: true,
      // codeLensProvider: false,
      definitionProvider: true,
      declarationProvider: true,
      // documentFormattingProvider: true,
      // documentRangeFormattingProvider: true,
      // documentHighlightProvider: true,
      documentSymbolProvider: true,
      executeCommandProvider: { commands: [] },
      hoverProvider: true,
      // inlayHintProvider: true,
      // linkedEditingRangeProvider: true,
      renameProvider: true,
      // referencesProvider: true,
      // selectionRangeProvider: true,
      // signatureHelpProvider: {},
      // workspaceSymbolProvider: true,
      // implementationProvider: false,
      // typeDefinitionProvider: true,
      // foldingRangeProvider: true,
    },
  };

  return initializeResult;
}
