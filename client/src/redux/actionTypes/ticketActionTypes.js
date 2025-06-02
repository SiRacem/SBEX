// src/redux/actionTypes/ticketActionTypes.js

// --- إنشاء تذكرة ---
export const CREATE_TICKET_REQUEST = "CREATE_TICKET_REQUEST";
export const CREATE_TICKET_SUCCESS = "CREATE_TICKET_SUCCESS";
export const CREATE_TICKET_FAIL = "CREATE_TICKET_FAIL";
export const CREATE_TICKET_RESET = "CREATE_TICKET_RESET"; // لإعادة تعيين حالة الإنشاء

// --- جلب تذاكر المستخدم ---
export const GET_USER_TICKETS_REQUEST = "GET_USER_TICKETS_REQUEST";
export const GET_USER_TICKETS_SUCCESS = "GET_USER_TICKETS_SUCCESS";
export const GET_USER_TICKETS_FAIL = "GET_USER_TICKETS_FAIL";

// --- جلب تفاصيل تذكرة معينة (وردودها) ---
export const GET_TICKET_DETAILS_REQUEST = "GET_TICKET_DETAILS_REQUEST";
export const GET_TICKET_DETAILS_SUCCESS = "GET_TICKET_DETAILS_SUCCESS";
export const GET_TICKET_DETAILS_FAIL = "GET_TICKET_DETAILS_FAIL";
export const CLEAR_TICKET_DETAILS = "CLEAR_TICKET_DETAILS"; // لمسح التفاصيل عند مغادرة الصفحة

// --- [جديد] جلب تفاصيل تذكرة معينة بواسطة الأدمن ---
export const ADMIN_GET_TICKET_DETAILS_REQUEST = "ADMIN_GET_TICKET_DETAILS_REQUEST";
export const ADMIN_GET_TICKET_DETAILS_SUCCESS = "ADMIN_GET_TICKET_DETAILS_SUCCESS";
export const ADMIN_GET_TICKET_DETAILS_FAIL = "ADMIN_GET_TICKET_DETAILS_FAIL";

// --- إضافة رد على تذكرة ---
export const ADD_TICKET_REPLY_REQUEST = "ADD_TICKET_REPLY_REQUEST";
export const ADD_TICKET_REPLY_SUCCESS = "ADD_TICKET_REPLY_SUCCESS"; // سيضيف الرد إلى قائمة الردود في التفاصيل
export const ADD_TICKET_REPLY_FAIL = "ADD_TICKET_REPLY_FAIL";
export const ADD_TICKET_REPLY_RESET = "ADD_TICKET_REPLY_RESET";

// --- المستخدم يغلق تذكرته ---
export const CLOSE_TICKET_BY_USER_REQUEST = "CLOSE_TICKET_BY_USER_REQUEST";
export const CLOSE_TICKET_BY_USER_SUCCESS = "CLOSE_TICKET_BY_USER_SUCCESS"; // سيحدث حالة التذكرة في القائمة والتفاصيل
export const CLOSE_TICKET_BY_USER_FAIL = "CLOSE_TICKET_BY_USER_FAIL";

// --- دوال الأدمن/الدعم ---
// جلب جميع التذاكر للوحة التحكم
export const ADMIN_GET_ALL_TICKETS_REQUEST = "ADMIN_GET_ALL_TICKETS_REQUEST";
export const ADMIN_GET_ALL_TICKETS_SUCCESS = "ADMIN_GET_ALL_TICKETS_SUCCESS";
export const ADMIN_GET_ALL_TICKETS_FAIL = "ADMIN_GET_ALL_TICKETS_FAIL";

// تحديث حالة التذكرة بواسطة الدعم
export const ADMIN_UPDATE_TICKET_STATUS_REQUEST = "ADMIN_UPDATE_TICKET_STATUS_REQUEST";
export const ADMIN_UPDATE_TICKET_STATUS_SUCCESS = "ADMIN_UPDATE_TICKET_STATUS_SUCCESS";
export const ADMIN_UPDATE_TICKET_STATUS_FAIL = "ADMIN_UPDATE_TICKET_STATUS_FAIL";

// تحديث أولوية التذكرة بواسطة الدعم
export const ADMIN_UPDATE_TICKET_PRIORITY_REQUEST = "ADMIN_UPDATE_TICKET_PRIORITY_REQUEST";
export const ADMIN_UPDATE_TICKET_PRIORITY_SUCCESS = "ADMIN_UPDATE_TICKET_PRIORITY_SUCCESS";
export const ADMIN_UPDATE_TICKET_PRIORITY_FAIL = "ADMIN_UPDATE_TICKET_PRIORITY_FAIL";

// تعيين تذكرة لعضو دعم
export const ADMIN_ASSIGN_TICKET_REQUEST = "ADMIN_ASSIGN_TICKET_REQUEST";
export const ADMIN_ASSIGN_TICKET_SUCCESS = "ADMIN_ASSIGN_TICKET_SUCCESS";
export const ADMIN_ASSIGN_TICKET_FAIL = "ADMIN_ASSIGN_TICKET_FAIL";

// مسح أخطار التذاكر
export const CLEAR_TICKET_ERRORS = "CLEAR_TICKET_ERRORS";

export const REALTIME_ADD_TICKET_REPLY = "REALTIME_ADD_TICKET_REPLY"; // لإضافة رد في الوقت الحقيقي عند إضافة رد جديد من قبل المستخدم أو الدعم