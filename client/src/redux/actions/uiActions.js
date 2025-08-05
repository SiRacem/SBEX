// src/redux/actions/uiActions.js

import { SET_DISPLAY_CURRENCY } from '../actionTypes/uiActionTypes';

export const setDisplayCurrency = (currency) => ({
    type: SET_DISPLAY_CURRENCY,
    payload: currency,
});