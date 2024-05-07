import { workspace } from 'vscode';

export const rubyEnabled = (): boolean => {
  return workspace.getConfiguration('synvert').get('ruby.enabled') as boolean;
};

export const rubyBinPath = (): string => {
  return workspace.getConfiguration('synvert').get('ruby.bin_path') as string;
};

export const rubyNumberOfWorkers = (): number => {
  return workspace.getConfiguration('synvert').get('ruby.number_of_workers') as number;
};

export const rubySingleQuote = (): boolean => {
  return workspace.getConfiguration('synvert').get('ruby.single_quote') as boolean;
};

export const rubyTabWidth = (): number => {
  return workspace.getConfiguration('synvert').get('ruby.tab_width') as number;
};

export const javascriptEnabled = (): boolean => {
  return workspace.getConfiguration('synvert').get('javascript.enabled') as boolean;
};

export const javascriptBinPath = (): string => {
  return workspace.getConfiguration('synvert').get('javascript.bin_path') as string;
};

export const javascriptMaxFileSize = (): number => {
  return workspace.getConfiguration('synvert').get('javascript.max_file_size') as number;
};

export const javascriptSingleQuote = (): boolean => {
  return workspace.getConfiguration('synvert').get('javascript.single_quote') as boolean;
};

export const javascriptSemi = (): boolean => {
  return workspace.getConfiguration('synvert').get('javascript.semi') as boolean;
};

export const javascriptTabWidth = (): number => {
  return workspace.getConfiguration('synvert').get('javascript.tab_width') as number;
};

export const typescriptEnabled = (): boolean => {
  return workspace.getConfiguration('synvert').get('typescript.enabled') as boolean;
};

export const typescriptMaxFileSize = (): number => {
  return workspace.getConfiguration('synvert').get('typescript.max_file_size') as number;
};

export const typescriptSingleQuote = (): boolean => {
  return workspace.getConfiguration('synvert').get('typescript.single_quote') as boolean;
};

export const typescriptSemi = (): boolean => {
  return workspace.getConfiguration('synvert').get('typescript.semi') as boolean;
};

export const typescriptTabWidth = (): number => {
  return workspace.getConfiguration('synvert').get('typescript.tab_width') as number;
};

export const cssEnabled = (): boolean => {
  return workspace.getConfiguration('synvert').get('css.enabled') as boolean;
};

export const cssMaxFileSize = (): number => {
  return workspace.getConfiguration('synvert').get('css.max_file_size') as number;
};

export const lessEnabled = (): boolean => {
  return workspace.getConfiguration('synvert').get('less.enabled') as boolean;
};

export const lessMaxFileSize = (): number => {
  return workspace.getConfiguration('synvert').get('less.max_file_size') as number;
};

export const sassEnabled = (): boolean => {
  return workspace.getConfiguration('synvert').get('sass.enabled') as boolean;
};

export const sassMaxFileSize = (): number => {
  return workspace.getConfiguration('synvert').get('sass.max_file_size') as number;
};

export const scssEnabled = (): boolean => {
  return workspace.getConfiguration('synvert').get('scss.enabled') as boolean;
};

export const scssMaxFileSize = (): number => {
  return workspace.getConfiguration('synvert').get('scss.max_file_size') as number;
};

export const languageEnabled = (language: string): boolean => {
  return workspace.getConfiguration('synvert').get(`${language}.enabled`) as boolean;
};
