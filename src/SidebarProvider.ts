import fs from "fs";
import path from "path";
import { machineIdSync } from 'node-machine-id';
import * as vscode from "vscode";
import { parseJSON} from "synvert-ui-common";
import type { SearchResults, TestResultExtExt } from "./types";
import { installNpm, installGem, syncJavascriptSnippets, syncRubySnippets, runCommand, showInformationMessage, showErrorMessage } from "./utils";
import { LocalStorageService } from "./localStorageService";
import {
  rubyEnabled,
  rubyNumberOfWorkers,
  rubySingleQuote,
  rubyTabWidth,
  javascriptEnabled,
  javascriptMaxFileSize,
  javascriptSingleQuote,
  javascriptSemi,
  javascriptTabWidth,
  typescriptEnabled,
  typescriptMaxFileSize,
  typescriptSingleQuote,
  typescriptSemi,
  typescriptTabWidth,
} from "./configuration";

export class SidebarProvider implements vscode.WebviewViewProvider {
  _view?: vscode.WebviewView;
  _doc?: vscode.TextDocument;

  constructor(private readonly _extensionUri: vscode.Uri, private readonly _storageService: LocalStorageService) { }

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
        case "onMount": {
          if (this._storageService.getValue("data")) {
            webviewView.webview.postMessage({ ...this._storageService.getValue("data"), type: "loadData" });
          }
          break;
        }
        case "afterUpdate": {
          this._storageService.setValue("data", data);
          break;
        }
        case "updateDependencies": {
          updateDependencies(data.language).then(({ errorMessage }) => {
            if (errorMessage.length === 0) {
              showInformationMessage(`Successfully updated ${data.language} dependencies.`);
            } else {
              vscode.window.showErrorMessage(errorMessage);
            }
            webviewView.webview.postMessage({ type: 'doneUpdateDependencies' });
          });
          break;
        }
        case "onSearch": {
          if (!data.snippet) {
            return;
          }
          testSnippet(data.language, data.snippet, data.onlyPaths, data.skipPaths).then((data) => {
            webviewView.webview.postMessage({ type: 'doneSearch', ...data });
          });
          break;
        }
        case "onDirectReplaceAll": {
          if (!data.snippet) {
            return;
          }
          processSnippet(data.language, data.snippet, data.onlyPaths, data.skipPaths).then((data) => {
            webviewView.webview.postMessage({ type: 'doneReplaceAll', ...data });
          });
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
              const endLineToGo = doc.getText().substring(0, data.action.end).trimEnd().split("\n").length;
              let endRange = activeEditor.document.lineAt(endLineToGo - 1).range;
              activeEditor.selection = new vscode.Selection(startRange.start, endRange.end);
              activeEditor.revealRange(startRange);
            });
          });
          break;
        }
        case "onReplaceAll": {
          data.results.forEach((result: TestResultExtExt) => {
            const absolutePath = path.join(result.rootPath!, result.filePath);
            if (result.actions.length === 1 && result.actions[0].type === "add_file") {
              fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
              fs.writeFileSync(absolutePath, result.actions[0].newCode!);
            } else if (result.actions.length === 1 && result.actions[0].type === "remove_file") {
              fs.unlinkSync(absolutePath);
            } else {
              let source = result.fileSource!;
              result.actions.reverse().forEach(action => {
                if (action.type === 'group') {
                  (action.actions!).reverse().forEach(childAction => {
                    source = source.slice(0, childAction.start) + childAction.newCode + source.slice(childAction.end);
                  });
                } else {
                  source = source.slice(0, action.start) + action.newCode + source.slice(action.end);
                }
              });
              fs.writeFileSync(absolutePath, source);
            }
          });
          webviewView.webview.postMessage({ type: 'doneReplaceAll', errorMessage: "" });
          break;
        }
        case "onReplaceResult": {
          const { resultIndex, result, rootPath, filePath } = data;
          const absolutePath = path.join(rootPath!, filePath);
          if (result.actions.length === 1 && result.actions[0].type === "add_file") {
            fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
            fs.writeFileSync(absolutePath, result.actions[0].newCode!);
          } else if (result.actions.length === 1 && result.actions[0].type === "remove_file") {
            fs.unlinkSync(absolutePath);
          } else {
            let source = fs.readFileSync(absolutePath, "utf-8");
            (result as TestResultExtExt).actions.reverse().forEach(action => {
              if (action.type === 'group') {
                (action.actions!).reverse().forEach(childAction => {
                  source = source.slice(0, childAction.start) + childAction.newCode + source.slice(childAction.end);
                });
              } else {
                source = source.slice(0, action.start) + action.newCode + source.slice(action.end);
              }
            });
            fs.writeFileSync(absolutePath, source);
          }
          webviewView.webview.postMessage({ type: 'doneReplaceResult', resultIndex });
          break;
        }
        case "onReplaceAction": {
          const { resultIndex, actionIndex, action, rootPath, filePath } = data;
          const absolutePath = path.join(rootPath!, filePath);
          if (action.type === "add_file") {
            const dirPath = path.dirname(absolutePath);
            fs.mkdirSync(dirPath, { recursive: true });
            fs.writeFileSync(absolutePath, action.newCode);
            webviewView.webview.postMessage({ type: 'doneReplaceAction', resultIndex, actionIndex });
          } else if (action.type === "remove_file") {
            fs.unlinkSync(absolutePath);
            webviewView.webview.postMessage({ type: 'doneReplaceAction', resultIndex, actionIndex });
          } else {
            let source = fs.readFileSync(absolutePath, "utf-8");
            let offset = 0;
            if (action.type === 'group') {
              action.actions.reverse().forEach((childAction: any) => {
                source = source.slice(0, childAction.start) + childAction.newCode + source.slice(childAction.end);
                offset += childAction.newCode.length - (childAction.end - childAction.start);
              });
            } else {
              source = source.slice(0, action.start) + action.newCode + source.slice(action.end);
              offset = action.newCode.length - (action.end - action.start);
            }
            fs.writeFileSync(absolutePath, source);
            webviewView.webview.postMessage({ type: 'doneReplaceAction', resultIndex, actionIndex, offset, source });
          }
          break;
        }
        case "onInfo": {
          if (!data.value) {
            return;
          }
          showInformationMessage(data.value);
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
      vscode.Uri.file(path.join(this._extensionUri.path, "media", "reset.css"))
    );
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this._extensionUri.path, "media", "vscode.css"))
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this._extensionUri.path, "out", "compiled/sidebar.js"))
    );
    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this._extensionUri.path, "out", "compiled/sidebar.css"))
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
              const rubyEnabled = ${rubyEnabled()};
              const javascriptEnabled = ${javascriptEnabled()};
              const typescriptEnabled = ${typescriptEnabled()};
          </script>

        </head>
        <body>
          <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function testSnippet(language: string, snippet: string, onlyPaths: string, skipPaths: string): Promise<SearchResults> {
  if (vscode.workspace.workspaceFolders) {
    for (const folder of vscode.workspace.workspaceFolders) {
      const rootPath = folder.uri.path;
      switch (language) {
        case "ruby":
          return testRubySnippet(snippet, rootPath, onlyPaths, skipPaths);
        case "javascript":
          return testJavascriptSnippet(snippet, rootPath, onlyPaths, skipPaths);
        case "typescript":
          return testTypescriptSnippet(snippet, rootPath, onlyPaths, skipPaths);
      }
    }
  }
  return Promise.resolve({ results: [], errorMessage: "" });
}

