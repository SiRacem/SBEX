// src/components/commun/CurrencySwitcher.jsx

import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { ButtonGroup, Button } from "react-bootstrap";
import { useTranslation } from "react-i18next"; // Import useTranslation
import { setDisplayCurrency } from "../../redux/actions/currencyAction";

const CurrencySwitcher = ({ size = "md" }) => {
  const { t } = useTranslation(); // Initialize useTranslation
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
        {t("dashboard.currencies.TND", "TND")}
      </Button>
      <Button
        variant={selectedCurrency === "USD" ? "primary" : "outline-secondary"}
        onClick={() => handleCurrencyChange("USD")}
      >
        {t("dashboard.currencies.USD", "USD")}
      </Button>
    </ButtonGroup>
  );
};

export default CurrencySwitcher;
