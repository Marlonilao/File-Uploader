const { Router } = require('express');
const router = Router();
const controller = require('../controllers/logoutController');

router.post('/', controller.logout);

module.exports = router;
