const fakeApp = { name: '[DEFAULT]', options: {}, automaticDataCollectionEnabled: false };
module.exports = {
  initializeApp: () => fakeApp,
  getApps: () => [fakeApp],
  getApp: () => fakeApp,
};
