const path = require('path');
const fs = require('fs');
const { verifyDownloadToken } = require('../utils/downloadToken');

const safeFileName = (input) => {
  const v = String(input || '').trim();
  if (!v) return '';
  const base = path.basename(v);
  if (base !== v) return '';
  if (base.includes('..') || base.includes('/') || base.includes('\\')) return '';
  return base;
};

const sanitizeDownloadName = (input) => {
  const v = String(input || '').trim();
  const base = path.basename(v || 'download');
  return base.replace(/[\r\n"]/g, '_');
};

const downloadWithToken = (req, res, tokenInput) => {
  const token = String(tokenInput || '').trim();
  const payload = verifyDownloadToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });

  const fileKey = safeFileName(payload.p);
  if (!fileKey) return res.status(400).json({ error: 'Bad file key' });

  const downloadDir = path.join(__dirname, '..', 'storage', 'downloads');
  const filePath = path.join(downloadDir, fileKey);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

  const filename = sanitizeDownloadName(payload.n || fileKey);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.setHeader('Cache-Control', 'no-store');
  return res.sendFile(filePath);
};

exports.downloadByToken = async (req, res) => downloadWithToken(req, res, req.query.t);

exports.downloadByPathToken = async (req, res) => downloadWithToken(req, res, req.params.token);
