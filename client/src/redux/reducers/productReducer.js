// src/redux/reducers/productReducer.js

import {
    GET_PRODUCTS_REQUEST, GET_PRODUCTS_SUCCESS, GET_PRODUCTS_FAIL,
    ADD_PRODUCT_REQUEST, ADD_PRODUCT_SUCCESS, ADD_PRODUCT_FAIL,
    UPDATE_PRODUCT_REQUEST, UPDATE_PRODUCT_SUCCESS, UPDATE_PRODUCT_FAIL,
    DELETE_PRODUCT_REQUEST, DELETE_PRODUCT_SUCCESS, DELETE_PRODUCT_FAIL,
    GET_PENDING_PRODUCTS_REQUEST, GET_PENDING_PRODUCTS_SUCCESS, GET_PENDING_PRODUCTS_FAIL,
    APPROVE_PRODUCT_REQUEST, APPROVE_PRODUCT_SUCCESS, APPROVE_PRODUCT_FAIL,
    REJECT_PRODUCT_REQUEST, REJECT_PRODUCT_SUCCESS, REJECT_PRODUCT_FAIL,
    TOGGLE_LIKE_PRODUCT_REQUEST, TOGGLE_LIKE_PRODUCT_SUCCESS, TOGGLE_LIKE_PRODUCT_FAIL,
    PLACE_BID_REQUEST, PLACE_BID_SUCCESS, PLACE_BID_FAIL,
    CLEAR_PRODUCT_ERROR, ACCEPT_BID_REQUEST, ACCEPT_BID_SUCCESS, ACCEPT_BID_FAIL,
    REJECT_BID_REQUEST, REJECT_BID_SUCCESS, REJECT_BID_FAIL, UPDATE_SINGLE_PRODUCT_LOCALLY,
    UPDATE_SINGLE_PRODUCT_IN_STORE, ADD_PENDING_PRODUCT_SOCKET, REMOVE_PENDING_PRODUCT_SOCKET,
    UPDATE_MEDIATION_DETAILS_FROM_SOCKET
} from '../actionTypes/productActionType'; // تأكد من المسار الصحيح

const initialState = {
    Products: [],
    pendingProducts: [],
    loading: false,
    loadingPending: false,
    errors: null,
    productLoading: {},
    productErrors: {},
    loadingAdd: false,
    loadingUpdate: {},
    loadingDelete: {},
    loadingApprove: {},
    loadingReject: {},
    productLiking: {}, // حالة تحميل منفصلة للإعجاب
    acceptingBid: {}, // e.g., { productId_bidUserId: true }
    rejectingBid: {}, // e.g., { productId_bidUserId: true }
};

// --- دالة مساعدة لتحديث مصفوفة الإعجابات ---
function calculateUpdatedLikes(currentLikes = [], userId, userLiked) {
    if (!userId) {
        console.warn("calculateUpdatedLikes: userId is missing, cannot update likes.");
        return currentLikes;
    }
    const likesSet = new Set(currentLikes.map(id => String(id)));
    const userIdString = String(userId);

    if (userLiked) {
        likesSet.add(userIdString);
    } else {
        likesSet.delete(userIdString);
    }
    return Array.from(likesSet);
}

// دالة مساعدة لإنشاء مفتاح مركب للتحميل
const createBidActionKey = (productId, bidUserId) => `${productId}_${bidUserId}`;

