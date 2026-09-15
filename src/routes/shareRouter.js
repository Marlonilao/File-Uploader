const { Router } = require('express');
const {
  getShare,
  getSharedFolder,
  downloadSharedFile,
} = require('../controllers/shareController');

const shareRouter = Router();

// No requireAuth here. The token is the credential — that is the whole
// point of a share link.
shareRouter.get('/:token', getShare);
shareRouter.get('/:token/folders/:id', getSharedFolder);
shareRouter.get('/:token/files/:id', downloadSharedFile);

module.exports = shareRouter;
