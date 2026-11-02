const router = require('express').Router();
const protect = require('../middleware/auth');
const c = require('../controllers/reminderController');

router.use(protect);
router.get('/', c.list);
router.patch('/:id', c.update);

module.exports = router;
