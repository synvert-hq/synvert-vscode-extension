<script lang="ts">
  import { onMount } from "svelte";
  import { inputs, outputs } from "./stores";

  let snippet = "";
  let errorMessage = "";

  onMount(() => {
    window.addEventListener("message", (event) => {
      const message = event.data; // The json data that the extension sent
      switch (message.type) {
        case "selectedCode": {
          $inputs[0] = message.value;
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
      const responseJSON = await response.json();
      snippet = responseJSON.snippet;
    } catch (error) {
      errorMessage = (error as Error).message;
    }
  }
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
<button on:click={generateSnippet}>Generate Snippet</button>
<p>{errorMessage}</p>
<textarea rows=10>{snippet}</textarea>