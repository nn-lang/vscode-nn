import { MessageType } from "vscode-languageserver/node";
import { createLspConnection } from "./connection";

const DEFAULT_LOG_LEVEL = MessageType.Info;

const parseArgs = (argv: string[]) => {
  const args = argv.slice(2); // Remove node and script path
  const options = {
    nodeIpc: false,
    logLevel: DEFAULT_LOG_LEVEL.toString(),
    version: '0.0.1'
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--node-ipc':
        options.nodeIpc = true;
        break;
      case '--log-level':
        if (i + 1 < args.length) {
          options.logLevel = args[++i];
        }
        break;
      case '--version':
        console.log(options.version);
        process.exit(0);
    }
  }
  return options;
};

const opts = parseArgs(process.argv);

let logLevel: MessageType = DEFAULT_LOG_LEVEL;
if (opts.logLevel) {
  logLevel = parseInt(opts.logLevel) as MessageType;
  if (logLevel && (logLevel < MessageType.Error || logLevel > MessageType.Log)) {
    console.error(`Invalid --log-level ${logLevel}. Defaults to ${DEFAULT_LOG_LEVEL}.`);
    logLevel = DEFAULT_LOG_LEVEL;
  }
}

createLspConnection({
  showMessageLevel: logLevel,
}).listen();
