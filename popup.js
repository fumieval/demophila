function bindElementToLocalStorage(element, key) {
  element.value = localStorage.getItem(key);
  element.addEventListener("input", (e) => {
    localStorage.setItem(key, e.target.value);
  });
}

bindElementToLocalStorage(document.querySelector("#openai-api-key"), "openai-api-key");
bindElementToLocalStorage(document.querySelector("#email-domain"), "email-domain");

document.querySelector("#run").addEventListener("click", async (e) => {
  e.target.disabled = true;
  browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const openaiApiKey = localStorage.getItem("openai-api-key");
    if (!openaiApiKey) {
      alert("Please set your OpenAI API key");
      return;
    }
    browser.tabs.sendMessage(
      tabs[0].id,
      {
        action: "fillData",
        openaiApiKey,
      }
    );
  });
});

browser.runtime.onMessage.addListener((message) => {
  if (message.action === "fillDataResponse") {
    document.querySelector("#progress").innerText = message.json;
  }
});
