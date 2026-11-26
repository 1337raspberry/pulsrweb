// The desktop app: one window showing the same page the site serves, built into `dist`.
// What the app adds is the computer's own sound. Where a browser makes the visitor pick a
// tab or a screen to share, the page's request is answered here, with whatever the
// computer is playing and no picker.

import { app, BrowserWindow, Menu, net, protocol, session, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const BUILT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
// The built page is served from an address of the app's own, so that it runs as a site
// does: its paths start at `/` and the browser counts it as secure, which sound capture
// and the analyser's worklet both need.
const SCHEME = 'app';
const HOME = `${SCHEME}://pulsr/`;
// `--dev` shows the page from Vite's dev server instead, for working on it.
const DEV = process.argv.includes('--dev');
const START = DEV ? 'http://localhost:8137/' : HOME;
// What the page may ask for: sound inputs and capture, the full screen, and the clipboard
// for copying a link.
const ALLOWED = new Set(['media', 'display-capture', 'fullscreen', 'clipboard-sanitized-write']);

const ours = (url) => typeof url === 'string' && url.startsWith(START);

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

// Chromium on Linux hears the computer's sound through PulseAudio or PipeWire only with
// this switched on.
if (process.platform === 'linux') app.commandLine.appendSwitch('enable-features', 'PulseaudioLoopbackForScreenShare');

// A file of the built page, or nothing for an address that leads outside it.
function serve(request) {
  const { host, pathname } = new URL(request.url);
  const file = path.join(BUILT, decodeURIComponent(pathname === '/' ? '/index.html' : pathname));
  const inside = path.relative(BUILT, file);
  if (host !== 'pulsr' || inside.startsWith('..') || path.isAbsolute(inside)) return new Response(null, { status: 404 });
  return net.fetch(pathToFileURL(file).toString());
}

function wire() {
  if (!DEV) protocol.handle(SCHEME, serve);

  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback, details) => {
    callback(ours(details.requestingUrl) && ALLOWED.has(permission));
  });

  // The page's request to share a screen. A share has to carry a picture, so it gets the
  // window's own, which the page drops at once; the sound is the computer's.
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    if (!request.frame || !ours(request.frame.url)) callback(null);
    else callback({ video: request.frame, audio: 'loopback' });
  });
}

function menu() {
  const mac = process.platform === 'darwin';
  return Menu.buildFromTemplate([
    ...(mac ? [{ role: 'appMenu' }] : []),
    { label: 'View', submenu: [{ role: 'togglefullscreen' }, { role: 'reload' }, { role: 'toggleDevTools' }] },
    { role: 'windowMenu' },
  ]);
}

function open() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 420,
    minHeight: 320,
    title: 'pulsr',
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    show: false,
  });
  window.once('ready-to-show', () => window.show());
  // Links leave for the visitor's browser, and the window stays on the page.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!ours(url)) event.preventDefault();
  });
  window.loadURL(START);
}

app.whenReady().then(() => {
  wire();
  Menu.setApplicationMenu(menu());
  open();
  // A Mac's apps stay open without a window, and get one back from the dock.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) open();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
