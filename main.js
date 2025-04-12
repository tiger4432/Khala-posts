const { app, BrowserWindow, screen, ipcMain } = require("electron");

// 상수 정의
const WINDOW_CONFIG = {
  SIDEBAR_WIDTH: 400,
  COMPRESSED_HEIGHT: 100,
  OPACITY: 1,
};

class WindowManager {
  constructor() {
    this.win = null;
    this.isVerticalExpanded = true;
    this.savedHeight = null;
  }

  createWindow(position = "left") {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    const x = position === "left" ? 0 : width - WINDOW_CONFIG.SIDEBAR_WIDTH;
    const y = 0;

    this.win = new BrowserWindow({
      width: WINDOW_CONFIG.SIDEBAR_WIDTH,
      height: height,
      autoHideMenuBar: true,
      x,
      y,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    this.win.setOpacity(WINDOW_CONFIG.OPACITY);
    this.savedHeight = height;
    this.win.loadFile("index.html");
  }

  changePosition(position) {
    if (!this.win) return;

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const [currentWidth, currentHeight] = this.win.getSize();
    const x = position === "left" ? 0 : width - currentWidth;
    const y = height - currentHeight;
    this.win.setPosition(x, y);
  }

  toggleVertical(isExpanded) {
    if (!this.win) return;

    const primaryDisplay = screen.getPrimaryDisplay();
    const { height: screenHeight } = primaryDisplay.workAreaSize;
    const [currentWidth] = this.win.getSize();

    if (isExpanded) {
      const newHeight = this.savedHeight || screenHeight;
      this.win.setSize(currentWidth, newHeight);
      this.win.setPosition(this.win.getPosition()[0], screenHeight - newHeight);
    } else {
      this.savedHeight = this.win.getSize()[1];
      this.win.setSize(currentWidth, WINDOW_CONFIG.COMPRESSED_HEIGHT);
      this.win.setPosition(
        this.win.getPosition()[0],
        screenHeight - WINDOW_CONFIG.COMPRESSED_HEIGHT
      );
    }
  }
}

const windowManager = new WindowManager();

// 앱 이벤트 핸들러
app.whenReady().then(() => {
  windowManager.createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// IPC 핸들러
ipcMain.on("change-position", (event, position) => {
  windowManager.changePosition(position);
});

ipcMain.on("toggle-vertical", (event, isExpanded) => {
  windowManager.toggleVertical(isExpanded);
});
