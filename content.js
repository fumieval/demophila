async function callLLM(openaiApiKey, prompt) {
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
      response_format: { type: "json_object" },
    }),
  });

  let json = "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = decoder.decode(value);
    const jsons = lines
      .split('data: ')
      .map(line => line.trim()).filter(s => s);
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
        json += obj.choices[0].delta.content;
      }
    }
    browser.runtime.sendMessage({ action: "fillDataResponse", json });
  }
  return json;
}

async function fillData(openaiApiKey) {
  const inputs = {};
  document.querySelectorAll("input, textarea").forEach((input, i) => {
    let name = input.name;
    if (name === "" || !name) name = `input-${i}`;
    if (["file", "submit", "hidden"].includes(input.type)) return;
    inputs[name] = input;
  });

  const placeholders = {};
  Object.entries(inputs).forEach(([key, { type, placeholder, value }]) => {
    placeholders[key] = { type, placeholder, value };
  });

  const json = await callLLM(openaiApiKey, `
# Context

Current time: ${new Date().toLocaleString()}
Page URL: ${window.location.href}
Page title: ${document.title}

# Task description

You are a penetration tester. Fill deceivingly realistic data for the following placeholders:

${JSON.stringify(placeholders)}

The response must be in JSON format with the following structure:

{ [name]: value }

# Tips

* Avoid words like "sample", "example", "demo" etc. in the response. The data should look as real as possible.
* Avoid common names like "John Doe", "山田 太郎", etc.
* Maximise your imagination and creativity to generate realistic data.
`);

  const emailDomain = localStorage.getItem("email-domain") ?? "example.com";
  Object.entries(JSON.parse(json)).forEach(([key, value]) => {
    try {
      if (inputs[key].type === "email") {
        inputs[key].value = value.value.replace(/@.*/, `@${emailDomain}`);
      } else {
        inputs[key].value = value.value ?? value;
      }
    } catch (e) {
      console.error(e);
    }
  });
}

browser.runtime.onMessage.addListener((message) => {
  if (message.action === "fillData") {
    fillData(message.openaiApiKey).then(() => {
      browser.runtime.sendMessage({ action: "fillDataResponse", json: "Done" });
    });
  }
});
