
import { runShellCommand } from '@synvert-hq/synvert-server-common';
import * as vscode from "vscode";

import { log } from './log';

export function showErrorMessage(message: string, ...items: string[]) {
  return vscode.window.showErrorMessage(`Synvert: ${message}`, ...items);
}

export function showInformationMessage(message: string, ...items: string[]) {
  return vscode.window.showInformationMessage(`Synvert: ${message}`, ...items);
}

export async function runCommand(command: string, args: string[], { input }: { input?: string } = {}): Promise<{ stdout: string, stderr?: string }> {
  try {
    log({ type: "runCommand", command: [command].concat(args).join(" ") });
    const { stdout, stderr } = await runShellCommand(command, args, input);
    log({ type: "runCommand", stdout, stderr });
    return { stdout, stderr };
  } catch (error) {
    log({ type: "runCommand error", error });
    if (error instanceof Error) {
      return { stdout: "", stderr: error.message };
    } else {
      return { stdout: "", stderr: "unknown error" };
    }
  }
}
