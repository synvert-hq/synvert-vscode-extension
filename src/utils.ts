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