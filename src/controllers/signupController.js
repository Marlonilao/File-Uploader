const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

const getSignupPage = (req, res) => {
  res.render('signup');
};

const validateUser = [
  body('firstName')
    .trim()
    .notEmpty()
    .matches(/^[A-Za-z]+(?: [A-Za-z]+)*$/)
    .withMessage('First name must only contain letters and single spaces'),
  body('lastName')
    .trim()
    .notEmpty()
    .isAlpha()
    .withMessage('Last name must only contain letters'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Valid email is required')
    .custom(async (email) => {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new Error('Email already in use');
      }
    }),
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .custom(async (username) => {
      const existingUser = await prisma.user.findUnique({
        where: { username },
      });
      if (existingUser) {
        throw new Error('Username already in use');
      }
    }),
  body('password')
    .trim()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('confirmPassword')
    .trim()
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
];

const handleSignup = [
  ...validateUser,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('signup', { errors: errors.array() });
    }

    try {
      const { firstName, lastName, username, email, password } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);
      await prisma.user.create({
        data: {
          firstName,
          lastName,
          username,
          email,
          password: hashedPassword,

          folders: {
            create: { name: 'My files' },
          },
        },
      });
      res.redirect('login');
    } catch (error) {
      console.error(error);
      res.status(500).send('Error signing up');
    }
  },
];

module.exports = {
  getSignupPage,
  handleSignup,
};
