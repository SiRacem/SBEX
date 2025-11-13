const express = require('express');
const router = express.Router();
const {
    createNewsPost,
    getAllNewsPosts,
    getNewsPostById,
    updateNewsPost,
    deleteNewsPost,
    likeNewsPost,
    dislikeNewsPost,
    markNewsAsRead
} = require('../controllers/newsController');

const uploadNewsMedia = require('../middlewares/uploadNewsMedia');
const { verifyAuth } = require('../middlewares/verifyAuth');
const { isAdmin } = require('../middlewares/roleCheck');

// Routes for everyone (Public)
router.get('/', getAllNewsPosts);
router.get('/:id', getNewsPostById);

// Routes for logged-in users (Requires authentication)
router.put('/:id/like', verifyAuth, likeNewsPost);
router.put('/:id/dislike', verifyAuth, dislikeNewsPost);
router.put('/:id/read', verifyAuth, markNewsAsRead);


// Routes for Admin only (Requires authentication and admin role)
router.post('/', verifyAuth, isAdmin, uploadNewsMedia.single('media'), createNewsPost);
router.put('/:id', verifyAuth, isAdmin, uploadNewsMedia.single('media'), updateNewsPost);
router.delete('/:id', verifyAuth, isAdmin, deleteNewsPost);

module.exports = router;