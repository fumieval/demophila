if (typeof browser === "undefined") {
  var browser = chrome;
}

function bindElementToLocalStorage(element, key) {
  element.value = localStorage.getItem(key);
  element.addEventListener("input", (e) => {
    localStorage.setItem(key, e.target.value);
  });
}

bindElementToLocalStorage(
  document.querySelector("#openai-api-key"),
  "openai-api-key"
);

document.querySelector("#run").addEventListener("click", async (e) => {
  e.target.ariaBusy = true;
  browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const openaiApiKey = localStorage.getItem("openai-api-key");
    browser.tabs.sendMessage(tabs[0].id, {
      action: "fillData",
      openaiApiKey,
    });
  });
});

browser.runtime.onMessage.addListener((message) => {
  if (message.action === "fillDataResponse") {
    if (message.data) {
      document.querySelector("#progress").innerText = message.data;
    }
    if (message.error) {
      document.querySelector("#error").innerText = message.error;
    }
    if (message.done) {
      document.querySelector("#run").ariaBusy = false;
    }
  }
});
