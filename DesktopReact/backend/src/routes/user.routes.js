const express = require('express');
const userController = require('../controllers/users.controller');

const router = express.Router();

router
  .route('/profiles')
  .get(userController.getProfiles);

router
  .route('/follow')
  .post(userController.follow);

router
  .route('/test')
  .post(userController.profile);

  router
  .route('/paginate-profiles')
  .post(userController.paginateProfiles)

module.exports = router;