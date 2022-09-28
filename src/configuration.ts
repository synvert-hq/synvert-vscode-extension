import { workspace } from 'vscode';

export const rubyEnabled = (): boolean => {
  return workspace.getConfiguration('synvert').get('ruby.enabled') as boolean;
}