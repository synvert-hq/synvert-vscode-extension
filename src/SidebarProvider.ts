import { join } from "path";
import { machineIdSync } from 'node-machine-id';
import { rubySpawn } from 'ruby-spawn';
import * as vscode from "vscode";
import * as Synvert from "synvert-core";
import { getLastSnippetGroupAndName, parseJSON } from "./utils";
import fs from "fs";
import path from "path";
import type { TestResultExtExt } from "./types";
import { LocalStorageService } from "./localStorageService";
import { rubyEnabled } from "./configuration";

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
          testSnippet(data.extension, data.snippet, data.onlyPaths, data.skipPaths).then((results) => {
            webviewView.webview.postMessage({ type: 'doneSearch', results });
          });
          break;
        }
        case "onDirectReplaceAll": {
          if (!data.snippet) {
            return;
          }
          processSnippet(data.extension, data.snippet, data.onlyPaths, data.skipPath).then(() => {
            webviewView.webview.postMessage({ type: 'doneReplaceAll' });
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
              const rubyEnabled = ${rubyEnabled()};
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

function testSnippet(extension: string, snippet: string, onlyPaths: string, skipPaths: string): Promise<object[]> {
  try {
    if (vscode.workspace.workspaceFolders) {
      for (const folder of vscode.workspace.workspaceFolders) {
        const rootPath = folder.uri.path;
        if (extension === "rb") {
          return testRubySnippet(snippet, rootPath, onlyPaths, skipPaths);
        } else {
          return testJavascriptSnippet(snippet, rootPath, onlyPaths, skipPaths);
        }
      }
    }
    return Promise.resolve([]);
  } catch (e) {
    // @ts-ignore
    vscode.window.showErrorMessage(`Failed to run synvert: ${e.message}`);
    return Promise.resolve([]);
  }
}

function testJavascriptSnippet(snippet: string, rootPath: string, onlyPaths: string, skipPaths: string): Promise<object[]> {
  Synvert.Configuration.rootPath = rootPath;
  Synvert.Configuration.onlyPaths = onlyPaths.split(",").map((onlyFile) => onlyFile.trim());
  Synvert.Configuration.skipPaths = skipPaths.split(",").map((skipFile) => skipFile.trim());
  evalSnippet(snippet);
  const [group, name] = getLastSnippetGroupAndName();
  const rewriter = Synvert.Rewriter.fetch(group, name);
  const snippets: TestResultExtExt[] = rewriter.test();
  addFileSourceToSnippets(snippets, rootPath);
  return Promise.resolve(snippets);
}

function testRubySnippet(snippet: string, rootPath: string, onlyPaths: string, skipPaths: string): Promise<object[]> {
  return new Promise((resolve, reject) => {
    if (!rubyEnabled()) {
      vscode.window.showErrorMessage('Synvert ruby is not enabled!');
      return resolve([]);
    }
    const commandArgs = ['--execute', 'test'];
    if (onlyPaths.length > 0) {
      commandArgs.push('--only-paths');
      commandArgs.push(onlyPaths);
    }
    if (skipPaths.length > 0) {
      commandArgs.push('--skip-paths');
      commandArgs.push('"' + skipPaths + '"');
    }
    commandArgs.push(rootPath);
    const child = rubySpawn('synvert-ruby', commandArgs, { encoding: 'utf8' }, true);
    // const child = rubySpawn('synvert-ruby', ['-v'], {}, true);
    if (child.stdin) {
      child.stdin.write(snippet);
      child.stdin.end();
    }
    let output = '';
    if (child.stdout) {
      child.stdout.on('data', data => {
        output += data;
      });
    }
    let error = "";
    if (child.stderr) {
      child.stderr.on('data', data => {
        error += data;
      });
    }
    child.on('exit', (code) => {
      if (code === 0) {
        const snippets = parseJSON(output);
        addFileSourceToSnippets(snippets, rootPath);
        return resolve(snippets);
      } else {
        vscode.window.showErrorMessage(`Failed to run synvert: ${error}`);
        return resolve([]);
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

function processSnippet(extension: string, snippet: string, onlyPaths: string, skipPaths: string): Promise<boolean> {
  try {
    if (vscode.workspace.workspaceFolders) {
      for (const folder of vscode.workspace.workspaceFolders) {
        const rootPath = folder.uri.path;
        if (extension === "rb") {
          return processRubySnippet(snippet, rootPath, onlyPaths, skipPaths);
        } else {
          return processJavascriptSnippet(snippet, rootPath, onlyPaths, skipPaths);
        }
      }
    }
    return Promise.resolve(true);
  } catch (e) {
    // @ts-ignore
    vscode.window.showErrorMessage(`Failed to run synvert: ${e.message}`);
    return Promise.resolve(false);
  }
}

function processJavascriptSnippet(snippet: string, rootPath: string, onlyPaths: string, skipPaths: string): Promise<boolean> {
  Synvert.Configuration.rootPath = rootPath;
  Synvert.Configuration.onlyPaths = onlyPaths.split(",").map((onlyFile) => onlyFile.trim());
  Synvert.Configuration.skipPaths = skipPaths.split(",").map((skipFile) => skipFile.trim());
  evalSnippet(snippet);
  const [group, name] = getLastSnippetGroupAndName();
  const rewriter = Synvert.Rewriter.fetch(group, name);
  return new Promise((resolve, reject) => {
    rewriter.process();
    resolve(true);
  });
}

function processRubySnippet(snippet: string, rootPath: string, onlyPaths: string, skipPaths: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (!rubyEnabled()) {
      vscode.window.showErrorMessage('Synvert ruby is not enabled!');
      return resolve(true);
    }
    const commandArgs = ['--execute', 'run'];
    if (onlyPaths.length > 0) {
      commandArgs.push('--only-paths');
      commandArgs.push(onlyPaths);
    }
    if (skipPaths.length > 0) {
      commandArgs.push('--skip-paths');
      commandArgs.push('"' + skipPaths + '"');
    }
    commandArgs.push(rootPath);
    const child = rubySpawn('synvert-ruby', commandArgs, { encoding: 'utf8' }, true);
    if (child.stdin) {
      child.stdin.write(snippet);
      child.stdin.end();
    }
    let error = "";
    if (child.stderr) {
      child.stderr.on("data", (data) => {
        error += data;
      });
    }
    child.on('exit', (code) => {
      if (code === 0) {
        return resolve(true);
      } else {
        vscode.window.showErrorMessage(`Failed to run synvert: ${error}`);
        return resolve(false);
      }
    });
  });
}

function evalSnippet(snippet: string) {
  // avoid group nam duplication.
  Synvert.Rewriter.clear();
  eval(formatSnippet(snippet));
}

function formatSnippet(snippet: string) {
  return snippet.replace(/const Synvert = require\(['"]synvert-core['"]\);?/, "");
}