// src/components/commun/CurrencySwitcher.jsx

import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { ButtonGroup, Button } from "react-bootstrap";
import { setDisplayCurrency } from "../../redux/actions/currencyAction"; // تأكد من المسار الصحيح

const CurrencySwitcher = ({ size = "md" }) => {
  const dispatch = useDispatch();
  const selectedCurrency = useSelector(
    (state) => state.currencyReducer.selectedCurrency
  );

  const handleCurrencyChange = (currency) => {
    dispatch(setDisplayCurrency(currency));
  };

  return (
    <ButtonGroup size={size}>
      <Button
        variant={selectedCurrency === "TND" ? "primary" : "outline-secondary"}
        onClick={() => handleCurrencyChange("TND")}
      >
        TND
      </Button>
      <Button
        variant={selectedCurrency === "USD" ? "primary" : "outline-secondary"}
        onClick={() => handleCurrencyChange("USD")}
      >
        USD
      </Button>
      {/* يمكنك إضافة عملات أخرى هنا مثل EUR */}
    </ButtonGroup>
  );
};

export default CurrencySwitcher;
