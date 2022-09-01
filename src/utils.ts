import { Rewriter } from "synvert-core";

export const getLastSnippetGroupAndName = (): [string, string] => {
  const group = Object.keys(Rewriter.rewriters)[0];
  const name = Object.keys(Rewriter.rewriters[group])[0];
  return [group, name];
};