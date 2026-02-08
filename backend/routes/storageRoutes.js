const express = require('express');
const router = express.Router();
const storageController = require('../controllers/StorageController');

router.get('/downloads', storageController.downloadByToken);

module.exports = router;

