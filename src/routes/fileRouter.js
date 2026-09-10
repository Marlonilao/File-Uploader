const { Router } = require('express');
const { requireAuth } = require('../middlewares/auth');
const {
  getFile,
  downloadFile,
  deleteFile,
} = require('../controllers/fileController');

const fileRouter = Router();

fileRouter.use(requireAuth);

fileRouter.get('/:id', getFile);
fileRouter.get('/:id/download', downloadFile);
fileRouter.post('/:id/delete', deleteFile);

module.exports = fileRouter;
