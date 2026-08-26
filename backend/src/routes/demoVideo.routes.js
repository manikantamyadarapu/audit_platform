const express = require('express');
const demoVideoController = require('../controllers/demoVideo.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

const router = express.Router();

router.use(authenticate);

// Any signed-in role can watch active videos
router.get('/modules', demoVideoController.listModules);
router.get('/active', demoVideoController.listActive);
router.get('/module/:module', demoVideoController.getByModule);

// Admin-only management
router.get('/', authorize(['ADMIN', 'SUPER_ADMIN']), demoVideoController.listAll);
router.post('/', authorize(['ADMIN', 'SUPER_ADMIN']), demoVideoController.create);
router.patch('/:id/deactivate', authorize(['ADMIN', 'SUPER_ADMIN']), demoVideoController.deactivate);
router.put('/:id', authorize(['ADMIN', 'SUPER_ADMIN']), demoVideoController.update);
router.patch('/:id', authorize(['ADMIN', 'SUPER_ADMIN']), demoVideoController.update);
router.delete('/:id', authorize(['ADMIN', 'SUPER_ADMIN']), demoVideoController.remove);

module.exports = router;
