// ScreenShield — toolbar icon opens the redaction mirror.
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("app.html") });
});