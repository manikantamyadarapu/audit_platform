const demoVideoRepository = require('../repositories/demoVideo.repository');
const { extractYoutubeVideoId, validateAndNormalizeYoutubeUrl } = require('../utils/youtube.util');
const {
  DEMO_VIDEO_MODULES,
  isValidDemoModule,
} = require('../constants/demoVideoModules');

function toPublicVideo(video) {
  if (!video) return null;
  const videoId = extractYoutubeVideoId(video.youtubeUrl);
  return {
    id: video.id,
    module: video.module,
    title: video.title,
    youtubeUrl: video.youtubeUrl,
    videoId,
    embedUrl: videoId ? `https://www.youtube.com/embed/${videoId}` : null,
    description: video.description,
    isActive: video.isActive,
    displayOrder: video.displayOrder,
    createdAt: video.createdAt,
    updatedAt: video.updatedAt,
  };
}

async function listModules() {
  return DEMO_VIDEO_MODULES;
}

async function listActive() {
  const videos = await demoVideoRepository.findAll({ activeOnly: true });
  return videos.map(toPublicVideo);
}

async function listAll() {
  const videos = await demoVideoRepository.findAll({ activeOnly: false });
  return videos.map(toPublicVideo);
}

async function getActiveByModule(module) {
  if (!isValidDemoModule(module)) {
    const error = new Error('Unknown demo video module');
    error.statusCode = 400;
    throw error;
  }

  const video = await demoVideoRepository.findByModule(module, { activeOnly: true });
  return toPublicVideo(video);
}

async function getById(id) {
  const video = await demoVideoRepository.findById(id);
  if (!video) {
    const error = new Error('Demo video not found');
    error.statusCode = 404;
    throw error;
  }
  return toPublicVideo(video);
}

function buildPayload(input, { partial = false } = {}) {
  const data = {};

  if (!partial || input.module !== undefined) {
    const module = String(input.module || '').trim();
    if (!isValidDemoModule(module)) {
      const error = new Error('Invalid module. Choose a supported audit module.');
      error.statusCode = 400;
      throw error;
    }
    data.module = module;
  }

  if (!partial || input.title !== undefined) {
    const title = String(input.title || '').trim();
    if (!title) {
      const error = new Error('Title is required');
      error.statusCode = 400;
      throw error;
    }
    data.title = title.slice(0, 200);
  }

  if (!partial || input.youtubeUrl !== undefined) {
    const normalized = validateAndNormalizeYoutubeUrl(input.youtubeUrl);
    data.youtubeUrl = normalized.youtubeUrl;
  }

  if (!partial || input.description !== undefined) {
    data.description =
      input.description == null || String(input.description).trim() === ''
        ? null
        : String(input.description).trim();
  }

  if (!partial || input.isActive !== undefined) {
    data.isActive = Boolean(input.isActive);
  }

  if (!partial || input.displayOrder !== undefined) {
    const order = Number(input.displayOrder);
    if (!Number.isFinite(order)) {
      const error = new Error('Display order must be a number');
      error.statusCode = 400;
      throw error;
    }
    data.displayOrder = Math.trunc(order);
  }

  return data;
}

async function create(input) {
  const data = buildPayload(
    {
      module: input.module,
      title: input.title,
      youtubeUrl: input.youtubeUrl,
      description: input.description,
      isActive: input.isActive !== undefined ? input.isActive : true,
      displayOrder: input.displayOrder !== undefined ? input.displayOrder : 0,
    },
    { partial: false }
  );

  const existing = await demoVideoRepository.findByModule(data.module);
  if (existing) {
    const error = new Error('A demo video already exists for this module');
    error.statusCode = 409;
    throw error;
  }

  const video = await demoVideoRepository.create(data);
  return toPublicVideo(video);
}

async function update(id, input) {
  const existing = await demoVideoRepository.findById(id);
  if (!existing) {
    const error = new Error('Demo video not found');
    error.statusCode = 404;
    throw error;
  }

  const data = buildPayload(input, { partial: true });

  if (data.module && data.module !== existing.module) {
    const conflict = await demoVideoRepository.findByModule(data.module);
    if (conflict && conflict.id !== id) {
      const error = new Error('A demo video already exists for this module');
      error.statusCode = 409;
      throw error;
    }
  }

  const video = await demoVideoRepository.update(id, data);
  return toPublicVideo(video);
}

async function deactivate(id) {
  const existing = await demoVideoRepository.findById(id);
  if (!existing) {
    const error = new Error('Demo video not found');
    error.statusCode = 404;
    throw error;
  }

  const video = await demoVideoRepository.softDeactivate(id);
  return toPublicVideo(video);
}

async function remove(id) {
  const existing = await demoVideoRepository.findById(id);
  if (!existing) {
    const error = new Error('Demo video not found');
    error.statusCode = 404;
    throw error;
  }

  await demoVideoRepository.remove(id);
  return { id };
}

module.exports = {
  listModules,
  listActive,
  listAll,
  getActiveByModule,
  getById,
  create,
  update,
  deactivate,
  remove,
};
