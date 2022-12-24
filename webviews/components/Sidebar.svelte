<script lang="ts">
  import { onMount, afterUpdate } from "svelte";
  import Select from "svelte-select";
  import type { Snippet } from "synvert-ui-common";
  import type { SelectOption, TestResultExtExt } from "../../src/types";

  let showGenerateSnippet = false;
  let inputs = [""];
  let outputs = [""];
  let language = "typescript";
  let snippets: Snippet[] = [];
  let snippetsLoading = false;
  let filePattern = "**/*.ts";
  let rubyVersion = "";
  let gemVersion = "";
  let nodeVersion = "";
  let npmVersion = "";
  let onlyPaths = "";
  let skipPaths = "**/node_modules/**,**/dist/**";
  let nqlOrRules = "rules";
  let snippet = "";
  let errorMessage = "";
  let generateSnippetButtonDisabled = false;
  let searchButtonDisabled = false;
  let replaceAllButtonDisabled = false;
  let results: TestResultExtExt[] = [];
  let hoverResultIndex: number | undefined;
  let hoverActionIndex: number | undefined;
  let selectedResultIndex: number | undefined;
  let selectedActionIndex: number | undefined;
  let filesCollapse: { [filePath: string]: boolean } = {};

  const languageOptions: SelectOption[] = [];
  // @ts-ignore
  if (rubyEnabled) {
    languageOptions.push({ value: "ruby", label: "Ruby" });
  }
  // @ts-ignore
  if (javascriptEnabled) {
    languageOptions.push({ value: "javascript", label: "Javascript" });
  }
  // @ts-ignore
  if (typescriptEnabled) {
    languageOptions.push({ value: "typescript", label: "Typescript" });
  }

  async function fetchSnippets() {
    snippetsLoading = true;
    errorMessage = "";
    const platform = "vscode";
    const url = language === "ruby" ? 'https://api-ruby.synvert.net/snippets' : 'https://api-javascript.synvert.net/snippets';
    // const url = language === "ruby" ? 'http://localhost:9200/snippets' : 'http://localhost:3000/snippets';
    try {
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          // @ts-ignore
          "X-SYNVERT-TOKEN": token,
          "X-SYNVERT-PLATFORM": platform,
        }
      })
      const data = await response.json();
      snippetsLoading = false;
      return data.snippets;
    } catch (error) {
      errorMessage = (error as Error).message;
      snippetsLoading = false;
      return [];
    }
  }

  onMount(() => {
    window.addEventListener("message", async (event) => {
      const message = event.data; // The json data that the extension sent
      switch (message.type) {
        case "loadData": {
          showGenerateSnippet = message.showGenerateSnippet;
          language = message.language || "typescript";
          filePattern = message.filePattern || "**/*.ts";
          nodeVersion = message.nodeVersion || "";
          npmVersion = message.npmVersion || "";
          inputs = message.inputs;
          outputs = message.outputs;
          nqlOrRules = message.nqlOrRules;
          onlyPaths = message.onlyPaths;
          skipPaths = message.skipPaths;
          snippet = message.snippet;
          results = message.results;

          snippets = await fetchSnippets();
          break;
        }
        case "currentFileExtensionName": {
          const extension = message.value;
          switch (extension) {
            case "rb":
              language = "ruby";
              filePattern = "**/*.rb";
              break;
            case "js":
              language = "javascript";
              filePattern = "**/*.js";
              break;
            case "jsx":
              language = "javascript";
              filePattern = "**/*.jsx";
              break;
            case "ts":
              language = "typescript";
              filePattern = "**/*.ts";
              break;
            case "tsx":
              language = "typescript";
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
          errorMessage = message.errorMessage;
          break;
        }
        case "doneReplaceAll": {
          replaceAllButtonDisabled = false;
          results = [];
          errorMessage = message.errorMessage;
          break;
        }
        case "doneReplaceResult": {
          const { resultIndex } = message;
          updateSelectedResult(resultIndex);
          results.splice(resultIndex, 1);
          // trigger dom update
          results = results;
          break;
        }
        case "doneReplaceAction": {
          const { resultIndex, actionIndex, offset, source } = message;
          updateSelectedAction(resultIndex, actionIndex);
          const actions = results[resultIndex].actions;
          actions.splice(actionIndex, 1);
          if (actions.length > 0) {
            actions.slice(actionIndex).forEach(action => {
              action.start = action.start + offset;
              action.end = action.end + offset;
            });
            results[resultIndex].fileSource = source;
          } else {
            results.splice(resultIndex, 1);
          }
          // trigger dom update
          results = results;
          break;
        }
      }
    });
    // @ts-ignore
    tsvscode.postMessage({ type: "onMount" });
  });

  afterUpdate(() => {
    // @ts-ignore
    tsvscode.postMessage({ type: "afterUpdate", showGenerateSnippet, language, filePattern, nodeVersion, npmVersion, inputs, outputs, nqlOrRules, onlyPaths, skipPaths, snippet, results });
  });

  const PLACEHODERS: { [language: string]: { [name: string]: string } } = {
    ruby: {
      input: "FactoryBot.create(:user)",
      output: "create(:user)",
    },
    javascript: {
      input: "foo.substring(indexStart, indexEnd)",
      output: "foo.slice(indexStart, indexEnd)",
    },
    typescript: {
      input: "const x: Array<string> = ['a', 'b']",
      output: "const x: string[] = ['a', 'b']",
    }
  }

  function placeholderByLanguage(language: string): { [name: string]: string } {
    return PLACEHODERS[language];
  }

  function updateSelectedResult(resultIndex: number) {
    if (selectedResultIndex === resultIndex) {
      selectedResultIndex = undefined;
      selectedActionIndex = undefined;
    }
    if (selectedResultIndex && selectedResultIndex > resultIndex) {
      selectedResultIndex = selectedResultIndex - 1;
    }
  }

  function updateSelectedAction(resultIndex: number, actionIndex: number) {
    if (selectedResultIndex === resultIndex) {
      if (selectedActionIndex === actionIndex) {
        selectedResultIndex = undefined;
        selectedActionIndex = undefined;
      }
      if (selectedActionIndex && selectedActionIndex > actionIndex) {
        selectedActionIndex = selectedActionIndex - 1;
      }
    }
    if (selectedResultIndex && selectedResultIndex > resultIndex && results[resultIndex].actions.length == 1) {
      selectedResultIndex = selectedResultIndex - 1;
    }
  }

  function toggleGenerateSnippet() {
    showGenerateSnippet = !showGenerateSnippet;
  }

  function addMoreInputOutput() {
    inputs = [...inputs, ""];
    outputs = [...outputs, ""];
  }

  function removeLastInputOutput() {
    inputs = inputs.slice(0, -1);
    outputs = outputs.slice(0, -1);
  }

  async function languageChanged() {
    snippets = [];
    resetFormInputs();
    snippet = "";
    snippetChanged();
    errorMessage = "";
    results = [];
    switch (language) {
      case "ruby":
        filePattern = "**/*.rb";
        break;
      case "javascript":
        filePattern = "**/*.js";
        break;
      case "typescript":
        filePattern = "**/*.ts";
        break;
    }
    snippets = await fetchSnippets();
  }

  function resetFormInputs() {
    rubyVersion = "";
    gemVersion = "";
    nodeVersion = "";
    npmVersion = "";
    inputs = [""];
    outputs = [""];
  }

  async function generateSnippet() {
    errorMessage = "";
    const platform = "vscode";
    const url = language === "ruby" ? 'https://api-ruby.synvert.net/generate-snippet' : 'https://api-javascript.synvert.net/generate-snippet';
    // const url = language === "ruby" ? 'http://localhost:9200/generate-snippet' : 'http://localhost:3000/generate-snippet';
    try {
      generateSnippetButtonDisabled = true;
      const outputsOrEmptyArray = outputs.every(output => output.length === 0) ? [] : outputs
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          // @ts-ignore
          "X-SYNVERT-TOKEN": token,
          "X-SYNVERT-PLATFORM": platform,
        },
        body: JSON.stringify({ inputs, outputs: outputsOrEmptyArray, nql_or_rules: nqlOrRules })
      })
      const data = await response.json();
      if (data.error) {
        errorMessage = data.error;
        snippet = "";
      } else {
        snippet = language === "ruby" ? composeRubySnippet(data) : composeJavascriptSnippet(data);
        snippetChanged();
      }
    } catch (error) {
      errorMessage = (error as Error).message;
      snippet = "";
    } finally {
      generateSnippetButtonDisabled = false;
    }
  }

  function snippetChanged() {
    results = [];
  }

  function search() {
    errorMessage = "";
    searchButtonDisabled = true;
    // @ts-ignore
    tsvscode.postMessage({ type: 'onSearch', language, snippet, onlyPaths, skipPaths });
  }

  function replaceAll() {
    errorMessage = "";
    replaceAllButtonDisabled = true;
    if (results.length > 0) {
      // @ts-ignore
      tsvscode.postMessage({ type: 'onReplaceAll', results });
    } else {
      // @ts-ignore
      tsvscode.postMessage({ type: 'onDirectReplaceAll', language, snippet, onlyPaths, skipPaths });
    }
  }

  function actionClicked(resultIndex: number, actionIndex: number, rootPath: string | undefined, filePath: string | undefined) {
    selectedResultIndex = resultIndex;
    selectedActionIndex = actionIndex;
    const action = results[resultIndex].actions[actionIndex];
    // @ts-ignore
    tsvscode.postMessage({ type: 'onOpenFile', action, rootPath, filePath });
  }

  function toggleResult(filePath: string) {
    if (filesCollapse[filePath]) {
      filesCollapse[filePath] = false;
    } else {
      filesCollapse[filePath] = true;
    }
  }

  function mouseOverResult(resultIndex: number) {
    hoverResultIndex = resultIndex;
    hoverActionIndex = undefined;
  }

  function mouseOverAction(resultIndex: number, actionIndex: number) {
    hoverResultIndex = resultIndex;
    hoverActionIndex = actionIndex;
  }

  function replaceResult(resultIndex: number) {
    const result = results[resultIndex];
    // @ts-ignore
    tsvscode.postMessage({
      type: 'onReplaceResult',
      resultIndex,
      result: result,
      rootPath: result.rootPath,
      filePath: result.filePath,
    });
  }

  function removeResult(resultIndex: number) {
    updateSelectedResult(resultIndex);
    results.splice(resultIndex, 1);
    // trigger dom update
    results = results
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
    updateSelectedAction(resultIndex, actionIndex);
    results[resultIndex].actions.splice(actionIndex, 1);
    // trigger dom update
    results = results
  }

  const composeRubySnippet = (data: { snippet: string }): string => {
    let customSnippet = "Synvert::Rewriter.new 'group', 'name' do\n";
    if (rubyVersion.length > 0) {
      customSnippet += `  if_ruby '${rubyVersion}'\n`;
    }
    if (gemVersion.length > 0) {
      const index = gemVersion.indexOf(" ");
      const name = gemVersion.substring(0, index);
      const version = gemVersion.substring(index + 1);
      customSnippet += `  if_gem '${name}', '${version}'\n`;
    }
    customSnippet += `  within_files '${filePattern}' do\n`;
    if (data.snippet) {
      customSnippet += "    ";
      customSnippet += data.snippet.replace(/\n/g, "\n    ");
      customSnippet += "\n";
    }
    customSnippet += "  end\n";
    customSnippet += "end";
    return customSnippet;
  };

  const composeJavascriptSnippet = (data: { snippet: string}): string => {
    let customSnippet = `const Synvert = require("synvert-core");\n`;
    customSnippet += `new Synvert.Rewriter("group", "name", () => {\n`;
    customSnippet += `  configure({ parser: "typescript" });\n`;
    if (nodeVersion.length > 0) {
      customSnippet += `  ifNode("${nodeVersion}");\n`
    }
    if (npmVersion.length > 0) {
      const index = npmVersion.indexOf(" ");
      const name = npmVersion.substring(0, index);
      const version = npmVersion.substring(index + 1);
      customSnippet += `  ifNpm('${name}', '${version}');\n`;
    }
    customSnippet += `  withinFiles("${filePattern}", () => {\n`;
    if (data.snippet) {
      customSnippet += "    ";
      customSnippet += data.snippet.replace(/\n/g, "\n    ");
      customSnippet += "\n";
    }
    customSnippet += `  });\n`;
    customSnippet += `});`;
    return customSnippet;
  }

  // const groupBy = (item: any) => item.group;
  const optionIdentifier = 'id';
  const getOptionLabel = (snippet: any) => `${snippet.group}/${snippet.name}`;
  const getSelectionLabel = (snippet: Snippet) => `${snippet.group}/${snippet.name}`;

  function snippetSelected(event: any) {
    snippet = event.detail.source_code;
    snippetChanged();
  }
