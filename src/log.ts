import * as vscode from "vscode";

const synvertLog = vscode.window.createOutputChannel("Synvert");

export function log(text: string): void {
  synvertLog.appendLine(text);
}