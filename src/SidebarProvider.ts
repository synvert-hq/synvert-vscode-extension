import { join } from "path";
import { machineIdSync } from 'node-machine-id';
import * as vscode from "vscode";
import * as Synvert from "synvert-core";
import { getLastSnippetGroupAndName } from "./utils";
import fs from "fs";
import path from "path";
import type { TestResultExtExt } from "./types";
import { log } from "./log";

export class SidebarProvider implements vscode.WebviewViewProvider {
  _view?: vscode.WebviewView;
  _doc?: vscode.TextDocument;

  constructor(private readonly _extensionUri: vscode.Uri) { }

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,

      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Listen for messages from the Sidebar component and execute action
    webviewView.webview.onDidReceiveMessage((data) => {
      switch (data.type) {
        case "onSearch": {
          if (!data.snippet) {
            return;
          }
          const results = testSnippet(data.snippet, data.onlyPaths, data.skipPaths);
          webviewView.webview.postMessage({ type: 'doneSearch', results });
          break;
        }
        case "onDirectReplaceAll": {
          if (!data.snippet) {
            return;
          }
          processSnippet(data.snippet, data.onlyPaths, data.skipPaths);
          webviewView.webview.postMessage({ type: 'doneReplaceAll' });
          break;
        }
        case "onReplaceAll": {
          data.results.forEach((result: TestResultExtExt) => {
            const absolutePath = path.join(result.rootPath!, result.filePath);
            let source = result.fileSource!;
            result.actions.reverse().forEach(action => {
              source = source.slice(0, action.start) + action.newCode + source.slice(action.end);
            });
            fs.writeFileSync(absolutePath, source);
          });
          webviewView.webview.postMessage({ type: 'doneReplaceAll' });
          break;
        }
        case "onOpenFile": {
          var openPath = vscode.Uri.parse(path.join(data.rootPath, data.filePath));
          vscode.workspace.openTextDocument(openPath).then(doc => {
            vscode.window.showTextDocument(doc).then(() => {
              const activeEditor = vscode.window.activeTextEditor;
              if (!activeEditor) {
                return;
              }

              const startLineToGo = doc.getText().substring(0, data.action.start).split("\n").length;
              let startRange = activeEditor.document.lineAt(startLineToGo - 1).range;
              const endLineToGo = doc.getText().substring(0, data.action.end).split("\n").length;
              let endRange = activeEditor.document.lineAt(endLineToGo - 1).range;
              activeEditor.selection =  new vscode.Selection(startRange.start, endRange.end);
              activeEditor.revealRange(startRange);
            });
          });
          break;
        }
        case "onReplaceResult": {
          const { resultIndex, result, rootPath, filePath } = data;
          const absolutePath = path.join(rootPath!, filePath);
          let source = fs.readFileSync(absolutePath, "utf-8");
          (result as TestResultExtExt).actions.reverse().forEach(action => {
            source = source.slice(0, action.start) + action.newCode + source.slice(action.end);
          });
          fs.writeFileSync(absolutePath, source);
          webviewView.webview.postMessage({ type: 'doneReplaceResult', resultIndex });
          break;
        }
        case "onReplaceAction": {
          const { resultIndex, actionIndex, action, rootPath, filePath } = data;
          const absolutePath = path.join(rootPath!, filePath);
          let source = fs.readFileSync(absolutePath, "utf-8");
          source = source.slice(0, action.start) + action.newCode + source.slice(action.end);
          fs.writeFileSync(absolutePath, source);
          webviewView.webview.postMessage({ type: 'doneReplaceAction', resultIndex, actionIndex });
          break;
        }
        case "onInfo": {
          if (!data.value) {
            return;
          }
          vscode.window.showInformationMessage(data.value);
          break;
        }
        case "onError": {
          if (!data.value) {
            return;
          }
          vscode.window.showErrorMessage(data.value);
          break;
        }
      }
    });

  }

  public revive(panel: vscode.WebviewView) {
    this._view = panel;
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.file(join(this._extensionUri.path, "media", "reset.css"))
    );
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.file(join(this._extensionUri.path, "media", "vscode.css"))
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.file(join(this._extensionUri.path, "out", "compiled/sidebar.js"))
    );
    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.file(join(this._extensionUri.path, "out", "compiled/sidebar.css"))
    );

    // Use a nonce to only allow a specific script to be run.
    const nonce = getNonce();
    const token = machineIdSync(true);

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <!--
            Use a content security policy to only allow loading images from https or from our extension directory,
            and only allow scripts that have a specific nonce.
          -->
          <meta http-equiv="Content-Security-Policy" content="img-src https: data:; style-src 'unsafe-inline' ${webview.cspSource}; script-src 'nonce-${nonce}';">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="${styleResetUri}" rel="stylesheet">
          <link href="${styleVSCodeUri}" rel="stylesheet">
          <link href="${styleMainUri}" rel="stylesheet">
          <script nonce="${nonce}">
              const tsvscode = acquireVsCodeApi();
              const token = "${token}";
          </script>

        </head>
        <body>
          <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function testSnippet(snippet: string, onlyPaths: string, skipPaths: string): object[] {
  let results: TestResultExtExt[] = [];
  try {
    if (vscode.workspace.workspaceFolders) {
      for (const folder of vscode.workspace.workspaceFolders) {
        Synvert.Configuration.rootPath = folder.uri.path;
        Synvert.Configuration.onlyPaths = onlyPaths.split(",").map((onlyFile) => onlyFile.trim());
        Synvert.Configuration.skipPaths = skipPaths.split(",").map((skipFile) => skipFile.trim());
        eval(formatSnippet(snippet));
        const [group, name] = getLastSnippetGroupAndName();
        const rewriter = Synvert.Rewriter.fetch(group, name);
        const testResults: TestResultExtExt[] = rewriter.test();
        testResults.forEach((result) => {
          const fileSource = fs.readFileSync(path.join(folder.uri.path, result.filePath), "utf-8");
          result.fileSource = fileSource;
          result.rootPath = folder.uri.path;
        });

        results = [...results, ...testResults];
      }
    }
  } catch (e) {
    // @ts-ignore
    vscode.window.showErrorMessage(`Failed to run synvert: ${e.message}`);
  }
  return results;
}

function processSnippet(snippet: string, onlyPaths: string, skipPaths: string): void {
  try {
    if (vscode.workspace.workspaceFolders) {
      for (const folder of vscode.workspace.workspaceFolders) {
        Synvert.Configuration.rootPath = folder.uri.path;
        Synvert.Configuration.onlyPaths = onlyPaths.split(",").map((onlyFile) => onlyFile.trim());
        Synvert.Configuration.skipPaths = skipPaths.split(",").map((skipFile) => skipFile.trim());
        eval(formatSnippet(snippet));
        const [group, name] = getLastSnippetGroupAndName();
        const rewriter = Synvert.Rewriter.fetch(group, name);
        rewriter.process();
      }
    }
  } catch (e) {
    // @ts-ignore
    vscode.window.showErrorMessage(`Failed to run synvert: ${e.message}`);
  }
}

function formatSnippet(snippet: string) {
  return snippet.replace(/const Synvert = require\(['"]synvert-core['"]\);?/, "");
}