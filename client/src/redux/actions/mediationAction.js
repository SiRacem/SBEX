// src/redux/actions/mediationAction.js
import axios from 'axios';
import { toast } from 'react-toastify';
import {
    ADMIN_GET_PENDING_ASSIGNMENTS_REQUEST, ADMIN_GET_PENDING_ASSIGNMENTS_SUCCESS, ADMIN_GET_PENDING_ASSIGNMENTS_FAIL,
    ADMIN_ASSIGN_MEDIATOR_REQUEST, ADMIN_ASSIGN_MEDIATOR_SUCCESS, ADMIN_ASSIGN_MEDIATOR_FAIL, ADMIN_ASSIGN_MEDIATOR_RESET,
    ADMIN_CLEAR_MEDIATION_ERRORS
} from '../actionTypes/mediationActionTypes'; // تأكد من المسار الصحيح

// Helper للحصول على التوكن (يمكن استيراده من ملف مشترك)
const getTokenConfig = () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    return { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
};

/**
 * [Admin] جلب طلبات الوساطة التي تنتظر تعيين وسيط
 */
export const adminGetPendingAssignments = (params = {}) => async (dispatch) => {
    dispatch({ type: ADMIN_GET_PENDING_ASSIGNMENTS_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ADMIN_GET_PENDING_ASSIGNMENTS_FAIL, payload: 'Authorization Error' });

    try {
        // استدعاء المسار الصحيح في الـ Backend
        const { data } = await axios.get('/mediation/admin/pending-assignment', { ...config, params });
        console.log("Action: Received pending mediation assignments:", data);
        // الـ Backend يرجع كائنًا يحتوي على requests, totalPages, etc.
        dispatch({ type: ADMIN_GET_PENDING_ASSIGNMENTS_SUCCESS, payload: data });
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch pending mediation requests.';
        console.error("Action Error: Fetching pending assignments:", error.response || error);
        dispatch({ type: ADMIN_GET_PENDING_ASSIGNMENTS_FAIL, payload: message });
        toast.error(`Error fetching requests: ${message}`);
    }
};

/**
 * [Admin] تعيين وسيط لطلب محدد
 */
export const adminAssignMediator = (requestId, mediatorId) => async (dispatch) => {
    dispatch({ type: ADMIN_ASSIGN_MEDIATOR_REQUEST, payload: { requestId } }); // تشير إلى أن هذا الطلب قيد المعالجة
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ADMIN_ASSIGN_MEDIATOR_FAIL, payload: { requestId, error: 'Authorization Error' } });

    try {
        console.log(`Action: Assigning mediator ${mediatorId} to request ${requestId}`);
        // استدعاء المسار الصحيح في الـ Backend وإرسال mediatorId في الـ body
        const { data } = await axios.put(`/mediation/admin/assign/${requestId}`, { mediatorId }, config);
        console.log("Action: Mediator assigned successfully:", data);

        dispatch({
            type: ADMIN_ASSIGN_MEDIATOR_SUCCESS,
            payload: {
                updatedRequest: data.mediationRequest // الطلب المحدث بعد التعيين
            }
        });
        toast.success(data.msg || 'Mediator assigned successfully!');
        // لا حاجة لإعادة الجلب هنا، الـ Reducer سيقوم بإزالة الطلب من قائمة Pending

    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to assign mediator.';
        console.error("Action Error: Assigning mediator:", error.response || error);
        dispatch({ type: ADMIN_ASSIGN_MEDIATOR_FAIL, payload: { requestId, error: message } });
        toast.error(`Error assigning mediator: ${message}`);
    }
};

/**
 * إعادة تعيين حالة نجاح/فشل عملية تعيين الوسيط
 */
export const adminResetAssignMediatorStatus = () => ({ type: ADMIN_ASSIGN_MEDIATOR_RESET });

/**
 * مسح أخطاء عمليات الوساطة للأدمن
 */
export const adminClearMediationErrors = () => ({ type: ADMIN_CLEAR_MEDIATION_ERRORS });

// --- [!] تعديل userAction.js لإضافة جلب الوسطاء ---
// أضف هذه الدالة إلى ملف src/redux/actions/userAction.js
export const adminGetAvailableMediators = () => async (dispatch) => {
    dispatch({ type: 'ADMIN_GET_MEDIATORS_REQUEST' }); // <-- تعريف هذا النوع في userActionTypes
    const config = getTokenConfig();
    if (!config) return dispatch({ type: 'ADMIN_GET_MEDIATORS_FAIL', payload: 'Auth Error' }); // <-- تعريف هذا النوع

    try {
        const { data } = await axios.get('/user/admin/mediators', config);
        dispatch({ type: 'ADMIN_GET_MEDIATORS_SUCCESS', payload: data }); // <-- تعريف هذا النوع
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch mediators.';
        dispatch({ type: 'ADMIN_GET_MEDIATORS_FAIL', payload: message });
        toast.error(`Error fetching mediators: ${message}`);
    }
};
// -----------------------------------------------------