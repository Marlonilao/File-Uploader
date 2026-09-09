const { body, validationResult } = require('express-validator');
const passport = require('passport');

const getLogin = (req, res) => {
  res.render('login');
};

const postLogin = [
  // Validate and sanitize input fields
  body('username').trim().notEmpty().withMessage('Username is required.'),
  body('password').trim().notEmpty().withMessage('Password is required.'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('login', { errors: errors.array() });
    }

    passport.authenticate('local', (err, user, info) => {
      if (err) return next(err);

      if (!user) {
        return res.status(401).render('login', {
          errors: [{ msg: info?.message || 'Invalid username or password.' }],
        });
      }

      req.logIn(user, (err) => {
        if (err) return next(err);

        // Send them back to whatever page bounced them to login.
        const redirectTo = req.session.returnTo || '/';
        delete req.session.returnTo;

        return res.redirect(redirectTo);
      });
    })(req, res, next);
  },
];

module.exports = {
  getLogin,
  postLogin,
};