const productReducer = (state = initialState, { type, payload }) => {
    let bidActionKey;

    switch (type) {
        // --- جلب قائمة المنتجات ---
        case GET_PRODUCTS_REQUEST:
            console.log("REDUCER: GET_PRODUCTS_REQUEST - Setting loading to true");
            return { ...state, loading: true, errors: null };
        case GET_PRODUCTS_SUCCESS:
            console.log("REDUCER: GET_PRODUCTS_SUCCESS - Replacing Products. Payload length:", payload?.length);
            return { ...state, loading: false, Products: Array.isArray(payload) ? payload : [], errors: null };
        case GET_PRODUCTS_FAIL: // مثال على حالة فشل
            console.error("REDUCER: GET_PRODUCTS_FAIL - Setting error:", payload);
            return { ...state, loading: false, errors: typeof payload === 'string' ? payload : "Failed to fetch products.", Products: [] }; // تأكد أن errors هو نص

        // --- إضافة منتج ---
        case ADD_PRODUCT_REQUEST:
            return { ...state, loadingAdd: true, errors: null };
        case ADD_PRODUCT_SUCCESS:
            const newProductsAdd = [payload, ...state.Products.filter(p => p._id !== payload._id)];
            const newPendingAdd = payload.status === 'pending'
                ? [payload, ...(state.pendingProducts || []).filter(p => p._id !== payload._id)]
                : state.pendingProducts;
            // فرز pendingProducts بعد الإضافة (اختياري)
            if (payload.status === 'pending') {
                newPendingAdd.sort((a, b) => new Date(a.date_added || a.createdAt || 0) - new Date(b.date_added || b.createdAt || 0));
            }
            return { ...state, loadingAdd: false, Products: newProductsAdd, pendingProducts: newPendingAdd, errors: null };
        case ADD_PRODUCT_FAIL:
            return { ...state, loadingAdd: false, errors: payload };

        // --- المنتجات المعلقة ---
        case GET_PENDING_PRODUCTS_REQUEST:
            return { ...state, loadingPending: true, errors: null };
        case GET_PENDING_PRODUCTS_SUCCESS:
            return { ...state, loadingPending: false, pendingProducts: Array.isArray(payload) ? payload : [], errors: null };
        case GET_PENDING_PRODUCTS_FAIL:
            return { ...state, loadingPending: false, errors: payload, pendingProducts: [] };


        // --- تحديث المنتج ---
        case UPDATE_PRODUCT_REQUEST:
            return { ...state, loadingUpdate: { ...state.loadingUpdate, [payload.productId]: true }, productErrors: { ...state.productErrors, [payload.productId]: null } };
        case UPDATE_PRODUCT_SUCCESS:
            const updatedProduct = payload; // payload هنا هو المنتج المحدث من استجابة الـ API
            // إذا كان المنتج المحدث أصبح pending
            const updatedPending = updatedProduct.status === 'pending'
                ? [updatedProduct, ...(state.pendingProducts || []).filter(p => p._id !== updatedProduct._id)].sort((a, b) => new Date(a.date_added || a.createdAt || 0) - new Date(b.date_added || b.createdAt || 0))
                : (state.pendingProducts || []).filter(p => p._id !== updatedProduct._id); // إذا لم يعد pending، أزله
            return {
                ...state,
                loadingUpdate: { ...state.loadingUpdate, [updatedProduct._id]: false },
                Products: state.Products.map(p => p._id === updatedProduct._id ? updatedProduct : p), // تحديث في القائمة الرئيسية
                pendingProducts: updatedPending, // تحديث قائمة pending
                errors: null
            };
        case UPDATE_PRODUCT_FAIL:
            return { ...state, loadingUpdate: { ...state.loadingUpdate, [payload.productId]: false }, productErrors: { ...state.productErrors, [payload.productId]: payload.error } };

        // --- الموافقة على المنتج ---
        case APPROVE_PRODUCT_REQUEST:
            return { ...state, loadingApprove: { ...state.loadingApprove, [payload.productId]: true }, productErrors: { ...state.productErrors, [payload.productId]: null } };
        case APPROVE_PRODUCT_SUCCESS:
            // payload هنا هو { productId }
            // هذا يزيل المنتج من قائمة المنتجات المعلقة
            // ولكننا نعتمد على حدث 'product_updated' من السوكيت لتحديث قائمة Products الرئيسية
            return {
                ...state,
                loadingApprove: { ...state.loadingApprove, [payload.productId]: false },
                pendingProducts: (state.pendingProducts || []).filter(p => p._id !== payload.productId),
                // لا نعدل Products هنا مباشرة، دع السوكيت يعالج ذلك لضمان التناسق
                errors: null
            };
        case APPROVE_PRODUCT_FAIL:
            return { ...state, loadingApprove: { ...state.loadingApprove, [payload.productId]: false }, productErrors: { ...state.productErrors, [payload.productId]: payload.error } };

        // --- رفض المنتج ---
        case REJECT_PRODUCT_REQUEST:
            return { ...state, loadingReject: { ...state.loadingReject, [payload.productId]: true }, productErrors: { ...state.productErrors, [payload.productId]: null } };
        case REJECT_PRODUCT_SUCCESS:
            return { ...state, loadingReject: { ...state.loadingReject, [payload.productId]: false }, pendingProducts: (state.pendingProducts || []).filter(p => p._id !== payload.productId), errors: null };
        case REJECT_PRODUCT_FAIL:
            return { ...state, loadingReject: { ...state.loadingReject, [payload.productId]: false }, productErrors: { ...state.productErrors, [payload.productId]: payload.error } };

        // --- حذف المنتج ---
        case DELETE_PRODUCT_REQUEST:
            return { ...state, loadingDelete: { ...state.loadingDelete, [payload.productId]: true }, productErrors: { ...state.productErrors, [payload.productId]: null } };
        case DELETE_PRODUCT_SUCCESS:
            console.log("REDUCER: DELETE_PRODUCT_SUCCESS for", payload.productId);
            return {
                ...state,
                loadingDelete: { ...state.loadingDelete, [payload.productId]: false },
                Products: state.Products.filter(p => p._id !== payload.productId),
                pendingProducts: (state.pendingProducts || []).filter(p => p._id !== payload.productId),
                errors: null
            };
        case DELETE_PRODUCT_FAIL:
            return { ...state, loadingDelete: { ...state.loadingDelete, [payload.productId]: false }, productErrors: { ...state.productErrors, [payload.productId]: payload.error } };


        // --- حالات الإعجاب ---
        case TOGGLE_LIKE_PRODUCT_REQUEST:
            return {
                ...state,
                productLiking: { ...state.productLiking, [payload.productId]: true }, // <-- استخدام productLiking
                productErrors: { ...state.productErrors, [payload.productId]: null }
            };
        case TOGGLE_LIKE_PRODUCT_SUCCESS:
            // payload يجب أن يحتوي على: productId, userLiked, userId
            if (!payload.userId) {
                console.error("REDUCER: TOGGLE_LIKE_SUCCESS - Missing userId in payload!");
            }
            return {
                ...state,
                productLiking: { ...state.productLiking, [payload.productId]: false }, // <-- استخدام productLiking
                Products: state.Products.map(product => {
                    if (product._id === payload.productId) {
                        // تحديث مصفوفة likes باستخدام الدالة المساعدة
                        const updatedLikes = calculateUpdatedLikes(product.likes, payload.userId, payload.userLiked);
                        console.log(`REDUCER: Updating likes for ${payload.productId}. New likes:`, updatedLikes); // Log للتأكيد
                        return {
                            ...product,
                            likes: updatedLikes, // <-- استخدام المصفوفة المحدثة
                            // تحديث العدد أيضاً بناءً على المصفوفة الجديدة
                            likesCount: updatedLikes.length
                        };
                    }
                    return product;
                })
            };
        case TOGGLE_LIKE_PRODUCT_FAIL:
            return {
                ...state,
                productLiking: { ...state.productLiking, [payload.productId]: false }, // <-- استخدام productLiking
                productErrors: { ...state.productErrors, [payload.productId]: payload.error }
            };

        // --- حالات المزايدة ---
        case PLACE_BID_REQUEST:
            return { ...state, productLoading: { ...state.productLoading, [payload.productId]: true }, productErrors: { ...state.productErrors, [payload.productId]: null } };
        case PLACE_BID_SUCCESS:
            return {
                ...state,
                productLoading: { ...state.productLoading, [payload.productId]: false },
                Products: state.Products.map(product =>
                    product._id === payload.productId
                        ? { ...product, bids: Array.isArray(payload.bids) ? payload.bids : [] } // استبدال بالمزايدات الجديدة
                        : product
                )
            };
        case PLACE_BID_FAIL:
            return { ...state, productLoading: { ...state.productLoading, [payload.productId]: false }, productErrors: { ...state.productErrors, [payload.productId]: payload.error } };

        // --- مسح الخطأ ---
        case CLEAR_PRODUCT_ERROR:
            const newErrors = { ...state.productErrors };
            delete newErrors[payload.productId];
            return { ...state, productErrors: newErrors };

        // --- [!] حالات قبول المزايدة ---
        case ACCEPT_BID_REQUEST:
            bidActionKey = createBidActionKey(payload.productId, payload.bidUserId);
            return {
                ...state,
                acceptingBid: { ...state.acceptingBid, [bidActionKey]: true },
                productErrors: { ...state.productErrors, [payload.productId]: null }
            };

        case ACCEPT_BID_SUCCESS:
            console.log("REDUCER: ACCEPT_BID_SUCCESS - Payload (expecting updatedProduct):", payload);
            const receivedUpdatedProduct = payload.updatedProduct;

            if (!receivedUpdatedProduct || !receivedUpdatedProduct._id) {
                console.error("REDUCER: ACCEPT_BID_SUCCESS - updatedProduct is missing or invalid in payload!");
                // حاول إيقاف التحميل للمفتاح الأصلي إذا كان موجودًا في الـ payload الأولي للـ REQUEST
                // هذا الجزء يحتاج إلى معرفة ما إذا كان payload الـ REQUEST لا يزال في الذاكرة أو إذا كان يجب تمريره
                // الطريقة الأبسط هي مسح كل حالات التحميل المتعلقة بـ acceptBid عند الفشل أو إذا كانت البيانات غير كاملة
                return {
                    ...state,
                    acceptingBid: {}, // مسح كل عمليات التحميل لـ acceptBid
                    errors: { ...state.errors, acceptBid: "Failed to process bid acceptance due to missing data." }
                };
            }

            // بناء مفتاح التحميل للإيقاف بناءً على المنتج المحدث (المشتري)
            const buyerIdFromUpdated = receivedUpdatedProduct.buyer?._id || receivedUpdatedProduct.buyer;
            const keyToStopLoadingAccept = `${receivedUpdatedProduct._id}_${buyerIdFromUpdated}`;

            return {
                ...state,
                acceptingBid: { ...state.acceptingBid, [keyToStopLoadingAccept]: false },
                Products: state.Products.map(p =>
                    p._id === receivedUpdatedProduct._id ? receivedUpdatedProduct : p
                ),
                errors: null,
                productErrors: { ...state.productErrors, [receivedUpdatedProduct._id]: null }
            };

        case ACCEPT_BID_FAIL:
            bidActionKey = createBidActionKey(payload.productId, payload.bidUserId); // تأكد أن bidUserId موجود في payload الخطأ
            return {
                ...state,
                acceptingBid: { ...state.acceptingBid, [bidActionKey]: false },
                productErrors: { ...state.productErrors, [payload.productId]: typeof payload.error === 'string' ? payload.error : "Failed to accept bid on this product." },
                errors: { ...state.errors, acceptBid: typeof payload.error === 'string' ? payload.error : "Failed to accept bid." }
            };
        // --- نهاية تعديل حالة ACCEPT_BID_SUCCESS ---

        // --- [!!!] تعديل حالة REJECT_BID_SUCCESS (اختياري، إذا كان الـ API يعيد المنتج المحدث) ---
        case REJECT_BID_REQUEST:
            bidActionKey = createBidActionKey(payload.productId, payload.bidUserId);
            return {
                ...state,
                rejectingBid: { ...state.rejectingBid, [bidActionKey]: true },
                productErrors: { ...state.productErrors, [payload.productId]: null }
            };

        case REJECT_BID_SUCCESS:
            const { updatedProduct: updatedProductAfterReject, rejectedBidUserId, productId: rejectedProductId } = payload;
            const keyToStopLoadingReject = createBidActionKey(updatedProductAfterReject ? updatedProductAfterReject._id : rejectedProductId, rejectedBidUserId);

            if (updatedProductAfterReject) {
                console.log("REDUCER: REJECT_BID_SUCCESS - Updating with full product payload:", updatedProductAfterReject);
                return {
                    ...state,
                    rejectingBid: { ...state.rejectingBid, [keyToStopLoadingReject]: false },
                    Products: state.Products.map(p =>
                        p._id === updatedProductAfterReject._id ? updatedProductAfterReject : p
                    ),
                    errors: null,
                    productErrors: { ...state.productErrors, [updatedProductAfterReject._id]: null }
                };
            } else {
                // تحديث محلي إذا لم يتم إرجاع المنتج المحدث
                console.log(`REDUCER: REJECT_BID_SUCCESS for key ${keyToStopLoadingReject}. Performing local bid removal.`);
                const productsWithBidRemoved = state.Products.map(p => {
                    if (p._id === rejectedProductId) { // استخدم productId من الـ payload الأصلي
                        const remainingBids = (p.bids || []).filter(b => {
                            const bidderIdFromBid = String(b.user?._id || b.user);
                            return bidderIdFromBid !== String(rejectedBidUserId);
                        });
                        return { ...p, bids: remainingBids };
                    }
                    return p;
                });
                return {
                    ...state,
                    rejectingBid: { ...state.rejectingBid, [keyToStopLoadingReject]: false },
                    Products: productsWithBidRemoved,
                    errors: null,
                    productErrors: { ...state.productErrors, [rejectedProductId]: null }
                };
            }

        case REJECT_BID_FAIL:
            bidActionKey = createBidActionKey(payload.productId, payload.bidUserId); // تأكد أن bidUserId موجود في payload الخطأ
            return {
                ...state,
                rejectingBid: { ...state.rejectingBid, [bidActionKey]: false },
                productErrors: { ...state.productErrors, [payload.productId]: payload.error }
            };
        // --- نهاية تعديل حالة REJECT_BID_SUCCESS ---

        // --- [!!!] حالة جديدة للتحديث المحلي المتفائل [!!!] ---
        case UPDATE_SINGLE_PRODUCT_LOCALLY:
            if (!payload || !payload._id) {
                console.warn("REDUCER: UPDATE_SINGLE_PRODUCT_LOCALLY - Invalid payload, cannot update product locally.");
                return state;
            }
            return {
                ...state,
                Products: state.Products.map(p =>
                    p._id === payload._id ? { ...p, ...payload } : p // دمج التغييرات مع الحفاظ على البيانات الأخرى للمنتج
                ),
            };

        case UPDATE_SINGLE_PRODUCT_IN_STORE:
            if (!payload || !payload._id) {
                console.warn("REDUCER: UPDATE_SINGLE_PRODUCT_IN_STORE - Invalid payload, cannot update/add product. Payload:", payload);
                return state;
            }
            const updatedProductData = payload;
            console.log("[productReducer] Updating product from PRODUCT_UPDATED. New product data:", updatedProductData);

            let newProductsList = [...state.Products]; // ابدأ بنسخة من القائمة الحالية
            let newPendingProductsList = [...(state.pendingProducts || [])]; // ابدأ بنسخة من القائمة الحالية

            const existingProductIndexInProducts = newProductsList.findIndex(p => p._id === updatedProductData._id);

            if (existingProductIndexInProducts > -1) {
                // المنتج موجود في القائمة الرئيسية، قم بتحديثه بالكامل
                newProductsList[existingProductIndexInProducts] = updatedProductData; // استبدال الكائن بالكامل
                console.log("REDUCER: Updated product in Products list:", updatedProductData._id, "New status:", updatedProductData.status);
            } else {
                // المنتج غير موجود في القائمة الرئيسية
                // إذا كان المنتج المحدث معتمدًا (أو أي حالة يجب أن تكون في القائمة الرئيسية)، أضفه
                // عادةً، إذا كان 'approved', 'sold', 'rejected' (من قبل الأدمن)
                if (['approved', 'sold', 'rejected', 'PendingMediatorSelection', 'MediatorAssigned', 'InProgress', 'Disputed', 'Completed'].includes(updatedProductData.status)) {
                    newProductsList = [updatedProductData, ...newProductsList]; // أضفه في بداية القائمة
                    console.log("REDUCER: Added new product to Products list:", updatedProductData._id, "Status:", updatedProductData.status);
                }
            }

            // التعامل مع قائمة المنتجات المعلقة (pendingProducts)
            const existingInPendingIndex = newPendingProductsList.findIndex(p => p._id === updatedProductData._id);

            if (updatedProductData.status === 'pending') {
                // إذا أصبح المنتج pending
                if (existingInPendingIndex === -1) {
                    // ولم يكن موجودًا في pending، أضفه
                    newPendingProductsList = [updatedProductData, ...newPendingProductsList];
                    console.log("REDUCER: Added product to pendingProducts list:", updatedProductData._id);
                } else {
                    // إذا كان موجودًا في pending، قم بتحديثه
                    newPendingProductsList[existingInPendingIndex] = updatedProductData;
                    console.log("REDUCER: Updated product in pendingProducts list:", updatedProductData._id);
                }
            } else {
                // إذا لم يعد المنتج pending (مثلاً أصبح approved أو rejected من قبل Admin, أو تم تعديله من قبل البائع وكان pending وأصبح شيئًا آخر)
                if (existingInPendingIndex > -1) {
                    // قم بإزالته من pendingProducts
                    newPendingProductsList = newPendingProductsList.filter(p => p._id !== updatedProductData._id);
                    console.log("REDUCER: Removed product from pendingProducts list:", updatedProductData._id);
                }
            }

            // فرز قائمة pending (اختياري ولكن جيد)
            newPendingProductsList.sort((a, b) => new Date(a.date_added || a.createdAt || 0) - new Date(b.date_added || b.createdAt || 0));
            // يمكنك أيضًا فرز newProductsList إذا أردت

            return {
                ...state,
                Products: newProductsList,
                pendingProducts: newPendingProductsList,
            };
        // --- نهاية تحديث المنتج محليًا ---
        
        case ADD_PENDING_PRODUCT_SOCKET:
            // Ensure we don't add a duplicate if it's already there
            const isAlreadyPending = state.pendingProducts.some(p => p._id === payload._id);
            if (isAlreadyPending) {
                return state;
            }
            return {
                ...state,
                pendingProducts: [payload, ...state.pendingProducts],
            };

        case REMOVE_PENDING_PRODUCT_SOCKET:
            return {
                ...state,
                pendingProducts: state.pendingProducts.filter(p => p._id !== payload.productId),
            };

        case UPDATE_MEDIATION_DETAILS_FROM_SOCKET: {
            const updatedMediationRequest = payload;

            if (!updatedMediationRequest || !updatedMediationRequest.product || !updatedMediationRequest.product._id) {
                console.warn("productReducer: Received UPDATE_MEDIATION_DETAILS_FROM_SOCKET but no product data was attached.");
                return state;
            }

            const updatedProductFromMediation = updatedMediationRequest.product;
            console.log(`[productReducer] Updating product ${updatedProductFromMediation._id} via MEDIATION socket event.`);

            return {
                ...state,
                Products: state.Products.map(p =>
                    p._id === updatedProductFromMediation._id ? updatedProductFromMediation : p
                ),
            };
            }

        default:
            return state;
    }
    };

export default productReducer;