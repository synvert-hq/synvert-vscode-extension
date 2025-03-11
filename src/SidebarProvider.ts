import { promises as fs } from "fs";
import path from "path";
import { machineIdSync } from 'node-machine-id';
import * as vscode from "vscode";
import { runSynvertRuby, runSynvertJavascript, installNpm, installGem, syncJavascriptSnippets, syncRubySnippets, replaceAllTestResults, replaceTestResult, replaceTestAction, removeTestResult, removeTestAction, handleTestResults } from "@synvert-hq/synvert-ui-common";
import type { SearchResults } from "./types";
import { runCommand, showInformationMessage, showErrorMessage } from "./utils";
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
  cssEnabled,
  cssMaxFileSize,
  lessEnabled,
  lessMaxFileSize,
  sassEnabled,
  sassMaxFileSize,
  scssEnabled,
  scssMaxFileSize,
  languageEnabled,
  rubyBinPath,
  javascriptBinPath,
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
    webviewView.webview.onDidReceiveMessage(async (data) => {
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
          const { errorMessage } = await updateDependencies(data.language);
          if (errorMessage.length === 0) {
            showInformationMessage(`Successfully updated ${data.language} dependencies.`);
          } else {
            showErrorMessage(`Failed to update ${data.language} dependencies: ${errorMessage}`);
          }
          webviewView.webview.postMessage({ type: 'doneUpdateDependencies' });
          break;
        }
        case "onSearch": {
          if (!data.snippet) {
            return;
          }
          const results = await testSnippet(data.language, data.snippet, data.onlyPaths, data.skipPaths, data.respectGitignore);
          webviewView.webview.postMessage({ type: 'doneSearch', ...results });
          break;
        }
        case "onDirectReplaceAll": {
          if (!data.snippet) {
            return;
          }
          const results = await processSnippet(data.language, data.snippet, data.onlyPaths, data.skipPaths, data.respectGitignore);
          webviewView.webview.postMessage({ type: 'doneReplaceAll', ...results });
          break;
        }
        case "onOpenFile": {
          var openPath = vscode.Uri.parse(path.join(data.rootPath, data.filePath));
          const doc = await vscode.workspace.openTextDocument(openPath);
          const activeEditor = await vscode.window.showTextDocument(doc);
          const startLineToGo = doc.getText().substring(0, data.action.start).split("\n").length;
          let startRange = activeEditor.document.lineAt(startLineToGo - 1).range;
          const endLineToGo = doc.getText().substring(0, data.action.end).trimEnd().split("\n").length;
          let endRange = activeEditor.document.lineAt(endLineToGo - 1).range;
          activeEditor.selection = new vscode.Selection(startRange.start, endRange.end);
          activeEditor.revealRange(startRange);
          break;
        }
        case "onReplaceAll": {
          const { results } = data;
          const newResults = await replaceAllTestResults(results, path, fs);
          webviewView.webview.postMessage({ type: 'doneReplaceAll', errorMessage: "" });
          break;
        }
        case "onReplaceResult": {
          const { results, resultIndex } = data;
          const newResults = await replaceTestResult(results, resultIndex, path, fs);
          webviewView.webview.postMessage({ type: 'doneReplaceResult', results: newResults, resultIndex });
          break;
        }
        case "onReplaceAction": {
          const { results, resultIndex, actionIndex } = data;
          const newResults = await replaceTestAction(results, resultIndex, actionIndex, path, fs);
          webviewView.webview.postMessage({ type: 'doneReplaceAction', results: newResults, resultIndex, actionIndex });
          break;
        }
        case "onRemoveResult": {
          const { results, resultIndex } = data;
          const newResults = await removeTestResult(results, resultIndex);
          webviewView.webview.postMessage({ type: 'doneRemoveResult', results: newResults, resultIndex });
          break;
        }
        case "onRemoveAction": {
          const { results, resultIndex, actionIndex } = data;
          const newResults = await removeTestAction(results, resultIndex, actionIndex);
          webviewView.webview.postMessage({ type: 'doneRemoveAction', results: newResults, resultIndex, actionIndex });
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
          showErrorMessage(data.value);
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
              const cssEnabled = ${cssEnabled()};
              const lessEnabled = ${lessEnabled()};
              const sassEnabled = ${sassEnabled()};
              const scssEnabled = ${scssEnabled()};
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

async function testSnippet(language: string, snippetCode: string, onlyPaths: string, skipPaths: string, respectGitignore: boolean): Promise<SearchResults> {
  if (vscode.workspace.workspaceFolders) {
    for (const folder of vscode.workspace.workspaceFolders) {
      const rootPath = folder.uri.path;
      if (!languageEnabled(language)) {
        return { results: [], errorMessage: `Synvert ${language} is not enabled!` };
      }
      const additionalArgs = buildAdditionalCommandArgs(language);
      const synvertCommand = language === "ruby" ? runSynvertRuby : runSynvertJavascript;
      const binPath = language === "ruby" ? rubyBinPath() : javascriptBinPath();
      const { stdout, stderr } = await synvertCommand({
        runCommand,
        executeCommand: "test",
        rootPath,
        onlyPaths,
        skipPaths,
        respectGitignore,
        additionalArgs,
        snippetCode,
        binPath,
      });
      return await handleTestResults(stdout, stderr, rootPath, path, fs);
    }
  }
  return { results: [], errorMessage: "" };
}

async function processSnippet(language: string, snippetCode: string, onlyPaths: string, skipPaths: string, respectGitignore: boolean): Promise<{ errorMessage: string }> {
  if (vscode.workspace.workspaceFolders) {
    for (const folder of vscode.workspace.workspaceFolders) {
      const rootPath = folder.uri.path;
      if (!languageEnabled(language)) {
        return { errorMessage: `Synvert ${language} is not enabled!` };
      }
      const additionalArgs = buildAdditionalCommandArgs(language);
      const synvertCommand = language === "ruby" ? runSynvertRuby : runSynvertJavascript;
      const binPath = language === "ruby" ? rubyBinPath() : javascriptBinPath();
      const { stderr } = await synvertCommand({
        runCommand,
        executeCommand: "run",
        rootPath,
        onlyPaths,
        skipPaths,
        respectGitignore,
        additionalArgs,
        snippetCode,
        binPath,
      });
      return { errorMessage: stderr || "" };
    }
  }
  return { errorMessage: "" };
}

async function updateDependencies(language: string): Promise<{ errorMessage: string }> {
  if (language === "ruby") {
    return await updateRubyDependencies();
  } else {
    return await updateJavascriptDependencies();
  }
}

async function updateJavascriptDependencies(): Promise<{ errorMessage: string }> {
  const binPath = javascriptBinPath();
  const { stderr: installError } = await installNpm({ runCommand, npmName: "@synvert-hq/synvert", binPath });
  if (installError) {
    return { errorMessage: `Failed to update the synvert npm. ${installError}` };
  }
  const { stderr: syncError } = await syncJavascriptSnippets({ runCommand, binPath });
  if (syncError) {
    return { errorMessage: `Failed to sync the synvert javascript snippets. ${syncError}` };
  }
  return { errorMessage: "" };
}

async function updateRubyDependencies(): Promise<{ errorMessage: string }> {
  const binPath = rubyBinPath();
  const { stderr: installError } = await installGem({ runCommand, gemName: ["synvert", "synvert-core", "node_query", "node_mutation", "parser_node_ext", "syntax_tree_ext", "prism_ext"], binPath });
  if (installError) {
    return { errorMessage: `Failed to update the synvert gem. ${installError}` };
  }
  const { stderr: syncError } = await syncRubySnippets({ runCommand, binPath });
  if (syncError) {
    return { errorMessage: `Failed to sync the synvert ruby snippets. ${syncError}` };
  }
  return { errorMessage: "" };
}

function buildAdditionalCommandArgs(language: string): string[] {
  const additionalCommandArgs: string[] = [];
  switch (language) {
    case "ruby":
      additionalCommandArgs.push("--number-of-workers", String(rubyNumberOfWorkers()), "--tab-width", String(rubyTabWidth()));
      if (!rubySingleQuote()) {
        additionalCommandArgs.push("--double-quote");
      }
      break;
    case "javascript":
      additionalCommandArgs.push("--max-file-size", String(javascriptMaxFileSize() * 1024), "--tab-width", String(javascriptTabWidth()));
      if (javascriptSingleQuote()) {
        additionalCommandArgs.push("--single-quote");
      }
      if (!javascriptSemi()) {
        additionalCommandArgs.push("--no-semi");
      }
      break;
    case "typescript":
      additionalCommandArgs.push("--max-file-size", String(typescriptMaxFileSize() * 1024), "--tab-width", String(typescriptTabWidth()));
      if (typescriptSingleQuote()) {
        additionalCommandArgs.push("--single-quote");
      }
      if (!typescriptSemi()) {
        additionalCommandArgs.push("--no-semi");
      }
      break;
    case "css":
      additionalCommandArgs.push("--max-file-size", String(cssMaxFileSize() * 1024));
      break;
    case "less":
      additionalCommandArgs.push("--max-file-size", String(lessMaxFileSize() * 1024));
      break;
    case "sass":
      additionalCommandArgs.push("--max-file-size", String(sassMaxFileSize() * 1024));
      break;
    case "scss":
      additionalCommandArgs.push("--max-file-size", String(scssMaxFileSize() * 1024));
      break;
  }
  return additionalCommandArgs;
}
