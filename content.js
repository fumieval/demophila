if (typeof browser === "undefined") {
  var browser = chrome;
}

// set the contents of a input[type=file] with a Blob
function setFileContents(input, name, content) {
  if (input.files.length > 0) {
    console.log(input.files);
    return;
  }
  const blob = new Blob([content], { type: "text/plain" });
  const file = new File([blob], "file.txt", { type: "text/plain" });
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  input.files = dataTransfer.files;
  // trigger drop event
  const event = new Event("drop", { bubbles: true });
  event.dataTransfer = dataTransfer;
  input.dispatchEvent(event);
}

async function callLLM(openaiApiKey, prompt, callback) {
  if (!openaiApiKey) {
    alert("Please set your OpenAI API key");
    return;
  }
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      stream: true,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  let output = "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = decoder.decode(value);
    const jsons = lines
      .split("data: ")
      .map((line) => line.trim())
      .filter((s) => s);
    for (const chunk of jsons) {
      if (chunk === "[DONE]") {
        break;
      }
      const obj = JSON.parse(chunk);
      if (obj.finish_reason) {
        break;
      }
      const delta = obj.choices[0].delta.content;
      if (delta) {
        output += delta;
      }
    }
    callback(output);
  }
}

async function fillData(openaiApiKey) {
  const inputs = {};
  document.querySelectorAll("input, textarea").forEach((input, i) => {
    let name = input.name;
    if (name === "" || !name) name = `input-${i}`;
    if (["submit", "hidden"].includes(input.type)) return;
    inputs[name] = input;
  });

  const prompt = `
# Context

Current time: ${new Date().toLocaleString()}
Page URL: ${window.location.href}
Page title: ${document.title}

# Task

You are a penetration tester.

* Avoid words like "sample", "example", "demo" etc. in the response.
* Avoid common names like "John Doe", "山田 太郎", etc.
* Avoid using the examples as-is.
* Improve existing values.
* Escape newlines with \\n.

# Output

Fill deceivingly realistic data for the following placeholders:

${Object.entries(inputs)
  .map(
    ([key, value]) =>
      `${key}=${value.value.replaceAll("\n", "\\n")} # ${value.type} ${
        value.placeholder
          ? `example: ${value.placeholder.replaceAll("\n", "\\n")}`
          : ""
      }`
  )
  .join("\n")}
`;

  console.log(prompt);
  await callLLM(openaiApiKey, prompt, (output) => {
    browser.runtime.sendMessage({
      action: "fillDataResponse",
      data: output,
    });
    const lines = output.split("\n");
    for (const line of lines) {
      let [name, value] = line.split("=");
      if (inputs[name] && value) {
        // drop # comments
        value = value.split("#")[0].trim();
        if (inputs[name].type === "email") {
          inputs[name].value = value.replace(/@.*/, `@example.com`);
        } else if (inputs[name].type === "file") {
          setFileContents(inputs[name], value, "Lorem ipsum dolor sit amet");
        } else {
          inputs[name].value = value.replaceAll("\\n", "\n");
        }
        // trigger change event
        const event = new Event("input", { bubbles: true });
        inputs[name].dispatchEvent(event);
      }
    }
  });

  browser.runtime.sendMessage({
    action: "fillDataResponse",
    done: true,
  });
}

browser.runtime.onMessage.addListener((message) => {
  if (message.action === "fillData") {
    try {
      fillData(message.openaiApiKey);
    } catch (e) {
      browser.runtime.sendMessage({
        action: "fillDataResponse",
        error: e.message,
      });
    }
  }
});
