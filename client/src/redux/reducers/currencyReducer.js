// src/redux/reducers/currencyReducer.js

import { SET_DISPLAY_CURRENCY, SET_EXCHANGE_RATES } from '../actionTypes/currencyActionType';

const initialState = {
  selectedCurrency: localStorage.getItem('displayCurrency') || 'TND', // اقرأ القيمة من localStorage
  exchangeRates: {
    TND_per_USD: 3.0, // يمكنك تحديث هذه القيم من API لاحقًا
    TND_per_EUR: 3.3,
  },
};

export const currencyReducer = (state = initialState, action) => {
  switch (action.type) {
    case SET_DISPLAY_CURRENCY:
      localStorage.setItem('displayCurrency', action.payload); // احفظ الاختيار للمستقبل
      return {
        ...state,
        selectedCurrency: action.payload,
      };
    case SET_EXCHANGE_RATES:
      return {
        ...state,
        exchangeRates: { ...state.exchangeRates, ...action.payload },
      };
    default:
      return state;
  }
};

export default currencyReducer;