// Seçili metni almak için mesaj dinleyicisi
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === "getSelection") {
    return Promise.resolve(window.getSelection().toString());
  }
}); 