const prisma = require('../lib/prisma');
const { supabase } = require('../lib/storage');
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
    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .createSignedUrl(file.storedAt, 60, {
        download: file.name,
      });
    if (error) throw error;

    res.redirect(data.signedUrl);
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

    const { error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .remove([file.storedAt]);
    if (error) throw error;

    await prisma.file.delete({ where: { id: file.id } });

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
