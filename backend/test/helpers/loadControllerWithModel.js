const Module = require('node:module');

function loadControllerWithModel(controllerPath, modelRequest, model) {
  const originalLoad = Module._load;
  Module._load = function load(request, parent, isMain) {
    if (request === modelRequest && parent.filename === controllerPath) {
      return model;
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    delete require.cache[controllerPath];
    return require(controllerPath);
  } finally {
    Module._load = originalLoad;
  }
}

module.exports = { loadControllerWithModel };
