import { promises as fs } from "fs";
import path from "path";
import { machineIdSync } from 'node-machine-id';
import * as vscode from "vscode";
import { parseJSON, runSynvertRuby, runSynvertJavascript, replaceTestResult, replaceTestAction } from "synvert-ui-common";
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
          const results = await testSnippet(data.language, data.snippet, data.onlyPaths, data.skipPaths);
          webviewView.webview.postMessage({ type: 'doneSearch', ...results });
          break;
        }
        case "onDirectReplaceAll": {
          if (!data.snippet) {
            return;
          }
          const results = await processSnippet(data.language, data.snippet, data.onlyPaths, data.skipPaths);
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
          for (const result of data.results) {
            const absolutePath = path.join(result.rootPath!, result.filePath);
            if (result.actions.length === 1 && result.actions[0].type === "add_file") {
              await fs.mkdir(path.dirname(absolutePath), { recursive: true });
              await fs.writeFile(absolutePath, result.actions[0].newCode!);
            } else if (result.actions.length === 1 && result.actions[0].type === "remove_file") {
              await fs.unlink(absolutePath);
            } else {
              const source = result.fileSource!;
              const newSource = replaceTestResult(result, source);
              await fs.writeFile(absolutePath, newSource);
            }
          }
          webviewView.webview.postMessage({ type: 'doneReplaceAll', errorMessage: "" });
          break;
        }
        case "onReplaceResult": {
          const { results, resultIndex } = data;
          const result = results[resultIndex];
          const absolutePath = path.join(result.rootPath!, result.filePath);
          if (result.actions.length === 1 && result.actions[0].type === "add_file") {
            await fs.mkdir(path.dirname(absolutePath), { recursive: true });
            await fs.writeFile(absolutePath, result.actions[0].newCode!);
          } else if (result.actions.length === 1 && result.actions[0].type === "remove_file") {
            await fs.unlink(absolutePath);
          } else {
            const source = await fs.readFile(absolutePath, "utf-8");
            const newSource = replaceTestResult(result, source);
            await fs.writeFile(absolutePath, newSource);
          }
          results.splice(resultIndex, 1);
          webviewView.webview.postMessage({ type: 'doneReplaceResult', results });
          break;
        }
        case "onReplaceAction": {
          const { results, resultIndex, actionIndex } = data;
          const result = results[resultIndex];
          const action = result.actions[actionIndex];
          const absolutePath = path.join(result.rootPath!, result.filePath);
          if (action.type === "add_file") {
            const dirPath = path.dirname(absolutePath);
            await fs.mkdir(dirPath, { recursive: true });
            await fs.writeFile(absolutePath, action.newCode);
            results.splice(resultIndex, 1);
            webviewView.webview.postMessage({ type: 'doneReplaceAction', resultIndex, actionIndex });
          } else if (action.type === "remove_file") {
            await fs.unlink(absolutePath);
            results.splice(resultIndex, 1);
            webviewView.webview.postMessage({ type: 'doneReplaceAction', resultIndex, actionIndex });
          } else {
            const source = await fs.readFile(absolutePath, "utf-8");
            const newSource = replaceTestAction(result, action, source);
            await fs.writeFile(absolutePath, newSource);
            result.actions.splice(actionIndex, 1);
            if (result.actions.length === 0) {
              results.splice(resultIndex, 1);
            }
            webviewView.webview.postMessage({ type: 'doneReplaceAction', results, resultIndex, actionIndex });
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

async function testSnippet(language: string, snippet: string, onlyPaths: string, skipPaths: string): Promise<SearchResults> {
  if (vscode.workspace.workspaceFolders) {
    for (const folder of vscode.workspace.workspaceFolders) {
      const rootPath = folder.uri.path;
      switch (language) {
        case "ruby":
          return await testRubySnippet(snippet, rootPath, onlyPaths, skipPaths);
        case "javascript":
          return await testJavascriptSnippet(snippet, rootPath, onlyPaths, skipPaths);
        case "typescript":
          return await testTypescriptSnippet(snippet, rootPath, onlyPaths, skipPaths);
      }
    }
  }
  return { results: [], errorMessage: "" };
}

async function testJavascriptSnippet(snippet: string, rootPath: string, onlyPaths: string, skipPaths: string): Promise<SearchResults> {
  if (!javascriptEnabled()) {
    return { results: [], errorMessage: "Synvert javascript is not enabled!" };
  }
  const additionalCommandArgs = buildJavascriptAdditionalCommandArgs();
  const { output, error } = await runSynvertJavascript(runCommand, "test", rootPath, onlyPaths, skipPaths, additionalCommandArgs, snippet);
  return await handleTestResult(output, error, rootPath);
}

async function testTypescriptSnippet(snippet: string, rootPath: string, onlyPaths: string, skipPaths: string): Promise<SearchResults> {
  if (!typescriptEnabled()) {
    return { results: [], errorMessage: "Synvert typescript is not enabled!" };
  }
  const additionalCommandArgs = buildTypescriptAdditionalCommandArgs();
  const { output, error } = await runSynvertJavascript(runCommand, "test", rootPath, onlyPaths, skipPaths, additionalCommandArgs, snippet);
  return await handleTestResult(output, error, rootPath);
}

async function testRubySnippet(snippet: string, rootPath: string, onlyPaths: string, skipPaths: string): Promise<SearchResults> {
  if (!rubyEnabled()) {
    return { results: [], errorMessage: "Synvert ruby is not enabled!" };
  }
  const additionalCommandArgs = buildRubyAdditionalCommandArgs();
  const { output, error } = await runSynvertRuby(runCommand, "test", rootPath, onlyPaths, skipPaths, additionalCommandArgs, snippet);
  return await handleTestResult(output, error, rootPath);
}

async function addFileSourceToSnippets(snippets: TestResultExtExt[], rootPath: string) {
  for (const snippet of snippets) {
    const absolutePath = path.join(rootPath, snippet.filePath);
    if (!!(await fs.stat(absolutePath).catch(e => false))) {
      const fileSource = await fs.readFile(absolutePath, "utf-8");
      snippet.fileSource = fileSource;
    }
    snippet.rootPath = rootPath;
  }
}

async function processSnippet(language: string, snippet: string, onlyPaths: string, skipPaths: string): Promise<{ errorMessage: string }> {
  if (vscode.workspace.workspaceFolders) {
    for (const folder of vscode.workspace.workspaceFolders) {
      const rootPath = folder.uri.path;
      switch (language) {
        case "ruby":
          return await processRubySnippet(snippet, rootPath, onlyPaths, skipPaths);
        case "javascript":
          return await processJavascriptSnippet(snippet, rootPath, onlyPaths, skipPaths);
        case "typescript":
          return await processTypescriptSnippet(snippet, rootPath, onlyPaths, skipPaths);
      }
    }
  }
  return { errorMessage: "" };
}

async function processJavascriptSnippet(snippet: string, rootPath: string, onlyPaths: string, skipPaths: string): Promise<{ errorMessage: string }> {
  if (!javascriptEnabled()) {
    return { errorMessage: "Synvert javascript is not enabled!" };
  }
  const additionalCommandArgs = buildJavascriptAdditionalCommandArgs();
  const { error } = await runSynvertJavascript(runCommand, "run", rootPath, onlyPaths, skipPaths, additionalCommandArgs, snippet);
  return { errorMessage: error || "" };
}

async function processTypescriptSnippet(snippet: string, rootPath: string, onlyPaths: string, skipPaths: string): Promise<{ errorMessage: string }> {
  if (!javascriptEnabled()) {
    return { errorMessage: "Synvert typescript is not enabled!" };
  }
  const additionalCommandArgs = buildTypescriptAdditionalCommandArgs();
  const { error } = await runSynvertJavascript(runCommand, "run", rootPath, onlyPaths, skipPaths, additionalCommandArgs, snippet);
  return { errorMessage: error || "" };
}

async function processRubySnippet(snippet: string, rootPath: string, onlyPaths: string, skipPaths: string): Promise<{ errorMessage: string }> {
  if (!rubyEnabled()) {
    return { errorMessage: "Synvert ruby is not enabled!" };
  }
  const additionalCommandArgs = buildRubyAdditionalCommandArgs();
  const { error } = await runSynvertRuby(runCommand, "run", rootPath, onlyPaths, skipPaths, additionalCommandArgs, snippet);
  return { errorMessage: error || "" };
}

async function updateDependencies(language: string): Promise<{ errorMessage: string }> {
  if (language === "ruby") {
    return await updateRubyDependencies();
  } else {
    return await updateJavascriptDependencies();
  }
}

async function updateJavascriptDependencies(): Promise<{ errorMessage: string }> {
  try {
    await installNpm("synvert");
    await syncJavascriptSnippets();
    return { errorMessage: "" };
  } catch(error) {
    if (error instanceof Error) {
      return { errorMessage: error.message };
    }
    return { errorMessage: String(error) };
  }
}

async function updateRubyDependencies(): Promise<{ errorMessage: string }> {
  try {
    await installGem(["synvert", "synvert-core", "node_query", "node_mutation", "parser_node_ext", "syntax_tree_ext"]);
    await syncRubySnippets();
    return { errorMessage: "" };
  } catch(error) {
    if (error instanceof Error) {
      return { errorMessage: error.message };
    }
    return { errorMessage: String(error) };
  }
}

function buildRubyAdditionalCommandArgs(): string[] {
  const additionalCommandArgs: string[] = ["--number-of-workers", String(rubyNumberOfWorkers()), "--tab-width", String(rubyTabWidth())];
  if (!rubySingleQuote()) {
    additionalCommandArgs.push("--double-quote");
  }
  return additionalCommandArgs;
}

function buildJavascriptAdditionalCommandArgs(): string[] {
  const additionalCommandArgs: string[] = ["--max-file-size", String(javascriptMaxFileSize() * 1024), "--tab-width", String(javascriptTabWidth())];
  if (javascriptSingleQuote()) {
    additionalCommandArgs.push("--single-quote");
  }
  if (!javascriptSemi()) {
    additionalCommandArgs.push("--no-semi");
  }
  return additionalCommandArgs;
}

function buildTypescriptAdditionalCommandArgs(): string[] {
  const additionalCommandArgs: string[] = ["--max-file-size", String(typescriptMaxFileSize() * 1024), "--tab-width", String(typescriptTabWidth())];
  if (typescriptSingleQuote()) {
    additionalCommandArgs.push("--single-quote");
  }
  if (!typescriptSemi()) {
    additionalCommandArgs.push("--no-semi");
  }
  return additionalCommandArgs;
}

async function handleTestResult(output: string, error: string | undefined, rootPath: string): Promise<SearchResults> {
  if (error) {
    return { results: [], errorMessage: error };
  }
  try {
    const results = parseJSON(output);
    if (results.error) {
      return { results: [], errorMessage: results.error };
    }
    await addFileSourceToSnippets(results, rootPath);
    return { results, errorMessage: "" };
  } catch (e) {
    return { results: [], errorMessage: (e as Error).message };
  }
}