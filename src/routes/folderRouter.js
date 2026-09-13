const { Router } = require('express');
const { requireAuth } = require('../middlewares/auth');
const {
  getFolder,
  postFolder,
  postFile,
  deleteFolder,
  renameFolder,
} = require('../controllers/folderController');
const { upload } = require('../middlewares/upload');

const folderRouter = Router();

// Every folder route needs a logged-in user, so the guard goes on the router
// instead of being repeated on each route.
folderRouter.use(requireAuth);

folderRouter.get('/:id', getFolder);
folderRouter.post('/:id/children', postFolder);
// upload.single('file') runs before the controller and populates req.file.
// The string must match the name attribute on the form's file input.
folderRouter.post('/:id/files', upload.single('file'), postFile);

folderRouter.post('/:id/delete', deleteFolder);

folderRouter.post('/:id/rename', renameFolder);

module.exports = folderRouter;
