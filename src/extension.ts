// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { rubySpawn } from 'ruby-spawn';
import { SidebarProvider } from './SidebarProvider';
import { log } from './log';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

  log('Congratulations, your extension "synvert" is now active!');

  const sidebarProvider = new SidebarProvider(context.extensionUri);
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

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand('synvert.insertCode', () => {
    let editor = vscode.window.activeTextEditor;

    if (editor === undefined) {
      vscode.window.showErrorMessage('No active text editor');
      return;
    }
    let text = editor.document.getText(editor.selection);
    if (text === "") {
      vscode.window.showInformationMessage('Selection is empty');
      return;
    }
    sidebarProvider._view?.webview.postMessage({ type: "selectedCode", value: text });
  });

  context.subscriptions.push(disposable);

  // TODO: install gem
  // checkGem().catch(() => {
  //   vscode.window.showErrorMessage('Synvert gem not found. Run `gem install synvert` or update your Gemfile.', 'Install Now').then((item) => {
  //     if (item === 'Install Now') {
  //       installGem().then(() => {
  //         vscode.window.showInformationMessage('Successfully installed the Synvert gem.');
  //       }).catch(() => {
  //         vscode.window.showErrorMessage('Failed to install the Synvert gem.');
  //       });
  //     }
  //   });
  // });

  checkNpm().catch(() => {
    vscode.window.showErrorMessage('Synvert npm not found. Run `npm install synvert` or update your package.json.', 'Install Now').then((item) => {
      if (item === 'Install Now') {
        installNpm().then(() => {
          vscode.window.showInformationMessage('Successfully installed the Synvert npm.');
        }).catch(() => {
          vscode.window.showErrorMessage('Failed to install the Synvert npm.');
        });
      }
    });
  });
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
