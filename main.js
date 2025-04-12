const { app, BrowserWindow, screen, ipcMain } = require("electron");

let win;
let isVerticalExpanded = true;
let savedHeight = null;

function createWindow(position = "left") {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const sidebarWidth = 400; // 사이드바 너비
  const x = position === "left" ? 0 : width - sidebarWidth;
  const y = 0; // 화면 상단에 위치

  win = new BrowserWindow({
    width: sidebarWidth,
    height: height, // 모니터 높이와 동일
    autoHideMenuBar: true,
    x: x,
    y: y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.setOpacity(1);
  savedHeight = height; // 초기 높이 저장

  win.loadFile("index.html");
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// IPC 핸들러 추가
ipcMain.on("change-position", (event, position) => {
  if (win) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const [currentWidth, currentHeight] = win.getSize();
    const x = position === "left" ? 0 : width - currentWidth;
    const y = height - currentHeight;
    win.setPosition(x, y);
  }
});

ipcMain.on("toggle-vertical", (event, isExpanded) => {
  if (win) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { height: screenHeight } = primaryDisplay.workAreaSize;
    const [currentWidth] = win.getSize();

    if (isExpanded) {
      // 저장된 높이로 복원하거나, 저장된 높이가 없으면 전체 높이 사용
      const newHeight = savedHeight || screenHeight;
      win.setSize(currentWidth, newHeight);
      win.setPosition(win.getPosition()[0], screenHeight - newHeight); // 창 높이에 맞춰 Y 위치 계산
    } else {
      // 현재 높이를 저장하고 압축
      savedHeight = win.getSize()[1];
      const compressedHeight = 100;
      win.setSize(currentWidth, compressedHeight);
      win.setPosition(win.getPosition()[0], screenHeight - compressedHeight); // 압축된 높이에 맞춰 Y 위치 계산
    }
  }
});
