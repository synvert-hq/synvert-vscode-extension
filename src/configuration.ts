import { workspace } from 'vscode';

export const rubyEnabled = (): boolean => {
  return workspace.getConfiguration('synvert').get('ruby.enabled') as boolean;
};

export const rubyNumberOfWorkers = (): number => {
  return workspace.getConfiguration('synvert').get('ruby.number_of_workers') as number;
};