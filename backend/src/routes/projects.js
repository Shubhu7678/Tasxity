const router = require('express').Router();
const c = require('../controllers/projectController');
const protect = require('../middleware/auth');

router.use(protect);
router.route('/').get(c.list).post(c.create);
router.route('/:id').put(c.update).delete(c.remove);

module.exports = router;
