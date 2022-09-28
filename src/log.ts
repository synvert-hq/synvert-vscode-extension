import * as vscode from "vscode";

const synvertLog = vscode.window.createOutputChannel("Synvert");

export function log(text: any): void {
  synvertLog.appendLine(String(text));
}