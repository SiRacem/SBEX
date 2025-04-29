// src/redux/actions/uiActions.js
import { SET_DISPLAY_CURRENCY } from '../actionTypes/uiActionTypes'; // Adjust path if needed

/**
 * Sets the preferred display currency for balances.
 * @param {string} currency - The currency code ('TND' or 'USD').
 */
export const setDisplayCurrency = (currency) => ({
    type: SET_DISPLAY_CURRENCY,
    payload: currency, // Payload is 'TND' or 'USD'
});