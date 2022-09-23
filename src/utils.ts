import { Rewriter } from "synvert-core";

export const getLastSnippetGroupAndName = (): [string, string] => {
  const group = Object.keys(Rewriter.rewriters)[0];
  const name = Object.keys(Rewriter.rewriters[group])[0];
  return [group, name];
};


const snakeToCamel = (str: string): string => str.replace(/([-_]\w)/g, g => g[1].toUpperCase());

export const parseJSON = (str: string) => {
  return JSON.parse(str, function(key, value) {
    const camelCaseKey = snakeToCamel(key);

    if (this instanceof Array || camelCaseKey === key) {
      return value;
    } else {
      this[camelCaseKey] = value;
    }
  });
};