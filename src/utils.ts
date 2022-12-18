import { rubySpawn } from 'ruby-spawn';

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

export const runRubyCommand = (command: string, args: string[], input: string | null = null) => {
  return new Promise<{ stdout: string, stderr: string }>((resolve) => {
    const child = rubySpawn(command, args, { encoding: 'utf8', env: { PATH: process.env.PATH } }, true);
    if (child.stdin && input) {
      child.stdin.write(input);
      child.stdin.end();
    }
    let output = '';
    if (child.stdout) {
      child.stdout.on('data', data => {
        output += data;
      });
    }
    let error = "";
    if (child.stderr) {
      child.stderr.on('data', data => {
        error += data;
      });
    }
    child.on('error', (e) => {
      return resolve({ stdout: "", stderr: e.message });
    });
    child.on('exit', () => {
      return resolve({ stdout: output, stderr: error });
    });
  });
};
