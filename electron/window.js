'use strict';
let mainWindow = null;

module.exports = {
  set(win) {
    mainWindow = win;
  },
  get() {
    return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
  },
};
