import { workspace } from 'vscode';

export const rubyEnabled = (): boolean => {
  return workspace.getConfiguration('synvert').get('ruby.enabled') as boolean;
};

export const rubyNumberOfWorkers = (): number => {
  return workspace.getConfiguration('synvert').get('ruby.number_of_workers') as number;
};

export const javascriptEnabled = (): boolean => {
  return workspace.getConfiguration('synvert').get('javascript.enabled') as boolean;
};

export const typescriptEnabled = (): boolean => {
  return workspace.getConfiguration('synvert').get('typescript.enabled') as boolean;
};