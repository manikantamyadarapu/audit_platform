const demoVideoService = require('../services/demoVideo.service');
const SuccessResponse = require('../utils/successResponse');
const ErrorResponse = require('../utils/errorResponse');
const logger = require('../utils/logger');

async function listModules(req, res, next) {
  try {
    const data = await demoVideoService.listModules();
    return SuccessResponse(res, 'Demo video modules fetched', data);
  } catch (error) {
    logger.error('Demo video modules list failed', { message: error.message });
    return next(error);
  }
}

async function listActive(req, res, next) {
  try {
    const data = await demoVideoService.listActive();
    return SuccessResponse(res, 'Active demo videos fetched', data);
  } catch (error) {
    logger.error('Demo video active list failed', { message: error.message });
    return next(error);
  }
}

async function listAll(req, res, next) {
  try {
    const data = await demoVideoService.listAll();
    return SuccessResponse(res, 'Demo videos fetched', data);
  } catch (error) {
    logger.error('Demo video admin list failed', { message: error.message });
    return next(error);
  }
}

async function getByModule(req, res, next) {
  try {
    const data = await demoVideoService.getActiveByModule(req.params.module);
    if (!data) {
      return ErrorResponse(res, 404, 'No active demo video for this module');
    }
    return SuccessResponse(res, 'Demo video fetched', data);
  } catch (error) {
    if (error.statusCode === 400) {
      return ErrorResponse(res, 400, error.message);
    }
    logger.error('Demo video by module failed', {
      module: req.params.module,
      message: error.message,
    });
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const data = await demoVideoService.create(req.body || {});
    return SuccessResponse(res, 'Demo video created', data, 201);
  } catch (error) {
    if (error.statusCode) {
      return ErrorResponse(res, error.statusCode, error.message);
    }
    logger.error('Demo video create failed', { message: error.message });
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return ErrorResponse(res, 400, 'Invalid demo video id');
    }
    const data = await demoVideoService.update(id, req.body || {});
    return SuccessResponse(res, 'Demo video updated', data);
  } catch (error) {
    if (error.statusCode) {
      return ErrorResponse(res, error.statusCode, error.message);
    }
    logger.error('Demo video update failed', { message: error.message });
    return next(error);
  }
}

async function deactivate(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return ErrorResponse(res, 400, 'Invalid demo video id');
    }
    const data = await demoVideoService.deactivate(id);
    return SuccessResponse(res, 'Demo video deactivated', data);
  } catch (error) {
    if (error.statusCode) {
      return ErrorResponse(res, error.statusCode, error.message);
    }
    logger.error('Demo video deactivate failed', { message: error.message });
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return ErrorResponse(res, 400, 'Invalid demo video id');
    }
    const data = await demoVideoService.remove(id);
    return SuccessResponse(res, 'Demo video deleted', data);
  } catch (error) {
    if (error.statusCode) {
      return ErrorResponse(res, error.statusCode, error.message);
    }
    logger.error('Demo video delete failed', { message: error.message });
    return next(error);
  }
}

module.exports = {
  listModules,
  listActive,
  listAll,
  getByModule,
  create,
  update,
  deactivate,
  remove,
};
