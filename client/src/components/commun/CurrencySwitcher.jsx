// src/components/commun/CurrencySwitcher.jsx (مكون جديد ومُعاد استخدامه)
import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Button, ButtonGroup } from 'react-bootstrap';
import { setDisplayCurrency } from '../../redux/actions/uiActions'; // Adjust path

const CurrencySwitcher = ({ size = "sm" }) => {
    const dispatch = useDispatch();
    const currentDisplayCurrency = useSelector(state => state.ui?.displayCurrency || 'TND');

    const handleCurrencyChange = (currency) => {
        dispatch(setDisplayCurrency(currency));
    };

    return (
        <ButtonGroup size={size} className="currency-switcher">
            <Button
                variant={currentDisplayCurrency === 'TND' ? 'primary' : 'outline-secondary'}
                onClick={() => handleCurrencyChange('TND')}
                active={currentDisplayCurrency === 'TND'}
            >
                TND
            </Button>
            <Button
                variant={currentDisplayCurrency === 'USD' ? 'primary' : 'outline-secondary'}
                onClick={() => handleCurrencyChange('USD')}
                active={currentDisplayCurrency === 'USD'}
            >
                USD
            </Button>
        </ButtonGroup>
    );
};

export default CurrencySwitcher;

// Optional CSS for the component (e.g., in App.css or a dedicated file)
/*
.currency-switcher .btn {
    // Custom styles if needed
}
*/