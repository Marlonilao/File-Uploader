require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const path = require('path');
const session = require('express-session');
const prisma = require('./lib/prisma');
const { PrismaSessionStore } = require('@quixo3/prisma-session-store');
const passport = require('passport');
const { requireAuth } = require('./middlewares/auth');

require('./passport');

const app = express();

app.use(morgan('dev'));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    store: new PrismaSessionStore(prisma, {
      checkPeriod: 2 * 60 * 1000, //ms
      dbRecordIdIsSessionId: true,
      dbRecordIdFunction: undefined,
    }),
  }),
);
app.use(passport.initialize());
app.use(passport.session());

app.get('/', requireAuth, (req, res) => {
  res.render('index', { user: req.user });
});

app.use('/signup', require('./routes/signupRouter'));
app.use('/login', require('./routes/loginRouter'));
app.use('/logout', require('./routes/logoutRouter'));
app.use('/folders', require('./routes/folderRouter'));

module.exports = app;
