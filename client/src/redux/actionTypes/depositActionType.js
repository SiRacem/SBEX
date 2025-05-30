// src/redux/actionTypes/depositActionType.js

// إنشاء طلب إيداع (المستخدم)
export const CREATE_DEPOSIT_REQUEST = 'CREATE_DEPOSIT_REQUEST';
export const CREATE_DEPOSIT_SUCCESS = 'CREATE_DEPOSIT_SUCCESS';
export const CREATE_DEPOSIT_FAIL =    'CREATE_DEPOSIT_FAIL';
export const CREATE_DEPOSIT_RESET = 'CREATE_DEPOSIT_RESET'; // لإعادة التعيين

// جلب طلبات الإيداع الخاصة بالمستخدم (لعرضها في المحفظة) <--- إضافة هذا القسم
export const GET_USER_DEPOSITS_REQUEST = 'GET_USER_DEPOSITS_REQUEST';
export const GET_USER_DEPOSITS_SUCCESS = 'GET_USER_DEPOSITS_SUCCESS';
export const GET_USER_DEPOSITS_FAIL =    'GET_USER_DEPOSITS_FAIL';

// --- أنواع خاصة بالأدمن ---
export const ADMIN_GET_DEPOSITS_REQUEST = 'ADMIN_GET_DEPOSITS_REQUEST';
export const ADMIN_GET_DEPOSITS_SUCCESS = 'ADMIN_GET_DEPOSITS_SUCCESS';
export const ADMIN_GET_DEPOSITS_FAIL =    'ADMIN_GET_DEPOSITS_FAIL';

export const ADMIN_APPROVE_DEPOSIT_REQUEST = 'ADMIN_APPROVE_DEPOSIT_REQUEST';
export const ADMIN_APPROVE_DEPOSIT_SUCCESS = 'ADMIN_APPROVE_DEPOSIT_SUCCESS';
export const ADMIN_APPROVE_DEPOSIT_FAIL =    'ADMIN_APPROVE_DEPOSIT_FAIL';

export const ADMIN_REJECT_DEPOSIT_REQUEST = 'ADMIN_REJECT_DEPOSIT_REQUEST';
export const ADMIN_REJECT_DEPOSIT_SUCCESS = 'ADMIN_REJECT_DEPOSIT_SUCCESS';
export const ADMIN_REJECT_DEPOSIT_FAIL =    'ADMIN_REJECT_DEPOSIT_FAIL';

export const CLEAR_DEPOSIT_ERRORS = 'CLEAR_DEPOSIT_ERRORS';

// --- إزالة أو إبقاء هذا معلقًا ---
// export const GET_DEPOSIT_HISTORY_REQUEST = 'GET_DEPOSIT_HISTORY_REQUEST';
// export const GET_DEPOSIT_HISTORY_SUCCESS = 'GET_DEPOSIT_HISTORY_SUCCESS';
// export const GET_DEPOSIT_HISTORY_FAIL =    'GET_DEPOSIT_HISTORY_FAIL';