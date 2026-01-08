const { app, BrowserWindow } = require("electron");
const path = require("path");

// Detecta se está em desenvolvimento
const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: "Battle Realm",
    icon: path.join(__dirname, "../public/favicon.ico"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
    // Visual
    backgroundColor: "#1a1a2e",
    show: false, // Mostra apenas quando pronto
  });

  // Remove menu padrão (opcional)
  mainWindow.setMenuBarVisibility(false);

  // Carrega o app
  if (isDev) {
    // Em desenvolvimento, carrega do servidor Vite
    mainWindow.loadURL("http://localhost:5173");
    // Abre DevTools automaticamente em dev
    mainWindow.webContents.openDevTools();
  } else {
    // Em produção, carrega os arquivos buildados
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // Mostra a janela quando estiver pronta
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Tratamento de erros de carregamento
  mainWindow.webContents.on("did-fail-load", () => {
    console.error(
      "Falha ao carregar. Certifique-se que o servidor Vite está rodando (npm run dev)"
    );
  });
}

// Quando o Electron estiver pronto
app.whenReady().then(() => {
  createWindow();

  // macOS: recria janela quando clica no dock e não há janelas
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Fecha o app quando todas as janelas são fechadas (exceto macOS)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
