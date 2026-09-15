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

app.get('/', requireAuth, async (req, res, next) => {
  try {
    const root = await prisma.folder.findFirst({
      where: { userId: req.user.id, parentId: null },
    });

    res.redirect(`/folders/${root.id}`);
  } catch (err) {
    next(err);
  }
});

app.use('/signup', require('./routes/signupRouter'));
app.use('/login', require('./routes/loginRouter'));
app.use('/logout', require('./routes/logoutRouter'));
app.use('/folders', require('./routes/folderRouter'));
app.use('/files', require('./routes/fileRouter'));
app.use('/share', require('./routes/shareRouter'));

// Nothing matched above, so this is a 404.
app.use((req, res) => {
  res.status(404).render('error', {
    status: 404,
    message: 'We could not find that page.',
  });
});

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).render('error', {
    status: 500,
    message: 'Something went wrong on our end.',
  });
});

module.exports = app;
