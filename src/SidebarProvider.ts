import fs from "fs";
import path from "path";
import { machineIdSync } from 'node-machine-id';
import * as vscode from "vscode";
import { parseJSON, runRubyCommand } from "./utils";
import type { SearchResults, TestResultExtExt } from "./types";
import { LocalStorageService } from "./localStorageService";
import { typescriptEnabled, javascriptEnabled, rubyEnabled, rubyNumberOfWorkers, javascriptMaxFileSize, typescriptMaxFileSize } from "./configuration";

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
        case "onReplaceAll": {
          data.results.forEach((result: TestResultExtExt) => {
            const absolutePath = path.join(result.rootPath!, result.filePath);
            let source = result.fileSource!;
            result.actions.reverse().forEach(action => {
              source = source.slice(0, action.start) + action.newCode + source.slice(action.end);
            });
            fs.writeFileSync(absolutePath, source);
          });
          webviewView.webview.postMessage({ type: 'doneReplaceAll', errorMessage: "" });
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
          const offset = action.newCode.length - (action.end - action.start);
          webviewView.webview.postMessage({ type: 'doneReplaceAction', resultIndex, actionIndex, offset, source });
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
        case "typewscript":
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
    const commandArgs = ["--execute", "test"];
    if (onlyPaths.length > 0) {
      commandArgs.push("--onlyPaths");
      commandArgs.push(onlyPaths);
    }
    if (skipPaths.length > 0) {
      commandArgs.push("--skipPaths");
      commandArgs.push(skipPaths);
    }
    commandArgs.push("--maxFileSize");
    commandArgs.push(String(javascriptMaxFileSize() * 1024));
    commandArgs.push("--rootPath");
    commandArgs.push(rootPath);
    runRubyCommand("synvert-javascript", commandArgs, snippet).then(({ stdout, stderr }) => {
      if (stderr.length === 0) {
        const snippets = parseJSON(stdout);
        addFileSourceToSnippets(snippets, rootPath);
        return resolve({ results: snippets, errorMessage: "" });
      } else {
        return resolve({ results: [], errorMessage: stderr });
      }
    });
  });
}

function testTypescriptSnippet(snippet: string, rootPath: string, onlyPaths: string, skipPaths: string): Promise<SearchResults> {
  return new Promise((resolve) => {
    if (!typescriptEnabled()) {
      return resolve({ results: [], errorMessage: "Synvert typescript is not enabled!" });
    }
    const commandArgs = ["--execute", "test"];
    if (onlyPaths.length > 0) {
      commandArgs.push("--onlyPaths");
      commandArgs.push(onlyPaths);
    }
    if (skipPaths.length > 0) {
      commandArgs.push("--skipPaths");
      commandArgs.push(skipPaths);
    }
    commandArgs.push("--maxFileSize");
    commandArgs.push(String(typescriptMaxFileSize() * 1024));
    commandArgs.push("--rootPath");
    commandArgs.push(rootPath);
    runRubyCommand("synvert-javascript", commandArgs, snippet).then(({ stdout, stderr }) => {
      if (stderr.length === 0) {
        const snippets = parseJSON(stdout);
        addFileSourceToSnippets(snippets, rootPath);
        return resolve({ results: snippets, errorMessage: "" });
      } else {
        return resolve({ results: [], errorMessage: stderr });
      }
    });
  });
}

function testRubySnippet(snippet: string, rootPath: string, onlyPaths: string, skipPaths: string): Promise<SearchResults> {
  return new Promise((resolve) => {
    if (!rubyEnabled()) {
      return resolve({ results: [], errorMessage: "Synvert ruby is not enabled!" });
    }
    const commandArgs = ['--execute', 'test'];
    if (onlyPaths.length > 0) {
      commandArgs.push('--only-paths');
      commandArgs.push(onlyPaths);
    }
    if (skipPaths.length > 0) {
      commandArgs.push('--skip-paths');
      commandArgs.push(skipPaths);
    }
    if (rubyNumberOfWorkers() > 1) {
      commandArgs.push('--number-of-workers');
      commandArgs.push(String(rubyNumberOfWorkers()));
    }
    commandArgs.push(rootPath);
    runRubyCommand("synvert-ruby", commandArgs, snippet).then(({ stdout, stderr }) => {
      if (stderr.length === 0) {
        const snippets = parseJSON(stdout);
        addFileSourceToSnippets(snippets, rootPath);
        return resolve({ results: snippets, errorMessage: "" });
      } else {
        return resolve({ results: [], errorMessage: stderr });
      }
    });
  });
}

