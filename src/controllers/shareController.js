const prisma = require('../lib/prisma');
const path = require('node:path');

const DURATIONS = {
  '1d': 1,
  '10d': 10,
  '30d': 30,
};

// Looks up a share and rejects it if it is missing or past its expiry.
// Returns null in both cases — the caller decides which message to show.
async function loadValidShare(token) {
  const share = await prisma.share.findUnique({
    where: { token },
    include: { folder: true },
  });

  if (!share) return null;
  if (share.expiresAt < new Date()) return null;

  return share;
}

// Walks up from a folder to see whether it sits inside rootId. A share only
// grants access to its own subtree, so every id from the URL has to be
// checked against it — otherwise any token would unlock the whole drive.
async function isInsideTree(folderId, rootId) {
  let currentId = folderId;

  while (currentId) {
    if (currentId === rootId) return true;

    const folder = await prisma.folder.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });

    if (!folder) return false;

    currentId = folder.parentId;
  }

  return false;
}

// Creates the link. This one is authenticated — only the owner can share.
const createShare = async (req, res, next) => {
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

    const days = DURATIONS[req.body.duration];

    if (!days) {
      return res
        .status(400)
        .render('error', { status: 400, message: 'Pick a valid duration.' });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    const share = await prisma.share.create({
      data: { folderId: folder.id, expiresAt },
    });

    res.redirect(`/folders/${folder.id}?share=${share.token}`);
  } catch (err) {
    next(err);
  }
};

// The share root. Redirects into the folder route so both paths render
// through the same code.
const getShare = async (req, res, next) => {
  try {
    const share = await loadValidShare(req.params.token);

    if (!share) {
      return res.status(404).render('error', {
        status: 404,
        message: 'That link does not exist or has expired.',
      });
    }

    res.redirect(`/share/${share.token}/folders/${share.folderId}`);
  } catch (err) {
    next(err);
  }
};

const getSharedFolder = async (req, res, next) => {
  try {
    const share = await loadValidShare(req.params.token);

    if (!share) {
      return res.status(404).render('error', {
        status: 404,
        message: 'That link does not exist or has expired.',
      });
    }

    const folderId = Number(req.params.id);

    if (!(await isInsideTree(folderId, share.folderId))) {
      return res
        .status(404)
        .render('error', { status: 404, message: 'Folder not found.' });
    }

    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      include: {
        children: { orderBy: { name: 'asc' } },
        files: { orderBy: { name: 'asc' } },
      },
    });

    res.render('share', {
      share,
      folder,
      folders: folder.children,
      files: folder.files,
      isRoot: folder.id === share.folderId,
    });
  } catch (err) {
    next(err);
  }
};

const downloadSharedFile = async (req, res, next) => {
  try {
    const share = await loadValidShare(req.params.token);

    if (!share) {
      return res.status(404).render('error', {
        status: 404,
        message: 'That link does not exist or has expired.',
      });
    }

    const file = await prisma.file.findUnique({
      where: { id: Number(req.params.id) },
    });

    // The file's folder is what gets checked, not the file itself — a file
    // is reachable exactly when the folder holding it is.
    if (!file || !(await isInsideTree(file.folderId, share.folderId))) {
      return res
        .status(404)
        .render('error', { status: 404, message: 'File not found.' });
    }

    const diskPath = path.join(__dirname, '../uploads', file.storedAt);

    res.download(diskPath, file.name);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createShare,
  getShare,
  getSharedFolder,
  downloadSharedFile,
};
