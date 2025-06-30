import { InitializeParams, TextDocuments } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { CompilerFileSystem, Parser, Workspace } from "@nn-lang/nn-language";

import { LspClient } from "./client";
import { Logger } from "./utils";

export interface LspContext {
  showMessageLevel: number;
  client: LspClient;
  documents: TextDocuments<TextDocument>;

  parser: Parser;
  workspaces: Record<string, Workspace>
  lspFileSystem: CompilerFileSystem;

  // fileConfigurationManager: FileConfigurationManager;
  initializeParams: InitializeParams;
  // diagnosticQueue: DiagnosticQueue;
  // completionDataCache: CompletionDataCache;
  logger: Logger;
  workspaceRoots: string[];
}