function addFileSourceToSnippets(snippets: TestResultExtExt[], rootPath: string): void {
  snippets.forEach((snippet) => {
    const fileSource = fs.readFileSync(path.join(rootPath, snippet.filePath), "utf-8");
    snippet.fileSource = fileSource;
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
    const commandArgs = ["--execute", "run"];
    if (onlyPaths.length > 0) {
      commandArgs.push('--onlyPaths');
      commandArgs.push(onlyPaths);
    }
    if (skipPaths.length > 0) {
      commandArgs.push('--skipPaths');
      commandArgs.push(skipPaths);
    }
    commandArgs.push("--maxFileSize");
    commandArgs.push(String(javascriptMaxFileSize() * 1024));
    commandArgs.push("--rootPath");
    commandArgs.push(rootPath);
    runRubyCommand('synvert-javascript', commandArgs, snippet).then(({ stdout, stderr }) => {
      if (stderr.length === 0) {
        return resolve({ errorMessage: "" });
      } else {
        return resolve({ errorMessage: stderr });
      }
    });
  });
}

function processTypescriptSnippet(snippet: string, rootPath: string, onlyPaths: string, skipPaths: string): Promise<{ errorMessage: string }> {
  return new Promise((resolve) => {
    if (!javascriptEnabled()) {
      return resolve({ errorMessage: "Synvert typescript is not enabled!" });
    }
    const commandArgs = ["--execute", "run"];
    if (onlyPaths.length > 0) {
      commandArgs.push('--onlyPaths');
      commandArgs.push(onlyPaths);
    }
    if (skipPaths.length > 0) {
      commandArgs.push('--skipPaths');
      commandArgs.push(skipPaths);
    }
    commandArgs.push("--maxFileSize");
    commandArgs.push(String(typescriptMaxFileSize() * 1024));
    commandArgs.push("--rootPath");
    commandArgs.push(rootPath);
    runRubyCommand('synvert-javascript', commandArgs, snippet).then(({ stdout, stderr }) => {
      if (stderr.length === 0) {
        return resolve({ errorMessage: "" });
      } else {
        return resolve({ errorMessage: stderr });
      }
    });
  });
}

function processRubySnippet(snippet: string, rootPath: string, onlyPaths: string, skipPaths: string): Promise<{ errorMessage: string }> {
  return new Promise((resolve) => {
    if (!rubyEnabled()) {
      return resolve({ errorMessage: "Synvert ruby is not enabled!" });
    }
    const commandArgs = ['--execute', 'run'];
    if (onlyPaths.length > 0) {
      commandArgs.push('--only-paths');
      commandArgs.push(onlyPaths);
    }
    if (skipPaths.length > 0) {
      commandArgs.push('--skip-paths');
      commandArgs.push(skipPaths);
    }
    commandArgs.push(rootPath);
    runRubyCommand("synvert-ruby", commandArgs, snippet).then(({ stdout, stderr }) => {
      if (stderr.length === 0) {
        return resolve({ errorMessage: "" });
      } else {
        return resolve({ errorMessage: stderr });
      }
    });
  });
}

const formatSnippet = (snippet: string): string => {
  const input = snippet.replace(/const Synvert = require\(['"]synvert-core['"]\);?/, "").trim();
  if (input.includes("new Synvert.Rewriter(")) {
    return input;
  }
  if (input.includes("withinFile")) {
    return `
      new Synvert.Rewriter("group", "name", () => {
        configure({ parser: 'typescript' });
        ${snippet}
      });
    `;
  }

  return `
    new Synvert.Rewriter("group", "name", () => {
      configure({ parser: 'typescript' });
      withinFiles(Synvert.ALL_FILES, function () {
        ${snippet}
      });
    });
  `;
};
