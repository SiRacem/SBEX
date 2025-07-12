import { SET_DISPLAY_CURRENCY } from '../actionTypes/currencyActionType';

export const setDisplayCurrency = (currency) => ({
    type: SET_DISPLAY_CURRENCY,
    payload: currency,
});