function testJavascriptSnippet(snippet: string, rootPath: string, onlyPaths: string, skipPaths: string): Promise<SearchResults> {
  return new Promise((resolve) => {
    if (!javascriptEnabled()) {
      return resolve({ results: [], errorMessage: "Synvert javascript is not enabled!" });
    }
    const commandArgs = buildJavascriptCommandArgs("test", rootPath, onlyPaths, skipPaths);
    runCommand("synvert-javascript", commandArgs, { input: snippet }).then(({ output, error }) => {
      return handleTestResult(output, error, rootPath, resolve);
    });
  });
}

function testTypescriptSnippet(snippet: string, rootPath: string, onlyPaths: string, skipPaths: string): Promise<SearchResults> {
  return new Promise((resolve) => {
    if (!typescriptEnabled()) {
      return resolve({ results: [], errorMessage: "Synvert typescript is not enabled!" });
    }
    const commandArgs = buildTypescriptCommandArgs("test", rootPath, onlyPaths, skipPaths);
    runCommand("synvert-javascript", commandArgs, { input: snippet }).then(({ output, error }) => {
      return handleTestResult(output, error, rootPath, resolve);
    });
  });
}

function testRubySnippet(snippet: string, rootPath: string, onlyPaths: string, skipPaths: string): Promise<SearchResults> {
  return new Promise((resolve) => {
    if (!rubyEnabled()) {
      return resolve({ results: [], errorMessage: "Synvert ruby is not enabled!" });
    }
    const commandArgs = buildRubyCommandArgs("test", rootPath, onlyPaths, skipPaths);
    runCommand("synvert-ruby", commandArgs, { input: snippet }).then(({ output, error }) => {
      return handleTestResult(output, error, rootPath, resolve);
    });
  });
}