</script>

{#if errorMessage.length > 0}
  <p class="error-message">{errorMessage}</p>
{/if}
<select id="language" bind:value={language} on:change={languageChanged}>
  {#each languageOptions as option}
    <option value={option.value}>{option.label}</option>
  {/each}
</select>
<div class="query-snippets-select">
  <Select items={snippets} loading={snippetsLoading} {optionIdentifier} {getSelectionLabel} {getOptionLabel} on:select={snippetSelected} placeholder="Search a snippet"></Select>
</div>
<div class="generate-snippet">
  <button class="link-btn" on:click={toggleGenerateSnippet}>
    {#if showGenerateSnippet}
      <i class="icon chevron-down-icon"></i>
      <span>Hide Generate Snippet Form</span>
    {:else}
      <i class="icon chevron-right-icon"></i>
      <span>Show Generate Snippet Form</span>
    {/if}
  </button>
</div>
{#if showGenerateSnippet}
  <label for="filePattern"><b>File Pattern</b></label>
  <input id="filePattern" bind:value={filePattern} />
  {#if language === "ruby"}
    <label for="rubyVersion"><b>Ruby Version</b></label>
    <input id="rubyVersion" bind:value={rubyVersion} placeholder="e.g. 3.0.0" />
    <label for="gemVersion"><b>Gem Version</b></label>
    <input id="gemVersion" bind:value={gemVersion} placeholder="e.g. rails ~> 6.0.0" />
  {:else}
    <label for="nodeVersion"><b>Node Version</b></label>
    <input id="nodeVersion" bind:value={nodeVersion} placeholder="e.g. 18.0.0" />
    <label for="npmVersion"><b>Npm Version</b></label>
    <input id="npmVersion" bind:value={npmVersion} placeholder="e.g. react >= 18.0.0" />
  {/if}
  <a href="https://synvert.net/how_to_write_inputs_outputs" target="_blank" rel="noreferrer">
    How to write inputs / outputs?
  </a>
  <br />
  <label for="input"><b>Input</b></label>
  {#each inputs as input}
    <textarea id="input" placeholder={placeholderByLanguage(language).input} bind:value={input}></textarea>
  {/each}
  <label for="output"><b>Output</b></label>
  {#each outputs as output}
    <textarea id="output" placeholder={placeholderByLanguage(language).output} bind:value={output}></textarea>
  {/each}
  <p><a href={"#"} on:click={addMoreInputOutput}>Add More Input/Output</a></p>
  {#if inputs.length > 1}
    <p><a href={"#"} on:click={removeLastInputOutput}>Remove Last Input/Output</a></p>
  {/if}
  <div class="flex row-reverse nql-or-rules-select">
    <label for="nql">NQL</label>
    <input id="nql" type="radio" name="nql_or_rules" value="nql" bind:group={nqlOrRules}>
    <label for="rules">Rules</label>
    <input id="rules" type="radio" name="nql_or_rules" value="rules" bind:group={nqlOrRules}>
  </div>
  <button on:click={generateSnippet} disabled={inputs[0].length === 0 || generateSnippetButtonDisabled}>{generateSnippetButtonDisabled ? 'Generating...' : 'Generate Snippet'}</button>
{/if}
<label for="snippet"><b>Snippet</b></label>
<textarea id="snippet" rows=10 bind:value={snippet} on:change={snippetChanged}></textarea>
<label for="onlyPaths"><b>Files to include</b></label>
<input id="onlyPaths" bind:value={onlyPaths} placeholder="e.g. frontend/src" />
<label for="skipPaths"><b>Files to exclude</b></label>
<input id="skipPaths" bind:value={skipPaths} />
<button on:click={search} disabled={snippet.length === 0 || searchButtonDisabled || replaceAllButtonDisabled}>{searchButtonDisabled ? 'Searching...' : 'Search'}</button>
<button on:click={replaceAll} disabled={snippet.length === 0 || replaceAllButtonDisabled || searchButtonDisabled}>{replaceAllButtonDisabled ? 'Replacing...' : 'Replace All'}</button>
<div class="search-results">
  {#each results as result, resultIndex}
    <div class="search-result">
      <button class="link-btn" on:click={() => toggleResult(result.filePath)}>
        {#if filesCollapse[result.filePath]}
          <i class="icon chevron-right-icon"></i>
        {:else}
          <i class="icon chevron-down-icon"></i>
        {/if}
      </button>
      <button class="link-btn file-path" on:click={() => toggleResult(result.filePath)} on:mouseover={() => mouseOverResult(resultIndex)} on:focus={() => mouseOverResult(resultIndex)} title={result.filePath}>{result.filePath}</button>
      {#if resultIndex === hoverResultIndex && typeof hoverActionIndex === "undefined"}
        <div class="toolkit">
          {#if result.actions.every(action => (typeof action.newCode !== "undefined"))}
            <button class="link-btn" on:click|preventDefault={() => replaceResult(resultIndex)}>
              <i class="icon replace-icon" />
            </button>
          {/if}
          <button class="link-btn" on:click|preventDefault={() => removeResult(resultIndex)}>
            <i class="icon close-icon" />
          </button>
        </div>
      {/if}
    </div>
    {#if !filesCollapse[result.filePath]}
      <ul>
        {#each result.actions as action, actionIndex}
          <li on:mouseover={() => mouseOverAction(resultIndex, actionIndex)} on:focus={() => mouseOverAction(resultIndex, actionIndex)}>
            {#if resultIndex === hoverResultIndex && actionIndex === hoverActionIndex}
              <div class="toolkit">
                {#if (typeof action.newCode !== "undefined")}
                  <button class="link-btn" on:click={() => replaceAction(resultIndex, actionIndex)}>
                    <i class="icon replace-icon" />
                  </button>
                {/if}
                <button class="link-btn" on:click={() => removeAction(resultIndex, actionIndex)}>
                  <i class="icon close-icon" />
                </button>
              </div>
            {/if}
            {#if result.fileSource}
              <button class="link-btn item {resultIndex === selectedResultIndex && actionIndex === selectedActionIndex ? 'selected' : ''}" on:click={() => actionClicked(resultIndex, actionIndex, result.rootPath, result.filePath)}>
                <span class="old-code">{result.fileSource.substring(action.start, action.end)}</span>
                <span class="new-code">{action.newCode}</span>
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  {/each}
</div>