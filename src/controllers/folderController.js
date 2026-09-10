const prisma = require('../lib/prisma');

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

const getFolder = async (req, res, next) => {
  try {
    const folderId = Number(req.params.id);

    // The userId in the where clause is the ownership check. Without it,
    // any logged-in user could read any folder by guessing an id.
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId: req.user.id },
      include: {
        children: { orderBy: { name: 'asc' } },
        files: { orderBy: { name: 'asc' } },
      },
    });

    if (!folder)
      return res.status(404).render('error', { message: 'Folder not found.' });

    const ancestors = await buildBreadcrumb(folder);

    res.render('folder', {
      user: req.user,
      folder,
      ancestors,
      folders: folder.children,
      files: folder.files,
    });
  } catch (err) {
    next(err);
  }
};

const postFolder = async (req, res, next) => {
  try {
    const parentId = Number(req.params.id);
    const name = req.body.name.trim();

    // Confirm the parent belongs to this user before writing anything into it.
    const parent = await prisma.folder.findFirst({
      where: { id: parentId, userId: req.user.id },
    });

    if (!parent)
      return res.status(404).render('error', { message: 'Folder not found.' });

    await prisma.folder.create({
      data: {
        name,
        userId: req.user.id,
        parentId: parent.id,
      },
    });

    res.redirect(`/folders/${parent.id}`);
  } catch (err) {
    next(err);
  }
};

const postFile = async (req, res, next) => {
  try {
    const folderId = Number(req.params.id);

    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId: req.user.id },
    });
    if (!folder)
      return res.status(404).render('error', { message: 'Folder not found.' });

    // Multer puts the parsed file on req.file. It is undefined when the
    // form was submitted with no file selected.
    if (!req.file) {
      return res
        .status(400)
        .render('error', { message: 'No file was uploaded.' });
    }

    await prisma.file.create({
      data: {
        name: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        storedAt: req.file.filename,
        userId: req.user.id,
        folderId: folder.id,
      },
    });

    res.redirect(`/folders/${folder.id}`);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getFolder,
  postFolder,
  postFile,
};
