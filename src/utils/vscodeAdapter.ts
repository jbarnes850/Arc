// Adapter for VS Code UI vs CLI logging
let vscodeModule: any;
let useVSCode = false;
try {
  vscodeModule = require('vscode');
  useVSCode = true;
} catch {
  useVSCode = false;
}

/**
 * Show an information message either in VS Code UI or console.
 */
export function showInformationMessage(message: string) {
  if (useVSCode) {
    vscodeModule.window.showInformationMessage(message);
  } else {
    console.log(message);
  }
}

/**
 * Show an error message either in VS Code UI or console.
 */
export function showErrorMessage(message: string) {
  if (useVSCode) {
    vscodeModule.window.showErrorMessage(message);
  } else {
    console.error(message);
  }
}
