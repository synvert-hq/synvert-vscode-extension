// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import fetch from "node-fetch";
import { compareVersions } from 'compare-versions';

import { SidebarProvider } from './SidebarProvider';
import { LocalStorageService } from './localStorageService';
import { javascriptEnabled, rubyEnabled, typescriptEnabled } from './configuration';
import { log } from './log';
import { runCommand, installGem, installNpm, showErrorMessage, showInformationMessage } from './utils';

const VERSION_REGEXP = /(\d+\.\d+\.\d+) \(with synvert-core (\d+\.\d+\.\d+)/;

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

    const currentlyOpenTabfilePath = vscode.window.activeTextEditor?.document.fileName;
    if (currentlyOpenTabfilePath) {
        sidebarProvider._view?.webview.postMessage({ type: "currentFileExtensionName", value: currentlyOpenTabfilePath.split('.').pop() });
    }

  if (rubyEnabled()) {
    try {
      const output = await checkGem();
      const result = output.match(VERSION_REGEXP);
      if (result) {
        const localSynvertVersion = result[1];
        const localSynvertCoreVersion = result[2];
        const data = await checkGemRemoteVersions();
        const remoteSynvertVersion = data.synvertVersion;
        const remoteSynvertCoreVersion = data.synvertCoreVersion;
        log({ ruby: { remoteSynvertVersion, remoteSynvertCoreVersion } });
        if (compareVersions(remoteSynvertVersion, localSynvertVersion) === 1) {
          const item = await showErrorMessage(`synvert gem version ${remoteSynvertVersion} is available. (Current version: ${localSynvertVersion})`, 'Update Now');
          if (item === 'Update Now') {
            await installGem('synvert');
            showInformationMessage('Successfully updated the synvert gem.');
          }
        }
        if (compareVersions(remoteSynvertCoreVersion, localSynvertCoreVersion) === 1) {
          const item = await showErrorMessage(`synvert-core gem version ${remoteSynvertCoreVersion} is available. (Current version: ${localSynvertCoreVersion})`, 'Update Now');
          if (item === 'Update Now') {
            await installGem('synvert-core');
            showInformationMessage('Successfully updated the synvert-core gem.');
          }
        }
      }
    } catch (error) {
      const item = await showErrorMessage('synvert gem not found. Run `gem install synvert` or update your Gemfile.', 'Install Now');
      if (item === 'Install Now') {
        await installGem('synvert');
        showInformationMessage('Successfully installed the synvert gem.');
      }
    }
  }

  if (javascriptEnabled() || typescriptEnabled()) {
    try {
      const output = await checkNpm();
      const result = output.match(VERSION_REGEXP);
      if (result) {
        const localSynvertVersion = result[1];
        // const localSynvertCoreVersion = result[2];
        const data = await checkNpmRemoteVersions();
        const remoteSynvertVersion = data.synvertVersion;
        // const remoteSynvertCoreVersion = data.synvertCoreVersion;
        log({ javascript: { remoteSynvertVersion } });
        if (compareVersions(remoteSynvertVersion, localSynvertVersion) === 1) {
          const item = await showErrorMessage(`synvert npm version ${remoteSynvertVersion} is available. (Current version: ${localSynvertVersion})`, 'Update Now');
          if (item === 'Update Now') {
            await installNpm('synvert');
            showInformationMessage('Successfully updated the synvert npm.');
          }
        }
        // if (compareVersions(remoteSynvertCoreVersion, localSynvertCoreVersion) === 1) {
        //   const item = await showErrorMessage(`synvert-core npm version ${remoteSynvertCoreVersion} is available. (Current version: ${localSynvertCoreVersion})`, 'Update Now');
        //   if (item === 'Update Now') {
        //     await installNpm('synvert-core');
        //     showInformationMessage('Successfully updated the synvert-core npm.');
        //   }
        // }
      }
    } catch (error) {
      const item = await showErrorMessage('synvert npm not found. Run `npm install -g synvert`.', 'Install Now');
      if (item === 'Install Now') {
        await installNpm('synvert');
        showInformationMessage('Successfully installed the synvert npm.');
      }
    }
  }
}

// this method is called when your extension is deactivated
export function deactivate() {}

function checkNpm(): Promise<string> {
  return new Promise((resolve, reject) => {
    runCommand("synvert-javascript", ["-v"]).then(({ output, error }) => {
      if (error) {
        return reject(error);
      } else {
        return resolve(output);
      }
    });
  });
}

function checkNpmRemoteVersions(): Promise<{ synvertVersion: string, synvertCoreVersion: string }> {
  const url = "https://api-javascript.synvert.net/check-versions";
  return fetch(url).then(response => response.json()).then((data: any) => ({
    synvertVersion: data.synvert_version, synvertCoreVersion: data.synvert_core_version
  }));
}

function checkGem(): Promise<string> {
  return new Promise((resolve, reject) => {
    runCommand("synvert-ruby", ["-v"]).then(({ output, error }) => {
      if (error) {
        return reject(error);
      } else {
        return resolve(output);
      }
    });
  });
}

function checkGemRemoteVersions(): Promise<{ synvertVersion: string, synvertCoreVersion: string }> {
  const url = "https://api-ruby.synvert.net/check-versions";
  return fetch(url).then(response => response.json()).then((data: any) => ({
    synvertVersion: data.synvert_version, synvertCoreVersion: data.synvert_core_version
  }));
}