import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron';
import { join } from 'node:path';

/**
 * The tray icon and the application menu.
 *
 * The client keeps running in the tray, so a message from an assistant can
 * reach the user while the window is closed. The menu carries the shortcuts
 * a desktop app owes the platform.
 */

let tray: Tray | null = null;

function trayIconPath(): string {
  const fromPackage = join(process.resourcesPath ?? '', 'icons', 'icon.png');
  return app.isPackaged ? fromPackage : join(__dirname, '../../build/icon.png');
}

export function createTray(show: () => void, quit: () => void): Tray | null {
  if (tray) return tray;
  try {
    const icon = nativeImage.createFromPath(trayIconPath());
    if (icon.isEmpty()) return null;
    tray = new Tray(icon.resize({ width: 16, height: 16 }));
    tray.setToolTip('ZeroX');
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Open ZeroX', click: show },
        { type: 'separator' },
        { label: 'Quit', click: quit },
      ]),
    );
    tray.on('click', show);
    return tray;
  } catch {
    return null;
  }
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}

/**
 * The application menu.
 *
 * The standard roles carry the shortcuts the platform expects: copy, paste,
 * undo, reload, zoom.
 */
export function installMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(app.isPackaged
      ? []
      : [
          {
            label: 'Development',
            submenu: [
              { role: 'reload' as const },
              { role: 'forceReload' as const },
              { role: 'toggleDevTools' as const },
            ],
          },
        ]),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'close' }] },
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/** Bring a window forward, and make one when there is none. */
export function revealWindow(windows: BrowserWindow[], create: () => BrowserWindow): void {
  const existing = windows[0];
  if (existing) {
    if (existing.isMinimized()) existing.restore();
    existing.show();
    existing.focus();
    return;
  }
  create();
}
