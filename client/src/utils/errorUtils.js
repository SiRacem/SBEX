// client/src/utils/errorUtils.js

/**
 * Formats an error object into a user-friendly, translatable string.
 * It handles string errors, and object errors with translation keys.
 * @param {string | {key: string, fallback?: string, params?: object}} error - The error object from Redux state or Axios catch block.
 * @param {function} t - The translation function from i18next's useTranslation hook.
 * @returns {string} A formatted and translated error message.
 */
export const formatErrorMessage = (error, t) => {
    if (!error) {
        return "";
    }

    // إذا كان الخطأ مجرد نص
    if (typeof error === 'string') {
        return error;
    }

    // إذا كان الخطأ كائنًا يحتوي على مفتاح ترجمة
    if (error.key) {
        const fallbackMessage = error.fallback || t('apiErrors.unknownError', 'An unknown error occurred.');
        return t(error.key, { ...error.params, defaultValue: fallbackMessage });
    }

    // إذا كان الخطأ كائنًا يحتوي على حقل msg (من الخادم)
    if (error.msg) {
        return error.msg;
    }

    // كحل أخير، إذا كان كائنًا غير معروف
    return t('apiErrors.unknownError', 'An unknown error occurred.');
};