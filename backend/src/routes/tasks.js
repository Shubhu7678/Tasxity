const router = require('express').Router();
const c = require('../controllers/taskController');
const protect = require('../middleware/auth');

router.use(protect);
router.route('/').get(c.list).post(c.create);
router.post('/bulk', c.bulkCreate);
router.get('/project-export', c.projectExport);
router.get('/summary', c.summary);
router.get('/my-day', c.myDay);
router.put('/recurrence/:id', c.updateRecurrence);
router.put('/reorder', c.reorder);
router.patch('/:id/stop-recurrence', c.stopRecurrence);
router.route('/:id').put(c.update).delete(c.remove);

module.exports = router;
