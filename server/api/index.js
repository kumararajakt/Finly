const { bootstrap } = require('../dist/bootstrap');

let appPromise = null;

function getApp() {
  if (!appPromise) {
    appPromise = bootstrap({
      migrate: process.env.AUTO_MIGRATE === 'true',
    }).then((app) => app.init().then(() => app));
  }
  return appPromise;
}

module.exports = async function handler(req, res) {
  const app = await getApp();
  const instance = app.getHttpAdapter().getInstance();
  instance(req, res);
};
