const path = require('node:path');
const prisma = require('../lib/prisma');
const fs = require('node:fs/promises');

// Same ownership pattern as folders: the userId in the where clause is what
// stops one user from reading another user's file by guessing an id.
async function loadFile(fileId, userId) {
  return prisma.file.findFirst({
    where: { id: fileId, userId },
    include: { folder: true },
  });
}

const getFile = async (req, res, next) => {
  try {
    const file = await loadFile(Number(req.params.id), req.user.id);
    if (!file)
      return res
        .status(404)
        .render('error', { status: 404, message: 'Folder not found.' });

    res.render('file', { user: req.user, file });
  } catch (err) {
    next(err);
  }
};

const downloadFile = async (req, res, next) => {
  try {
    const file = await loadFile(Number(req.params.id), req.user.id);
    if (!file)
      return res
        .status(404)
        .render('error', { status: 404, message: 'Folder not found.' });

    const diskPath = path.join(__dirname, '../uploads', file.storedAt);

    // res.download sets Content-Disposition so the browser saves the file
    // instead of trying to display it. The second argument is the name the
    // user sees in their downloads folder — the original, not the random one.
    res.download(diskPath, file.name);
  } catch (err) {
    next(err);
  }
};

const deleteFile = async (req, res, next) => {
  try {
    const file = await loadFile(Number(req.params.id), req.user.id);
    if (!file)
      return res
        .status(404)
        .render('error', { status: 404, message: 'Folder not found.' });

    const diskPath = path.join(__dirname, '../uploads', file.storedAt);

    // Delete the row first. If the disk delete fails we are left with an
    // orphaned file, which is harmless. The other order would leave a row
    // pointing at nothing, which breaks the download route.
    await prisma.file.delete({ where: { id: file.id } });

    // ENOENT means the file was already gone — nothing to clean up, so it is
    // not worth failing the request over.
    await fs.unlink(diskPath).catch((err) => {
      if (err.code !== 'ENOENT') throw err;
    });

    res.redirect(`/folders/${file.folder.id}`);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getFile,
  downloadFile,
  deleteFile,
};
