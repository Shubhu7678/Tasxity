const router = require('express').Router();
const c = require('../controllers/authController');
const protect = require('../middleware/auth');

router.post('/signup', c.signup);
router.post('/login', c.login);
router.post('/guest', c.guest);
router.get('/me', protect, c.me);
router.put('/preferences', protect, c.preferences);

module.exports = router;
