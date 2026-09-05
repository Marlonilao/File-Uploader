const { Router } = require('express');
const router = Router();
const controller = require('../controllers/loginController');

router.get('/', controller.getLogin);

router.post('/', controller.postLogin);

module.exports = router;
