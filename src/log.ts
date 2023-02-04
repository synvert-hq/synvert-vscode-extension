import * as vscode from "vscode";

const synvertLog = vscode.window.createOutputChannel("Synvert");

export function log(text: any): void {
  if (typeof text === "object") {
    synvertLog.appendLine(JSON.stringify(text));
  } else {
    synvertLog.appendLine(String(text));
  }
}