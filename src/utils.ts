
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
    if (error instanceof Error) {
      log({ type: "runCommand error", error });
      return { output: "", error: error.message };
    } else {
      return { output: "", error: "unknonw error" };
    }
  }
}

export async function installNpm(npmName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    runCommand("npm", ["install", "-g", npmName]).then(({ output, error }) => {
      if (error) {
        return reject(error);
      } else {
        return resolve(output);
      }
    });
  });
}

export async function installGem(gemName: string | string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = ["install"];
    if (Array.isArray(gemName)) {
      options.push(...gemName);
    } else {
      options.push(gemName);
    }
    runCommand("gem", options).then(({ output, error }) => {
      if (error) {
        return reject(error);
      } else {
        return resolve(output);
      }
    });
  });
}

export async function syncJavascriptSnippets(): Promise<string> {
  return new Promise((resolve, reject) => {
    runCommand("synvert-javascript", ["--sync"]).then(({ output, error }) => {
      if (error) {
        return reject(error);
      } else {
        return resolve(output);
      }
    });
  });
}

export async function syncRubySnippets(): Promise<string> {
  return new Promise((resolve, reject) => {
    runCommand("synvert-ruby", ["--sync"]).then(({ output, error }) => {
      if (error) {
        return reject(error);
      } else {
        return resolve(output);
      }
    });
  });
}
