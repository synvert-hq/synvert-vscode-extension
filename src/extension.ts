// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { SidebarProvider } from './SidebarProvider';
import { LocalStorageService } from './localStorageService';
import { javascriptEnabled, javascriptBinPath, rubyEnabled, rubyBinPath, typescriptEnabled, cssEnabled, lessEnabled, sassEnabled, scssEnabled } from './configuration';
import { log } from './log';
import { runCommand, showErrorMessage, showInformationMessage } from './utils';
import { DependencyResponse, checkRubyDependencies, checkJavascriptDependencies, installGem, installNpm } from '@synvert-hq/synvert-ui-common';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

  log('Congratulations, your extension "synvert" is now active!');

  const storageService = new LocalStorageService(context.workspaceState);
  const sidebarProvider = new SidebarProvider(context.extensionUri, storageService);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "synvert-sidebar",
      sidebarProvider
    )
  );

  const currentlyOpenTabFilePath = vscode.window.activeTextEditor?.document.fileName;
  if (currentlyOpenTabFilePath) {
    sidebarProvider._view?.webview.postMessage({ type: "currentFileExtensionName", value: currentlyOpenTabFilePath.split('.').pop() });
  }

  try {
    Promise.all(
      [checkRuby, checkJavascript].map(async (fn) => {
        await fn();
      })
    );
  } catch (error) {
    if (error instanceof Error) {
      log(error.message);
    } else {
      log(String(error));
    }
  }
}

// this method is called when your extension is deactivated
export function deactivate() {}

async function checkRuby() {
  if (!rubyEnabled()) {
    return;
  }

  const binPath = rubyBinPath();
  const response = await checkRubyDependencies({ runCommand, binPath });
  switch (response.code) {
    case DependencyResponse.ERROR:
      showErrorMessage(`Error when checking synvert-ruby environment: ${response.error}`);
      break;
    case DependencyResponse.RUBY_NOT_AVAILABLE:
      showErrorMessage('ruby is not available');
      break;
    case DependencyResponse.SYNVERT_NOT_AVAILABLE:
      showInstallSynvertRubyErrorMessage();
      break;
    case DependencyResponse.SYNVERT_OUTDATED:
      showUpdateSynvertRubyErrorMessage(response.remoteSynvertVersion!, response.localSynvertVersion!);
      break;
    case DependencyResponse.SYNVERT_CORE_OUTDATED:
      showUpdateSynvertCoreRubyErrorMessage(response.remoteSynvertCoreVersion!, response.localSynvertCoreVersion!);
      break;
  }
}

async function checkJavascript() {
  if (!javascriptEnabled() && !typescriptEnabled() && !cssEnabled() && !lessEnabled() && !sassEnabled() && !scssEnabled()) {
    return;
  }

  const binPath = javascriptBinPath();
  const response = await checkJavascriptDependencies({ runCommand, binPath });
  switch (response.code) {
    case DependencyResponse.ERROR:
      showErrorMessage(`Error when checking synvert-javascript environment: ${response.error}`);
      break;
    case DependencyResponse.JAVASCRIPT_NOT_AVAILABLE:
      showErrorMessage('javascript (node) is not available');
      break;
    case DependencyResponse.SYNVERT_NOT_AVAILABLE:
      showInstallSynvertJavascriptErrorMessage();
      break;
    case DependencyResponse.SYNVERT_OUTDATED:
      showUpdateSynvertJavascriptErrorMessage(response.remoteSynvertVersion!, response.localSynvertVersion!);
      break;
  }
}

async function showInstallSynvertJavascriptErrorMessage() {
  const binPath = javascriptBinPath();
  const item = await showErrorMessage('synvert npm not found. Run `npm install -g synvert`.', 'Install Now');
  if (item === 'Install Now') {
    const { stderr } = await installNpm({ runCommand, npmName: 'synvert', binPath });
    if (stderr) {
      showErrorMessage(`Failed to install the synvert npm. ${stderr}`);
    } else {
      showInformationMessage('Successfully installed the synvert npm.');
    }
  }
}

async function showUpdateSynvertJavascriptErrorMessage(remoteSynvertVersion: string, localSynvertVersion: string) {
  const binPath = javascriptBinPath();
  const item = await showErrorMessage(`synvert npm version ${remoteSynvertVersion} is available. (Current version: ${localSynvertVersion})`, 'Update Now');
  if (item === 'Update Now') {
    const { stderr } = await installNpm({ runCommand, npmName: 'synvert', binPath });
    if (stderr) {
      showErrorMessage(`Failed to update the synvert npm. ${stderr}`);
    } else {
      showInformationMessage('Successfully updated the synvert npm.');
    }
  }
}

async function showInstallSynvertRubyErrorMessage() {
  const binPath = rubyBinPath();
  const item = await showErrorMessage('synvert gem not found. Run `gem install synvert` or update your Gemfile.', 'Install Now');
  if (item === 'Install Now') {
    const { stderr } = await installGem({ runCommand, gemName: 'synvert', binPath });
    if (stderr) {
      showErrorMessage(`Failed to install the synvert gem. ${stderr}`);
    } else {
      showInformationMessage('Successfully installed the synvert gem.');
    }
  }
}

async function showUpdateSynvertRubyErrorMessage(remoteSynvertVersion: string, localSynvertVersion: string) {
  const binPath = rubyBinPath();
  const item = await showErrorMessage(`synvert gem version ${remoteSynvertVersion} is available. (Current version: ${localSynvertVersion})`, 'Update Now');
  if (item === 'Update Now') {
    const { stderr } = await installGem({ runCommand, gemName: 'synvert', binPath });
    if (stderr) {
      showErrorMessage(`Failed to update the synvert gem. ${stderr}`);
    } else {
      showInformationMessage('Successfully updated the synvert gem.');
    }
  }
}

async function showUpdateSynvertCoreRubyErrorMessage(remoteSynvertCoreVersion: string, localSynvertCoreVersion: string) {
  const binPath = rubyBinPath();
  const item = await showErrorMessage(`synvert-core gem version ${remoteSynvertCoreVersion} is available. (Current version: ${localSynvertCoreVersion})`, 'Update Now');
  if (item === 'Update Now') {
    const { stderr } = await installGem({ runCommand, gemName: 'synvert-core', binPath });
    if (stderr) {
      showErrorMessage(`Failed to update the synvert-core gem. ${stderr}`);
    } else {
      showInformationMessage('Successfully updated the synvert-core gem.');
    }
  }
}