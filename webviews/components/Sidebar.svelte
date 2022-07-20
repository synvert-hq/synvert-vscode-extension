<script lang="ts">
  import { onMount } from "svelte";
  import { inputs, outputs } from "./stores";

  let filePattern = "**/*.rb";
  let snippet = "";
  let errorMessage = "";
  let generateSnippetButtonDisabled = false;
  let runSnippetButtonDisabled = false;

  onMount(() => {
    window.addEventListener("message", (event) => {
      const message = event.data; // The json data that the extension sent
      switch (message.type) {
        case "currentFileExtensionName": {
          if (message.value === "rb") {
            filePattern = "**/*.rb";
          }
          break;
        }
        case "selectedCode": {
          $inputs[0] = message.value;
          break;
        }
        case "doneRunSnippet": {
          runSnippetButtonDisabled = false;
          break;
        }
      }
    });
  });

  function addMoreInputOutput() {
    $inputs = [...$inputs, ""];
    $outputs = [...$outputs, ""];
  }

  async function generateSnippet() {
    // const token = machineIdSync({original: true});
    const token = '1234567890';
    const platform = 'vscode';
    try {
      generateSnippetButtonDisabled = true;
      const response = await fetch(`https://synvert-api-ruby.xinminlabs.com/api/v1/call`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-SYNVERT-TOKEN": token,
          "X-SYNVERT-PLATFORM": platform,
        },
        body: JSON.stringify({ inputs: $inputs, outputs: $outputs })
      })
      const result = await response.json();
      snippet = composeCustomSnippet({ filePattern }, result);
    } catch (error) {
      errorMessage = (error as Error).message;
    } finally {
      generateSnippetButtonDisabled = false;
    }
  }

  function runSnippet() {
    runSnippetButtonDisabled = true;
    tsvscode.postMessage({ type: 'onRunSnippet', snippet });
  }

  const composeCustomSnippet = (
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
</script>

<h1>Synvert</h1>
<label for="input"><b>Input</b></label>
{#each $inputs as input}
<textarea id="input" placeholder="e.g. FactoryBot.create(:user)" bind:value={input}></textarea>
{/each}
<label for="output"><b>Output</b></label>
{#each $outputs as output}
<textarea id="output" placeholder="e.g. create(:user)" bind:value={output}></textarea>
{/each}
<button on:click={addMoreInputOutput}>Add More Input/Output</button>
<button on:click={generateSnippet} disabled={generateSnippetButtonDisabled}>{generateSnippetButtonDisabled ? 'Generating...' : 'Generate Snippet'}</button>
<p>{errorMessage}</p>
<textarea rows=10 bind:value={snippet}></textarea>
<button on:click={runSnippet} disabled={runSnippetButtonDisabled}>{runSnippetButtonDisabled ? 'Running...' : 'Run Snippet'}</button>