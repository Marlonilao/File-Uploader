const prisma = require('../lib/prisma');
const path = require('node:path');
const { body, validationResult } = require('express-validator');
const crypto = require('node:crypto');
const { supabase } = require('../lib/storage');

// Walks up the parent chain so the view can render a breadcrumb.
// Root first, and the folder itself is not included.
async function buildBreadcrumb(folder) {
  const crumbs = [];
  let current = folder;

  while (current.parentId) {
    current = await prisma.folder.findUnique({
      where: { id: current.parentId },
    });

    crumbs.unshift(current);
  }
  return crumbs;
}

// Both getFolder and the validation-error path need the same data, so the
// query lives in one place. The userId is the ownership check — without it,
// any logged-in user could read any folder by guessing an id.
async function loadFolder(folderId, userId) {
  return prisma.folder.findFirst({
    where: { id: folderId, userId },
    include: {
      children: { orderBy: { name: 'asc' } },
      files: { orderBy: { name: 'asc' } },
    },
  });
}
// Walks down the folder tree and returns every file inside it, at any depth.
// Cascade delete removes the rows, but nothing removes the files on disk —
// so we collect them first while the rows still exist.
async function collectFilesInTree(folderId) {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    include: { children: true, files: true },
  });

  let collected = [...folder.files];

  for (const child of folder.children) {
    const fromChild = await collectFilesInTree(child.id);
    collected = collected.concat(fromChild);
  }

  return collected;
}

const getFolder = async (req, res, next) => {
  try {
    const folder = await loadFolder(Number(req.params.id), req.user.id);

    if (!folder) {
      return res
        .status(404)
        .render('error', { status: 404, message: 'Folder not found.' });
    }

    const ancestors = await buildBreadcrumb(folder);

    const shareToken = req.query.share || null;

    // Built from the request so it works on localhost and in production
    // without a hardcoded host.
    const shareUrl = shareToken
      ? `${req.protocol}://${req.get('host')}/share/${shareToken}`
      : null;

    res.render('folder', {
      user: req.user,
      folder,
      ancestors,
      folders: folder.children,
      files: folder.files,
      shareToken,
      shareUrl,
    });
  } catch (err) {
    next(err);
  }
};

// The name rules are the same for both, so they live in one place. Each
// array below adds its own duplicate check on top, because "duplicate"
// means something different on create than on rename.
const nameRules = () =>
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Folder name is required.')
    .isLength({ max: 120 })
    .withMessage('Folder name must be 120 characters or fewer.')
    .matches(/^[^/\\:*?"<>|]+$/)
    .withMessage('Folder name cannot contain / \\ : * ? " < > or |');

// On create the route id is the parent folder, so we look for a sibling
// with the same name inside it.
const validateFolderCreate = [
  nameRules(),

  body('name').custom(async (name, { req }) => {
    const existing = await prisma.folder.findFirst({
      where: {
        name: name.trim(),
        userId: req.user.id,
        parentId: Number(req.params.id),
      },
    });

    if (existing) {
      throw new Error('A folder with that name already exists here.');
    }
  }),
];

// On rename the route id is the folder itself, so we compare against its
// siblings — and a folder keeping its own name is not a conflict.
const validateFolderRename = [
  nameRules(),

  body('name').custom(async (name, { req }) => {
    const folderId = Number(req.params.id);

    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder) return;

    const existing = await prisma.folder.findFirst({
      where: {
        name: name.trim(),
        userId: req.user.id,
        parentId: folder.parentId,
        id: { not: folder.id },
      },
    });

    if (existing) {
      throw new Error('A folder with that name already exists here.');
    }
  }),
];

const postFolder = [
  ...validateFolderCreate,

  async (req, res, next) => {
    try {
      const parent = await loadFolder(Number(req.params.id), req.user.id);

      // The 404 comes first. There is no point showing a validation message
      // for a folder the user cannot write to anyway.
      if (!parent) {
        return res
          .status(404)
          .render('error', { status: 404, message: 'Folder not found.' });
      }

      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        const ancestors = await buildBreadcrumb(parent);

        return res.status(400).render('folder', {
          user: req.user,
          folder: parent,
          ancestors,
          folders: parent.children,
          files: parent.files,
          errors: errors.array(),
          shareToken: null,
          shareUrl: null,
        });
      }

      await prisma.folder.create({
        data: {
          name: req.body.name.trim(),
          userId: req.user.id,
          parentId: parent.id,
        },
      });

      res.redirect(`/folders/${parent.id}`);
    } catch (err) {
      next(err);
    }
  },
];

const postFile = async (req, res, next) => {
  try {
    const folderId = Number(req.params.id);

    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId: req.user.id },
    });
    if (!folder)
      return res
        .status(404)
        .render('error', { status: 404, message: 'Folder not found.' });

    // Multer puts the parsed file on req.file. It is undefined when the
    // form was submitted with no file selected.
    if (!req.file) {
      return res
        .status(400)
        .render('error', { status: 400, message: 'No file was uploaded.' });
    }

    const extension = path.extname(req.file.originalname);
    const storagePath = `${req.user.id}/${crypto.randomUUID()}${extension}`;

    console.log('path:', JSON.stringify(storagePath));
    const { error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
      });

    if (error) throw error;

    await prisma.file.create({
      data: {
        name: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        storedAt: storagePath,
        userId: req.user.id,
        folderId: folder.id,
      },
    });

    res.redirect(`/folders/${folder.id}`);
  } catch (err) {
    next(err);
  }
};

const deleteFolder = async (req, res, next) => {
  try {
    const folderId = Number(req.params.id);

    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId: req.user.id },
    });

    if (!folder) {
      return res
        .status(404)
        .render('error', { status: 404, message: 'Folder not found.' });
    }

    if (!folder.parentId) {
      return res.status(400).render('error', {
        status: 400,
        message: 'The root folder cannot be deleted.',
      });
    }

    const parentId = folder.parentId;

    // Read the list before deleting, because the rows are gone afterwards.
    const files = await collectFilesInTree(folder.id);

    await prisma.folder.delete({ where: { id: folder.id } });

    const { error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .remove(files.map((file) => file.storedAt));
    if (error) throw error;

    res.redirect(`/folders/${parentId}`);
  } catch (err) {
    next(err);
  }
};

const renameFolder = [
  ...validateFolderRename,

  async (req, res, next) => {
    try {
      const folder = await loadFolder(Number(req.params.id), req.user.id);

      if (!folder) {
        return res
          .status(404)
          .render('error', { status: 404, message: 'Folder not found.' });
      }

      // Renaming the root would rename the user's whole drive, and the view
      // hides the form there anyway.
      if (!folder.parentId) {
        return res.status(400).render('error', {
          status: 400,
          message: 'The root folder cannot be renamed.',
        });
      }

      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        const ancestors = await buildBreadcrumb(folder);

        return res.status(400).render('folder', {
          user: req.user,
          folder,
          ancestors,
          folders: folder.children,
          files: folder.files,
          errors: errors.array(),
          shareToken: null,
          shareUrl: null,
        });
      }

      await prisma.folder.update({
        where: { id: folder.id },
        data: { name: req.body.name.trim() },
      });

      res.redirect(`/folders/${folder.id}`);
    } catch (err) {
      next(err);
    }
  },
];

module.exports = {
  getFolder,
  postFolder,
  postFile,
  deleteFolder,
  renameFolder,
};
