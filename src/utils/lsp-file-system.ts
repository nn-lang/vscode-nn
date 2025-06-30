import { CompilerFileSystem, CompilerOptions } from "@nn-lang/nn-language";

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as url from "node:url";

import { Logger } from "./Logger";

export class LSPFileSystem implements CompilerFileSystem {
  constructor(private logger: Logger) {}

  async checkExists(fileUri: string): Promise<boolean> {
    return fs.lstat(url.fileURLToPath(fileUri)).then((stat) => stat.isFile());
  }

  dirname(fileUri: string): string {
    return path.normalize(path.dirname(fileUri));
  }

  resolve(...paths: string[]): string {
    const normalized = paths.map((filePath) =>
      filePath.startsWith("file:")
        ? url.fileURLToPath(filePath)
        : path.normalize(filePath)
    );

    return path.resolve(...normalized);
  }

  dependencyResolver(
    fromUri: string,
    reference: string,
    options: CompilerOptions
  ): string {
    return url.resolve(fromUri, reference);
  }

  async readFile(filePath: string): Promise<string> {
    return fs.readFile(url.fileURLToPath(filePath), "utf-8");
  }

  async writeFile(filePath: string, content: string): Promise<boolean> {
    try {
      await fs.writeFile(url.fileURLToPath(filePath), content);
      return true;
    } catch (e) {
      this.logger.error(e);
      return false;
    }
  }
}