function addFileSourceToSnippets(snippets: TestResultExtExt[], rootPath: string): void {
  snippets.forEach((snippet) => {
    const absolutePath = path.join(rootPath, snippet.filePath);
    if (fs.existsSync(absolutePath)) {
      const fileSource = fs.readFileSync(absolutePath, "utf-8");
      snippet.fileSource = fileSource;
    }
    snippet.rootPath = rootPath;
  });
}

function processSnippet(language: string, snippet: string, onlyPaths: string, skipPaths: string): Promise<{ errorMessage: string }> {
  if (vscode.workspace.workspaceFolders) {
    for (const folder of vscode.workspace.workspaceFolders) {
      const rootPath = folder.uri.path;
      switch (language) {
        case "ruby":
          return processRubySnippet(snippet, rootPath, onlyPaths, skipPaths);
        case "javascript":
          return processJavascriptSnippet(snippet, rootPath, onlyPaths, skipPaths);
        case "typescript":
          return processTypescriptSnippet(snippet, rootPath, onlyPaths, skipPaths);
      }
    }
  }
  return Promise.resolve({ errorMessage: "" });
}

function processJavascriptSnippet(snippet: string, rootPath: string, onlyPaths: string, skipPaths: string): Promise<{ errorMessage: string }> {
  return new Promise((resolve) => {
    if (!javascriptEnabled()) {
      return resolve({ errorMessage: "Synvert javascript is not enabled!" });
    }
    const commandArgs = buildJavascriptCommandArgs("run", rootPath, onlyPaths, skipPaths);
    runCommand('synvert-javascript', commandArgs, { input: snippet }).then(({ output, error }) => {
      return handleProcessResult(error, resolve);
    });
  });
}

function processTypescriptSnippet(snippet: string, rootPath: string, onlyPaths: string, skipPaths: string): Promise<{ errorMessage: string }> {
  return new Promise((resolve) => {
    if (!javascriptEnabled()) {
      return resolve({ errorMessage: "Synvert typescript is not enabled!" });
    }
    const commandArgs = buildTypescriptCommandArgs("run", rootPath, onlyPaths, skipPaths);
    runCommand('synvert-javascript', commandArgs, { input: snippet }).then(({ output, error }) => {
      return handleProcessResult(error, resolve);
    });
  });
}

function processRubySnippet(snippet: string, rootPath: string, onlyPaths: string, skipPaths: string): Promise<{ errorMessage: string }> {
  return new Promise((resolve) => {
    if (!rubyEnabled()) {
      return resolve({ errorMessage: "Synvert ruby is not enabled!" });
    }
    const commandArgs = buildRubyCommandArgs("run", rootPath, onlyPaths, skipPaths);
    runCommand("synvert-ruby", commandArgs, { input: snippet }).then(({ output, error }) => {
      return handleProcessResult(error, resolve);
    });
  });
}

function updateDependencies(language: string): Promise<{ errorMessage: string }> {
  if (language === "ruby") {
    return updateRubyDependencies();
  } else {
    return updateJavascriptDependencies();
  }
}

