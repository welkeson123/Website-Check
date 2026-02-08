const express = require('express');
const router = express.Router();
const storageController = require('../controllers/StorageController');

router.get('/d/:token', storageController.downloadByPathToken);

module.exports = router;

