<script lang="ts">
  import { onMount, afterUpdate } from "svelte";
  import Select from "svelte-select";
  import type { Snippet } from "synvert-ui-common";
  import { fetchSnippets, generateSnippets } from "synvert-ui-common";
  import type { SelectOption, TestResultExtExt } from "../../src/types";

  let updateDependenciesButtonDisabled = false;
  let showGenerateSnippet = false;
  let inputs = [""];
  let outputs = [""];
  let language: "ruby" | "javascript" | "typescript" = "typescript";
  let snippets: Snippet[] = [];
  let selectedSnippet: Snippet | undefined;
  let snippetsLoading = false;
  let rubyVersion = "";
  let gemVersion = "";
  let nodeVersion = "";
  let npmVersion = "";
  let onlyPaths = "";
  let skipPaths = "**/node_modules/**,**/dist/**";
  let nqlOrRules = "rules";
  let generatedSnippets: string[] = [];
  let generatedSnippetIndex: number = 0;
  let snippet = "";
  let errorMessage = "";
  let infoMessage = "";
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

  let filePattern = fetchFilePatternByLanguage(language);
  let parserOptions = fetchOptionsByLanguage(language);
  let parser = parserOptions[0].value;

  async function getSnippets() {
    snippetsLoading = true;
    errorMessage = "";
    infoMessage = "";
    const platform = "vscode";
    // @ts-ignore
    const result = await fetchSnippets(language, token, platform);
    snippetsLoading = false;
    if (result.errorMessage) {
      errorMessage = result.errorMessage;
      return [];
    } else {
      return result.snippets.map((snippet: Snippet) => {
        return {
          ...snippet,
          id: `${snippet.group}/${snippet.name}`,
        }
      });
    }
  }

  onMount(() => {
    window.addEventListener("message", async (event) => {
      const message = event.data; // The json data that the extension sent
      switch (message.type) {
        case "loadData": {
          showGenerateSnippet = message.showGenerateSnippet;
          language = message.language || "typescript";
          parserOptions = fetchOptionsByLanguage(language);
          parser = message.parser || parserOptions[0].value;
          filePattern = message.filePattern || fetchFilePatternByLanguage(language);
          nodeVersion = message.nodeVersion || "";
          npmVersion = message.npmVersion || "";
          inputs = message.inputs;
          outputs = message.outputs;
          nqlOrRules = message.nqlOrRules;
          onlyPaths = message.onlyPaths;
          skipPaths = message.skipPaths;
          snippet = message.snippet;
          results = message.results;

          snippets = await getSnippets();
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
        case "doneUpdateDependencies": {
          updateDependenciesButtonDisabled = false;
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
          if (errorMessage.length > 0) {
            setTimeout(() => {
              document.getElementById("errorMessage")!.scrollIntoView();
            }, 100);
          } else if (results.length === 0) {
            infoMessage = "No file is affected by this snippet.";
            setTimeout(() => {
              document.getElementById("infoMessage")!.scrollIntoView();
            }, 100);
          } else {
            setTimeout(() => {
              document.getElementById("searchResults")!.scrollIntoView();
            }, 100);
          }
          break;
        }
        case "doneReplaceAll": {
          replaceAllButtonDisabled = false;
          results = [];
          errorMessage = message.errorMessage;
          break;
        }
        case "doneReplaceResult": {
          updateSelectedResult(message.resultIndex);
          results = message.results;
          break;
        }
        case "doneReplaceAction": {
          updateSelectedAction(message.resultIndex, message.actionIndex);
          results = message.results;
          break;
        }
      }
    });
    // @ts-ignore
    tsvscode.postMessage({ type: "onMount" });
  });

  afterUpdate(() => {
    // @ts-ignore
    tsvscode.postMessage({ type: "afterUpdate", showGenerateSnippet, language, parser, filePattern, nodeVersion, npmVersion, inputs, outputs, nqlOrRules, onlyPaths, skipPaths, snippet, results });
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

  function updateDependencies() {
    updateDependenciesButtonDisabled = true;
    // @ts-ignore
    tsvscode.postMessage({ type: "updateDependencies", language });
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

  function previousGeneratedSnippet() {
    generatedSnippetIndex = generatedSnippetIndex - 1;
    snippet = generatedSnippets[generatedSnippetIndex];
  }

  function nextGeneratedSnippet() {
    generatedSnippetIndex = generatedSnippetIndex + 1;
    snippet = generatedSnippets[generatedSnippetIndex];
  }

  async function languageChanged() {
    snippets = [];
    selectedSnippet = undefined;
    resetFormInputs();
    snippet = "";
    generatedSnippets = [];
    generatedSnippetIndex = 0;
    snippetChanged();
    errorMessage = "";
    infoMessage = "";
    results = [];
    filePattern = fetchFilePatternByLanguage(language);
    parserOptions = fetchOptionsByLanguage(language);
    parser = parserOptions[0].value;
    snippets = await getSnippets();
  }

  function fetchFilePatternByLanguage(language: string): string {
      switch (language) {
        case "ruby":
          return "**/*.rb";
        case "javascript":
          return "**/*.js";
        case "typescript":
          return "**/*.ts";
        default:
          return "";
      }
  }

  function fetchOptionsByLanguage(language: string): SelectOption[] {
    switch (language) {
      case "ruby":
        return [
          { value: "parser", label: "Parser" },
          { value: "syntax_tree", label: "SyntaxTree" },
        ];
      case "javascript":
        return [
          { value: "typescript", label: "Typescript" },
          { value: "espree", label: "Espree" },
        ];
      case "typescript":
        return [
          { value: "typescript", label: "Typescript" },
        ];
      default:
        return [];
    }
  }

  function resetFormInputs() {
    rubyVersion = "";
    gemVersion = "";
    nodeVersion = "";
    npmVersion = "";
    inputs = [""];
    outputs = [""];
  }

  async function generate() {
    errorMessage = "";
    infoMessage = "";
    generatedSnippets = [];
    generatedSnippetIndex = 0;
    generateSnippetButtonDisabled = true;
    snippet = "";
    const platform = "vscode";
    const params: { [key: string]: string | string[] } = { language, parser, filePattern, inputs, outputs, nqlOrRules };
    if (language === "ruby") {
      params.rubyVersion = rubyVersion;
      params.gemVersion = gemVersion;
    } else {
      params.nodeVersion = nodeVersion;
      params.npmVersion = npmVersion;
    }
    // @ts-ignore
    const result = await generateSnippets(token, platform, params);
    if (result.errorMessage) {
      errorMessage = result.errorMessage;
    } else {
      generatedSnippets = result.generatedSnippets!;
      generatedSnippetIndex = 0;
      snippet = generatedSnippets[generatedSnippetIndex];
      snippetChanged();
    }
    generateSnippetButtonDisabled = false;
  }

  function snippetChanged() {
    if (generatedSnippets[generatedSnippetIndex]) {
      generatedSnippets[generatedSnippetIndex] = snippet;
    }
    results = [];
  }

  function search() {
    errorMessage = "";
    infoMessage = "";
    searchButtonDisabled = true;
    // @ts-ignore
    tsvscode.postMessage({ type: 'onSearch', language, snippet, onlyPaths, skipPaths });
  }

  function replaceAll() {
    errorMessage = "";
    infoMessage = "";
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
    // @ts-ignore
    tsvscode.postMessage({
      type: 'onReplaceResult',
      results,
      resultIndex,
    });
  }

  function removeResult(resultIndex: number) {
    updateSelectedResult(resultIndex);
    results.splice(resultIndex, 1);
    // trigger dom update
    results = results
  }

  function replaceAction(resultIndex: number, actionIndex: number) {
    // @ts-ignore
    tsvscode.postMessage({
      type: 'onReplaceAction',
      results,
      resultIndex,
      actionIndex,
    });
  }

  function removeAction(resultIndex: number, actionIndex: number) {
    updateSelectedAction(resultIndex, actionIndex);
    results[resultIndex].actions.splice(actionIndex, 1);
    // trigger dom update
    results = results
  }

  // const groupBy = (item: any) => item.group;
  const optionIdentifier = 'id';
  const getOptionLabel = (snippet: Snippet) => `${snippet.group}/${snippet.name}`;
  const getSelectionLabel = (snippet: Snippet) => `${snippet.group}/${snippet.name}`;

  function snippetSelected(event: any) {
    snippet = event.detail.source_code;
    generatedSnippets = [];
    generatedSnippetIndex = 0;
    snippetChanged();
  }
</script>

{#if errorMessage.length > 0}
  <p class="error-message" id="errorMessage">{errorMessage}</p>
{/if}
{#if infoMessage.length > 0}
  <p class="info-message" id="infoMessage">{infoMessage}</p>
{/if}
<div class="header">
  <select id="language" bind:value={language} on:change={languageChanged}>
    {#each languageOptions as option}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
  <button on:click={updateDependencies} disabled={updateDependenciesButtonDisabled} title={language === "ruby" ? "Update synvert ruby dependencies and sync synvert ruby snippets" : "Update synvert javascript dependencies and sync synvert javascript snippets"}>{updateDependenciesButtonDisabled ? "Updating..." : "Update"}</button>
</div>
<div class="query-snippets-select">
  <Select items={snippets} loading={snippetsLoading} {optionIdentifier} {getSelectionLabel} {getOptionLabel} bind:value={selectedSnippet} on:select={snippetSelected} placeholder="Search a snippet"></Select>
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
  <label for="parser"><b>Parser</b></label>
  <select id="parser" bind:value={parser}>
    {#each parserOptions as option}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
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
  <div class="nql-or-rules-select">
    <label for="nql">NQL</label>
    <input id="nql" type="radio" name="nql_or_rules" value="nql" bind:group={nqlOrRules}>
    <label for="rules">Rules</label>
    <input id="rules" type="radio" name="nql_or_rules" value="rules" bind:group={nqlOrRules}>
  </div>
  <button on:click={generate} disabled={generateSnippetButtonDisabled}>{generateSnippetButtonDisabled ? 'Generating...' : 'Generate Snippet'}</button>
{/if}
<div class="generated-snippet-label">
  <label for="snippet"><b>Snippet</b></label>
  <span>
    {#if generatedSnippets.length > 0 && generatedSnippetIndex > 0}
      <a href={"#"} on:click={previousGeneratedSnippet}>&lt;&nbsp;Prev</a>
    {/if}
    {#if generatedSnippets.length > 0 && generatedSnippetIndex < generatedSnippets.length - 1}
      <a href={"#"} on:click={nextGeneratedSnippet}>Next&nbsp;&gt;</a>
    {/if}
  </span>
</div>
<textarea id="snippet" rows=10 bind:value={snippet} on:change={snippetChanged}></textarea>
<label for="onlyPaths"><b>Files to include</b></label>
<input id="onlyPaths" bind:value={onlyPaths} placeholder="e.g. frontend/src" />
<label for="skipPaths"><b>Files to exclude</b></label>
<input id="skipPaths" bind:value={skipPaths} />
<button on:click={search} disabled={snippet.length === 0 || searchButtonDisabled || replaceAllButtonDisabled}>{searchButtonDisabled ? 'Searching...' : 'Search'}</button>
<button on:click={replaceAll} disabled={snippet.length === 0 || replaceAllButtonDisabled || searchButtonDisabled}>{replaceAllButtonDisabled ? 'Replacing...' : 'Replace All'}</button>
<div class="search-results" id="searchResults">
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
          {#if result.actions.every(action => action.type !== "noop")}
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
                {#if (action.type !== "noop")}
                  <button class="link-btn" on:click={() => replaceAction(resultIndex, actionIndex)}>
                    <i class="icon replace-icon" />
                  </button>
                {/if}
                <button class="link-btn" on:click={() => removeAction(resultIndex, actionIndex)}>
                  <i class="icon close-icon" />
                </button>
              </div>
            {/if}
            <button class="link-btn item {resultIndex === selectedResultIndex && actionIndex === selectedActionIndex ? 'selected' : ''}" on:click={() => actionClicked(resultIndex, actionIndex, result.rootPath, result.filePath)}>
              {#if (action.type === "add_file")}
                <span class="old-code"></span>
                <span class="new-code">{action.newCode}</span>
              {:else if (action.type === "remove_file")}
                <span class="old-code">{result.fileSource}</span>
                <span class="new-code"></span>
              {:else if (action.type === "group" && action.actions && result.fileSource)}
                {#each action.actions as childAction}
                  {#if (typeof childAction.newCode !== "undefined")}
                    <span class="old-code">{result.fileSource.substring(childAction.start, childAction.end)}</span>
                  {:else}
                    <span>{result.fileSource.substring(childAction.start, childAction.end)}</span>
                  {/if}
                  {#if (typeof childAction.newCode !== "undefined")}
                    <span class="new-code">{childAction.newCode}</span>
                  {/if}
                {/each}
              {:else if (result.fileSource)}
                {#if (typeof action.newCode !== "undefined")}
                  <span class="old-code">{result.fileSource.substring(action.start, action.end)}</span>
                {:else}
                  <span>{result.fileSource.substring(action.start, action.end)}</span>
                {/if}
                {#if (typeof action.newCode !== "undefined")}
                  <span class="new-code">{action.newCode}</span>
                {/if}
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  {/each}
</div>