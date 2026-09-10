const prisma = require('../lib/prisma');

async function findAll({ activeOnly = false } = {}) {
  return prisma.demoVideo.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
  });
}

async function findById(id) {
  return prisma.demoVideo.findUnique({ where: { id } });
}

async function findByModule(module, { activeOnly = false } = {}) {
  return prisma.demoVideo.findFirst({
    where: {
      module,
      ...(activeOnly ? { isActive: true } : {}),
    },
  });
}

async function create(data) {
  return prisma.demoVideo.create({ data });
}

async function update(id, data) {
  return prisma.demoVideo.update({
    where: { id },
    data,
  });
}

async function softDeactivate(id) {
  return prisma.demoVideo.update({
    where: { id },
    data: { isActive: false },
  });
}

async function remove(id) {
  return prisma.demoVideo.delete({ where: { id } });
}

module.exports = {
  findAll,
  findById,
  findByModule,
  create,
  update,
  softDeactivate,
  remove,
};
