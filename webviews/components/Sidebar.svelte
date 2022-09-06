<script lang="ts">
  import { onMount } from "svelte";
  import type { TestResultExtExt } from "../../src/types";

  let inputs = [""];
  let outputs = [""];
  let filePattern = "**/*.js";
  let onlyPaths = "";
  let skipPaths = "**/node_modules/**,**/dist/**";
  let snippet = "";
  let errorMessage = "";
  let generateSnippetButtonDisabled = false;
  let searchButtonDisabled = false;
  let replaceAllButtonDisabled = false;
  let results: TestResultExtExt[] = [];
  let hoverResultIndex: number | undefined;
  let hoverActionIndex: number | undefined;

  onMount(() => {
    window.addEventListener("message", (event) => {
      const message = event.data; // The json data that the extension sent
      switch (message.type) {
        case "currentFileExtensionName": {
          switch (message.value) {
            case "rb":
              filePattern = "**/*.rb";
              break;
            case "js":
              filePattern = "**/*.js";
              break;
            case "jsx":
              filePattern = "**/*.jsx";
              break;
            case "ts":
              filePattern = "**/*.ts";
              break;
            case "tsx":
              filePattern = "**/*.tsx";
              break;
          }
          break;
        }
        case "selectedCode": {
          inputs[0] = message.value;
          break;
        }
        case "doneSearch": {
          searchButtonDisabled = false;
          results = message.results;
          break;
        }
        case "doneReplaceAll": {
          replaceAllButtonDisabled = false;
          results = [];
          break;
        }
        case "doneReplaceAction": {
          const { resultIndex, actionIndex } = message;
          results[resultIndex].actions.splice(actionIndex, 1);
          // trigger dom update
          results = results;
          break;
        }
      }
    });
  });

  function addMoreInputOutput() {
    inputs = [...inputs, ""];
    outputs = [...outputs, ""];
  }

  function removeLastInputOutput() {
    inputs = inputs.slice(0, -1);
    outputs = outputs.slice(0, -1);
  }

  async function generateSnippet() {
    // TODO: dynamic token
    const token = "1234567890";
    const platform = "vscode";
    const extension = "ts";
    const nqlOrRules = "rules";
    try {
      generateSnippetButtonDisabled = true;
      // FIXME: change it back before publishing
      // const response = await fetch(`https://synvert-api-javascript.xinminlabs.com/generate-snippet`, {
      const response = await fetch(`http://localhost:3000/generate-snippet`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-SYNVERT-TOKEN": token,
          "X-SYNVERT-PLATFORM": platform,
        },
        body: JSON.stringify({ extension, inputs, outputs, nql_or_rules: nqlOrRules })
      })
      const result = await response.json();
      snippet = composeJavascriptSnippet({ filePattern }, result);
    } catch (error) {
      errorMessage = (error as Error).message;
    } finally {
      generateSnippetButtonDisabled = false;
    }
  }

  function search() {
    searchButtonDisabled = true;
    // @ts-ignore
    tsvscode.postMessage({ type: 'onSearch', snippet, onlyPaths, skipPaths });
  }

  function replaceAll() {
    replaceAllButtonDisabled = true;
    if (results.length > 0) {
      // @ts-ignore
      tsvscode.postMessage({ type: 'onReplaceAll', results });
    } else {
      // @ts-ignore
      tsvscode.postMessage({ type: 'onDirectReplaceAll', snippet, onlyPaths, skipPaths });
    }
  }

  function actionClicked(action: object, rootPath: string | undefined, filePath: string | undefined) {
    // @ts-ignore
    tsvscode.postMessage({ type: 'onOpenFile', action, rootPath, filePath });
  }

  function handleMouseOver(resultIndex: number, actionIndex: number) {
    hoverResultIndex = resultIndex;
    hoverActionIndex = actionIndex;
  }

  function handleMouseOut() {
    hoverResultIndex = undefined;
    hoverActionIndex = undefined;
  }

  function replaceAction(resultIndex: number, actionIndex: number) {
    const result = results[resultIndex];
    const action = result.actions[actionIndex];
    // @ts-ignore
    tsvscode.postMessage({
      type: 'onReplaceAction',
      resultIndex,
      actionIndex,
      action,
      rootPath: result.rootPath,
      filePath: result.filePath,
    });
  }

  function removeAction(resultIndex: number, actionIndex: number) {
    results[resultIndex].actions.splice(actionIndex, 1);
    // trigger dom update
    results = results
  }

  const composeRubySnippet = (
    data: { rubyVersion?: string, gemVersion?: string, filePattern: string },
    result: { snippet: string }
  ): string => {
    let customSnippet = "Synvert::Rewriter.execute do\n";
    if (data.rubyVersion) {
      customSnippet += `  if_ruby '${data.rubyVersion}'\n`;
    }
    if (data.gemVersion) {
      const index = data.gemVersion.indexOf(" ");
      const name = data.gemVersion.substring(0, index);
      const version = data.gemVersion.substring(index + 1);
      customSnippet += `  if_gem '${name}', '${version}'\n`;
    }
    customSnippet += `  within_files '${data.filePattern}' do\n`;
    if (result.snippet) {
      customSnippet += "    ";
      customSnippet += result.snippet.replace(/\n/g, "\n    ");
      customSnippet += "\n";
    }
    customSnippet += "  end\n";
    customSnippet += "end";
    return customSnippet;
  };

  const composeJavascriptSnippet = (
    data: { nodeVersion?: string, npmVersion?: string, filePattern: string },
    result: { snippet: string}
  ): string => {
    let customSnippet = `const Synvert = require("synvert-core");\n`;
    customSnippet += `new Synvert.Rewriter("group", "name", () => {\n`;
    customSnippet += `  configure({ parser: "typescript" });\n`;
    if (data.nodeVersion) {
      customSnippet += `  ifNode("${data.nodeVersion}");\n`
    }
    if (data.npmVersion) {
      const index = data.npmVersion.indexOf(" ");
      const name = data.npmVersion.substring(0, index);
      const version = data.npmVersion.substring(index + 1);
      customSnippet += `  ifNpm '${name}', '${version}'\n`;
    }
    customSnippet += `  withinFiles("${data.filePattern}", () => {\n`;
    if (result.snippet) {
      customSnippet += "    ";
      customSnippet += result.snippet.replace(/\n/g, "\n    ");
      customSnippet += "\n";
    }
    customSnippet += `  });\n`;
    customSnippet += `});`;
    return customSnippet;
  }
