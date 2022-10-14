import { TestResultExt } from "synvert-core";

export type TestResultExtExt = TestResultExt & { rootPath?: string, fileSource?: string };

export type SearchResults = { results: TestResultExtExt[], errorMessage: string };
