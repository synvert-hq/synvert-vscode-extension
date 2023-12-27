// Copy from @xinminlabs/node-mutation
type Action = {
  type: string;
  start: number;
  end: number;
  newCode?: string;
  conflictPosition?: number;
  actions?: Action[];
};
type TestResult = {
  affected: boolean;
  conflicted: boolean;
  actions: Action[];
};

// Copy from synvert-core
type TestResultExt = TestResult & { filePath: string, newFilePath?: string };

export type TestResultExtExt = TestResultExt & { rootPath?: string, fileSource?: string };

export type SearchResults = { results: TestResultExtExt[], errorMessage: string };

export type SelectOption = { value: string, label: string };
