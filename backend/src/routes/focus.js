const router = require('express').Router();
const protect = require('../middleware/auth');
const c = require('../controllers/focusController');

router.use(protect);
router.get('/active', c.active);
router.get('/summary', c.summary);
router.post('/', c.start);
router.post('/:id/action', c.control);

module.exports = router;
