const { Router } = require('express');
const router = Router();
const controller = require('../controllers/logoutController');

router.get('/', controller.logout);

module.exports = router;
