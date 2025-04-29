// src/redux/reducers/uiReducer.js
import { SET_DISPLAY_CURRENCY } from '../actionTypes/uiActionTypes'; // Adjust path if needed

// --- التهيئة الأولية، يمكنك القراءة من localStorage هنا إذا أردت حفظ التفضيل ---
const initialState = {
    // Default to TND or read from storage
    displayCurrency: localStorage.getItem('displayCurrencyPref') || 'TND',
};

const uiReducer = (state = initialState, action) => {
    const { type, payload } = action;

    switch (type) {
        case SET_DISPLAY_CURRENCY:
            // التحقق من أن القيمة هي TND أو USD فقط
            if (payload === 'TND' || payload === 'USD') {
                 // حفظ التفضيل في localStorage
                localStorage.setItem('displayCurrencyPref', payload);
                return { ...state, displayCurrency: payload };
            }
            return state; // تجاهل القيم غير الصالحة

        default:
            return state;
    }
};

export default uiReducer;