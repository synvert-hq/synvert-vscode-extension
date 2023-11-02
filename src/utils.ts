
import { runShellCommand } from 'synvert-server-common';
import { formatCommandResult } from 'synvert-ui-common';
import * as vscode from "vscode";

import { log } from './log';

export function showErrorMessage(message: string, ...items: string[]) {
  return vscode.window.showErrorMessage(`Synvert: ${message}`, ...items);
}

export function showInformationMessage(message: string, ...items: string[]) {
  return vscode.window.showInformationMessage(`Synvert: ${message}`, ...items);
}

export async function runCommand(command: string, args: string[], { input }: { input?: string } = {}): Promise<{ output: string, error?: string }> {
  try {
    log({ type: "runCommand", command: [command].concat(args).join(" ") });
    const { stdout, stderr } = await runShellCommand(command, args, input);
    log({ type: "runCommand", stdout, stderr });
    return formatCommandResult({ stdout, stderr });
  } catch (error) {
    log({ type: "runCommand error", error });
    if (error instanceof Error) {
      return { output: "", error: error.message };
    } else {
      return { output: "", error: "unknonw error" };
    }
  }
}
export async function installNpm(npmName: string): Promise<string> {
  const { output, error } = await runCommand("npm", ["install", "-g", npmName]);
  if (error) {
    throw error;
  } else {
    return output;
  }
}

export async function installGem(gemName: string | string[]): Promise<string> {
  const options = ["install"];
  if (Array.isArray(gemName)) {
    options.push(...gemName);
  } else {
    options.push(gemName);
  }
  const { output, error } = await runCommand("gem", options);
  if (error) {
    throw error;
  } else {
    return output;
  }
}

export async function syncJavascriptSnippets(): Promise<string> {
  const { output, error } = await runCommand("synvert-javascript", ["--sync"]);
  if (error) {
    throw error;
  } else {
    return output;
  }
}

export async function syncRubySnippets(): Promise<string> {
  const { output, error } = await runCommand("synvert-ruby", ["--sync"]);
  if (error) {
    throw error;
  } else {
    return output;
  }
}
