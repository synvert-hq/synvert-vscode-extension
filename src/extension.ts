// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import fetch from "node-fetch";
import { compareVersions } from 'compare-versions';
import { SidebarProvider } from './SidebarProvider';
import { LocalStorageService } from './localStorageService';
import { rubyEnabled } from './configuration';
import { log } from './log';
import { runRubyCommand } from './utils';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

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
    checkGem().then((output) => {
      const result = output.match(/(\d+\.\d+\.\d+) \(with synvert-core (\d+\.\d+\.\d+)/);
      if (result) {
        const localSynvertVersion = result[1];
        const localSynvertCoreVersion = result[2];
        checkRemoteVersions().then((data) => {
          const remoteSynvertVersion = data.synvertVersion;
          const remoteSynvertCoreVersion = data.synvertCoreVersion;
          if (compareVersions(remoteSynvertVersion, localSynvertVersion) === 1) {
            vscode.window.showErrorMessage(`synvert gem version is ${remoteSynvertVersion} available. (Current version: ${localSynvertVersion})`, 'Update Now').then((item) => {
              if (item === 'Update Now') {
                installGem('synvert').then(() => {
                  vscode.window.showInformationMessage('Successfully updated the synvert gem.');
                }).catch(() => {
                  vscode.window.showErrorMessage('Failed to update the synvert gem.');
                });
              }
            });
          }
          if (compareVersions(remoteSynvertCoreVersion, localSynvertCoreVersion) === 1) {
            vscode.window.showErrorMessage(`synvert-core gem version is ${remoteSynvertCoreVersion} available. (Current version: ${localSynvertCoreVersion})`, 'Update Now').then((item) => {
              if (item === 'Update Now') {
                installGem('synvert-core').then(() => {
                  vscode.window.showInformationMessage('Successfully updated the synvert-core gem.');
                }).catch(() => {
                  vscode.window.showErrorMessage('Failed to update the synvert gem.');
                });
              }
            });
          }
        });
      }
    }).catch(() => {
      vscode.window.showErrorMessage('synvert gem not found. Run `gem install synvert` or update your Gemfile.', 'Install Now').then((item) => {
        if (item === 'Install Now') {
          installGem('synvert').then(() => {
            vscode.window.showInformationMessage('Successfully installed the synvert gem.');
          }).catch(() => {
            vscode.window.showErrorMessage('Failed to install the synvert gem.');
          });
        }
      });
    });
  }

  // checkNpm().catch(() => {
  //   vscode.window.showErrorMessage('Synvert npm not found. Run `npm install synvert` or update your package.json.', 'Install Now').then((item) => {
  //     if (item === 'Install Now') {
  //       installNpm().then(() => {
  //         vscode.window.showInformationMessage('Successfully installed the Synvert npm.');
  //       }).catch(() => {
  //         vscode.window.showErrorMessage('Failed to install the Synvert npm.');
  //       });
  //     }
  //   });
  // });
}

// this method is called when your extension is deactivated
export function deactivate() {}

function checkNpm(): Promise<string> {
  return new Promise((resolve, reject) => {
    runRubyCommand("synvert-javascript", ["-v"]).then(({ stdout, stderr }) => {
      if (stderr.length === 0) {
        return resolve(stdout);
      } else {
        return reject(stderr);
      }
    });
  });
}

function installNpm(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    runRubyCommand("npm", ["install", "-g", "synvert"]).then(({ stderr }) => {
      if (stderr.length === 0) {
        return resolve(true);
      } else {
        return resolve(false);
      }
    });
  });
}

function checkGem(): Promise<string> {
  return new Promise((resolve, reject) => {
    runRubyCommand("synvert-ruby", ["-v"]).then(({ stdout, stderr }) => {
      if (stderr.length === 0) {
        return resolve(stdout);
      } else {
        return reject(stderr);
      }
    });
  });
}

function checkRemoteVersions(): Promise<{ synvertVersion: string, synvertCoreVersion: string }> {
  const url = "https://api-ruby.synvert.net/check-versions";
  return fetch(url).then(response => response.json()).then((data: any) => ({
    synvertVersion: data.synvert_version, synvertCoreVersion: data.synvert_core_version
  }));
}

function installGem(gemName: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    runRubyCommand("gem", ["install", gemName]).then(({ stderr }) => {
      if (stderr.length === 0) {
        return resolve(true);
      } else {
        return resolve(false);
      }
    });
  });
}
