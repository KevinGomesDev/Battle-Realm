const { contextBridge } = require("electron");

// Expõe APIs seguras para o renderer
contextBridge.exposeInMainWorld("electronAPI", {
  // Informações do ambiente
  isElectron: true,
  platform: process.platform,

  // Adicione mais APIs conforme necessário
  // Exemplo: notificações, file system, etc.
});
