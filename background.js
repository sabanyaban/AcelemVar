// Sağ tık menüsü oluştur
browser.contextMenus.create({
  id: "acelemvar",
  title: "AcelemVar ile Oku",
  contexts: ["selection"]
});

// Seçili metni sakla
let selectedText = "";

// Menü tıklamasını dinle
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "acelemvar") {
    selectedText = info.selectionText;
    browser.browserAction.openPopup();
  }
});

// Popup açıldığında seçili metni gönder
browser.runtime.onConnect.addListener((port) => {
  if (port.name === "popup") {
    port.onMessage.addListener((msg) => {
      if (msg.command === "getInitialText") {
        port.postMessage({
          command: "setText",
          text: selectedText
        });
        selectedText = ""; // Metni temizle
      }
    });
  }
}); 