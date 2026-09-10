const { Router } = require('express');
const { requireAuth } = require('../middlewares/auth');
const { getFolder, postFolder } = require('../controllers/folderController');

const folderRouter = Router();

// Every folder route needs a logged-in user, so the guard goes on the router
// instead of being repeated on each route.
folderRouter.use(requireAuth);

folderRouter.get('/:id', getFolder);
folderRouter.post('/:id/children', postFolder);

module.exports = folderRouter;
