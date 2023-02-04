
import { runShellCommand } from 'synvert-server-common';
import { formatCommandResult } from 'synvert-ui-common';

import { log } from './log';

export async function runCommand(command: string, args: string[], { input }: { input?: string } = {}): Promise<{ output: string, error?: string }> {
  try {
    log({ type: "runCommand", command: [command].concat(args).join(" ") });
    const { stdout, stderr } = await runShellCommand(command, args, input);
    log({ type: "runCommand", stdout, stderr });
    return formatCommandResult({ stdout, stderr });
  } catch (error) {
    if (error instanceof Error) {
      log({ type: "runCommand error", error });
      return { output: "", error: error.message };
    } else {
      return { output: "", error: "unknonw error" };
    }
  }
}
