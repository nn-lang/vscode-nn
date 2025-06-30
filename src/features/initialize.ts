import {
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
} from "vscode-languageserver/node";
import { Language, Parser as TreeSitterParser } from "web-tree-sitter";
import { Workspace } from "@nn-lang/nn-language";
import _language from "@nn-lang/nn-tree-sitter/tree-sitter-nn.wasm";

import * as fs from "fs";
import * as path from "path";

import { LspContext } from "../types";
import { LSPFileSystem } from "../utils/lsp-file-system";

export async function initialize(
  params: InitializeParams,
  context: Partial<LspContext>
): Promise<InitializeResult> {
  context.initializeParams = params;
  context.workspaceRoots = params.workspaceFolders?.map((f) => f.uri) ?? [];

  await TreeSitterParser.init();
  const language = await Language.load(
    fs.readFileSync(path.join(__dirname, _language))
  );
  const parser = new TreeSitterParser();
  parser.setLanguage(language);
  context.parser = parser as any;

  context.lspFileSystem = new LSPFileSystem(context.logger!);
  context.workspaces = {};

  const tasks = (params.workspaceFolders ?? []).map(async (folder) => {
    context.workspaces![folder.uri] = await Workspace.create(
      [],
      { cwd: folder.uri, fileSystem: context.lspFileSystem! },
      context.parser!
    );
  });
  await Promise.all(tasks);

  console.log(context.workspaces);

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