</script>

<label for="input"><b>Input</b></label>
{#each inputs as input}
<textarea id="input" placeholder="e.g. FactoryBot.create(:user)" bind:value={input}></textarea>
{/each}
<label for="output"><b>Output</b></label>
{#each outputs as output}
<textarea id="output" placeholder="e.g. create(:user)" bind:value={output}></textarea>
{/each}
<p><a href={"#"} on:click={addMoreInputOutput}>Add More Input/Output</a></p>
{#if inputs.length > 1}
<p><a href={"#"} on:click={removeLastInputOutput}>Remove Last Input/Output</a></p>
{/if}
<button on:click={generateSnippet} disabled={inputs[0].length === 0 || outputs[0].length === 0 || generateSnippetButtonDisabled}>{generateSnippetButtonDisabled ? 'Generating...' : 'Generate Snippet'}</button>
<p>{errorMessage}</p>
<textarea rows=10 bind:value={snippet}></textarea>
<label for="onlyPaths"><b>Files to include</b></label>
<input id="onlyPaths" bind:value={onlyPaths} />
<label for="skipPaths"><b>Files to exclude</b></label>
<input id="skipPaths" bind:value={skipPaths} />
<button on:click={search} disabled={snippet.length === 0 || searchButtonDisabled}>{searchButtonDisabled ? 'Searching...' : 'Search'}</button>
<button on:click={replaceAll} disabled={snippet.length === 0 || replaceAllButtonDisabled}>{replaceAllButtonDisabled ? 'Replacing...' : 'Replace All'}</button>
{#each results as result, resultIndex}
<p>{result.filePath}</p>
<ul class="search-result">
{#each result.actions as action, actionIndex}
<li on:mouseover={() => handleMouseOver(resultIndex, actionIndex)} on:mouseout={() => handleMouseOut()} on:focus={() => handleMouseOver(resultIndex, actionIndex)} on:blur={() => handleMouseOut()}>
{#if resultIndex === hoverResultIndex && actionIndex === hoverActionIndex}
<span class="toolkit">
  <a class="icon replace-icon" href={"#"} on:click={() => replaceAction(resultIndex, actionIndex)}>Replace</a>
  <a class="icon close-icon" href={"#"} on:click={() => removeAction(resultIndex, actionIndex)}>Remove</a>
</span>
{/if}
<a class="item" href={"#"} on:click={() => actionClicked(action, result.rootPath, result.filePath)}>{result.fileSource && result.fileSource.substring(action.start, action.end)}</a>
</li>
{/each}
</ul>
{/each}