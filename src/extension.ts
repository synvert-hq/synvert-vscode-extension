// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { rubySpawn } from 'ruby-spawn';
import { SidebarProvider } from './SidebarProvider';
import { LocalStorageService } from './localStorageService';
import { rubyEnabled } from './configuration';
import { log } from './log';

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
    checkGem().catch(() => {
      vscode.window.showErrorMessage('Synvert gem not found. Run `gem install synvert` or update your Gemfile.', 'Install Now').then((item) => {
        if (item === 'Install Now') {
          installGem().then(() => {
            vscode.window.showInformationMessage('Successfully installed the Synvert gem.');
          }).catch(() => {
            vscode.window.showErrorMessage('Failed to install the Synvert gem.');
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

function checkNpm(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const child = spawn('synvert-javascript', ['-v']);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(false);
      }
    });
  });
}

function installNpm(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['install', '-g', 'synvert']);
    child.on('message', (data) => log(data.toString()));
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(false);
      }
    });
  });
}

function checkGem(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const child = rubySpawn('synvert-ruby', ['-v'], {}, true);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(false);
      }
    });
  });
}

function installGem(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const child = rubySpawn('gem', ['install', '-g', 'synvert'], {}, true);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(false);
      }
    });
  });
}