function updateJavascriptDependencies(): Promise<{ errorMessage: string }> {
  return new Promise((resolve, reject) => {
    installNpm("synvert").then(() => {
      syncJavascriptSnippets().then(() => {
        return resolve({ errorMessage: "" });
      }).catch((error) => {
        return resolve({ errorMessage: error });
      });
    }).catch((error) => {
      return resolve({ errorMessage: error });
    });
  });
}

function updateRubyDependencies(): Promise<{ errorMessage: string }> {
  return new Promise((resolve, reject) => {
    installGem(["synvert", "synvert-core", "node_query", "node_mutation", "parser_node_ext", "syntax_tree_ext"]).then(() => {
      syncRubySnippets().then(() => {
        return resolve({ errorMessage: "" });
      }).catch((error) => {
        return resolve({ errorMessage: error });
      });
    }).catch((error) => {
      return resolve({ errorMessage: error });
    });
  });
}

function buildRubyCommandArgs(executeCommand: string, rootPath: string, onlyPaths: string, skipPaths: string): string[] {
  const commandArgs = ['--execute', executeCommand];
  if (onlyPaths.length > 0) {
    commandArgs.push('--only-paths');
    commandArgs.push(onlyPaths);
  }
  if (skipPaths.length > 0) {
    commandArgs.push('--skip-paths');
    commandArgs.push(skipPaths);
  }
  if (executeCommand === 'test' && rubyNumberOfWorkers() > 1) {
    commandArgs.push('--number-of-workers');
    commandArgs.push(String(rubyNumberOfWorkers()));
  }
  if (!rubySingleQuote()) {
    commandArgs.push('--double-quote');
  }
  commandArgs.push('--tab-width');
  commandArgs.push(String(rubyTabWidth()));
  commandArgs.push(rootPath);
  return commandArgs;
}

function buildJavascriptCommandArgs(executeCommand: string, rootPath: string, onlyPaths: string, skipPaths: string): string[] {
  const commandArgs = ["--execute", executeCommand];
  if (onlyPaths.length > 0) {
    commandArgs.push("--only-paths");
    commandArgs.push(onlyPaths);
  }
  if (skipPaths.length > 0) {
    commandArgs.push("--skip-paths");
    commandArgs.push(skipPaths);
  }
  commandArgs.push("--max-file-size");
  commandArgs.push(String(javascriptMaxFileSize() * 1024));
  if (javascriptSingleQuote()) {
    commandArgs.push("--single-quote");
  }
  if (!javascriptSemi()) {
    commandArgs.push("--no-semi");
  }
  commandArgs.push("--tab-width");
  commandArgs.push(String(javascriptTabWidth()));
  commandArgs.push("--root-path");
  commandArgs.push(rootPath);
  return commandArgs;
}

function buildTypescriptCommandArgs(executeCommand: string, rootPath: string, onlyPaths: string, skipPaths: string): string[] {
  const commandArgs = ["--execute", executeCommand];
  if (onlyPaths.length > 0) {
    commandArgs.push("--only-paths");
    commandArgs.push(onlyPaths);
  }
  if (skipPaths.length > 0) {
    commandArgs.push("--skip-paths");
    commandArgs.push(skipPaths);
  }
  commandArgs.push("--max-file-size");
  commandArgs.push(String(typescriptMaxFileSize() * 1024));
  if (typescriptSingleQuote()) {
    commandArgs.push("--single-quote");
  }
  if (!typescriptSemi()) {
    commandArgs.push("--no-semi");
  }
  commandArgs.push("--tab-width");
  commandArgs.push(String(typescriptTabWidth()));
  commandArgs.push("--root-path");
  commandArgs.push(rootPath);
  return commandArgs;
}

function handleTestResult(output: string, error: string | undefined, rootPath: string, resolve: any): void {
  if (error) {
    return resolve({ results: [], errorMessage: error });
  }
  try {
    const result = parseJSON(output);
    if (result.error) {
      return resolve({ results: [], errorMessage: result.error });
    }
    addFileSourceToSnippets(result, rootPath);
    return resolve({ results: result, errorMessage: "" });
  } catch (e) {
    return resolve({ results: [], errorMessage: (e as Error).message });
  }
}

function handleProcessResult(error: string | undefined, resolve: any): void {
  if (error) {
    return resolve({ errorMessage: error });
  } else {
    return resolve({ errorMessage: "" });
  }
}