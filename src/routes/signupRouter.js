const { Router } = require('express');
const router = Router();
const controller = require('../controllers/signupController');

router.get('/', controller.getSignupPage);

router.post('/', controller.handleSignup);

module.exports = router;
