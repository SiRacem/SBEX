const News = require('../models/News');
const asyncHandler = require('express-async-handler'); // لتسهيل التعامل مع الأخطاء

// @desc    Create a new news post (Admin only)
// @route   POST /api/news
// @access  Private/Admin
exports.createNewsPost = asyncHandler(async (req, res) => {
    console.log("--- [4] newsController: createNewsPost CALLED ---");
    console.log("--- req.file object:", req.file);
    console.log("--- req.body object:", req.body);
    
    let { title, content, category } = req.body;

    // تحويل النصوص من JSON string إلى كائنات
    title = JSON.parse(title);
    content = JSON.parse(content);

    // التحقق من أن اللغة العربية موجودة
    if (!title.ar || !content.ar) {
        return res.status(400).json({ msg: "Arabic title and content are required." });
    }

    // منطق النسخ الاحتياطي
    const fallbackTitle = title.ar;
    const fallbackContent = content.ar;
    const finalTitle = {
        ar: title.ar,
        en: title.en || fallbackTitle,
        fr: title.fr || fallbackTitle,
        tn: title.tn || fallbackTitle,
    };
    const finalContent = {
        ar: content.ar,
        en: content.en || fallbackContent,
        fr: content.fr || fallbackContent,
        tn: content.tn || fallbackContent,
    };

    const postData = {
        title: finalTitle,
        content: finalContent,
        category,
        author: req.user._id,
    };

    if (req.file) {
        postData.mediaUrl = req.file.path.replace(/\\/g, "/");
        postData.mediaType = req.file.mimetype.startsWith('image') ? 'image' : 'video';
    }

    const newsPost = new News(postData);
    const createdPost = await newsPost.save();

    req.io.emit('news_updated'); // إرسال إشارة للتحديث الفوري
    res.status(201).json(createdPost);
});

// @desc    Get all news posts with pagination
// @route   GET /api/news
// @access  Public
exports.getAllNewsPosts = asyncHandler(async (req, res) => {
    const pageSize = 10;
    const page = Number(req.query.pageNumber) || 1;

    const count = await News.countDocuments();
    const posts = await News.find({})
        .populate('author', 'name profilePicture') // لجلب اسم وصورة كاتب الخبر
        .sort({ createdAt: -1 })
        .limit(pageSize)
        .skip(pageSize * (page - 1));

    res.json({ posts, page, pages: Math.ceil(count / pageSize) });
});


// @desc    Get a single news post by ID
// @route   GET /api/news/:id
// @access  Public
exports.getNewsPostById = asyncHandler(async (req, res) => {
    const post = await News.findById(req.params.id).populate('author', 'name profilePicture');

    if (post) {
        res.json(post);
    } else {
        res.status(404);
        throw new Error('News post not found');
    }
});


// @desc    Update a news post (Admin only)
// @route   PUT /api/news/:id
// @access  Private/Admin
exports.updateNewsPost = asyncHandler(async (req, res) => {
    let { title, content, category } = req.body;

    // تحويل النصوص من JSON string إلى كائنات
    title = JSON.parse(title);
    content = JSON.parse(content);

    const post = await News.findById(req.params.id);

    if (post) {
        post.title = { ...post.title, ...title };
        post.content = { ...post.content, ...content };
        post.category = category || post.category;

        if (req.file) {
            // حذف الملف القديم إذا كان موجودًا
            if (post.mediaUrl && fs.existsSync(post.mediaUrl)) {
                fs.unlinkSync(post.mediaUrl);
            }
            post.mediaUrl = req.file.path.replace(/\\/g, "/");
            post.mediaType = req.file.mimetype.startsWith('image') ? 'image' : 'video';
        }

        const updatedPost = await post.save();
        req.io.emit('news_updated');
        res.json(updatedPost);
    } else {
        res.status(404);
        throw new Error('News post not found');
    }
});

// @desc    Delete a news post (Admin only)
// @route   DELETE /api/news/:id
// @access  Private/Admin
exports.deleteNewsPost = asyncHandler(async (req, res) => {
    const post = await News.findById(req.params.id);
    if (post) {
        if (post.mediaUrl && fs.existsSync(post.mediaUrl)) {
            fs.unlinkSync(post.mediaUrl);
        }
        await News.deleteOne({ _id: req.params.id });
        req.io.emit('news_updated');
        res.json({ message: 'News post removed' });
    } else {
        res.status(404);
        throw new Error('News post not found');
    }
});


// @desc    Like a news post
// @route   PUT /api/news/:id/like
// @access  Private
exports.likeNewsPost = asyncHandler(async (req, res) => {
    const post = await News.findById(req.params.id);
    if (post) {
        post.dislikes.pull(req.user._id);
        const userIndex = post.likes.indexOf(req.user._id);
        if (userIndex === -1) {
            post.likes.push(req.user._id);
        } else {
            post.likes.splice(userIndex, 1);
        }
        await post.save();
        req.io.emit('news_updated');
        res.json(post);
    } else {
        res.status(404);
        throw new Error('News post not found');
    }
});

// @desc    Dislike a news post
exports.dislikeNewsPost = asyncHandler(async (req, res) => {
    const post = await News.findById(req.params.id);
    if (post) {
        post.likes.pull(req.user._id);
        const userIndex = post.dislikes.indexOf(req.user._id);
        if (userIndex === -1) {
            post.dislikes.push(req.user._id);
        } else {
            post.dislikes.splice(userIndex, 1);
        }
        await post.save();
        req.io.emit('news_updated');
        res.json(post);
    } else {
        res.status(404);
        throw new Error('News post not found');
    }
});

// @desc    Mark a news post as read
// @route   PUT /api/news/:id/read
// @access  Private
exports.markNewsAsRead = asyncHandler(async (req, res) => {
    const post = await News.findById(req.params.id);

    if (post) {
        // استخدام findByIdAndUpdate للحصول على المستند المحدث
        const updatedPost = await News.findByIdAndUpdate(
            req.params.id,
            { $addToSet: { readBy: req.user._id } },
            { new: true } // هذا يعيد المستند بعد التحديث
        ).populate('author', 'name profilePicture'); // أعد populate للحفاظ على البيانات

        // بث التحديث عبر Socket.IO
        if (req.io && updatedPost) {
            req.io.emit('news_updated', updatedPost.toObject());
        }

        res.json({ message: 'News marked as read' });
    } else {
        res.status(404);
        throw new Error('News post not found');
    }
});