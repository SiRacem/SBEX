import React, { useMemo } from "react";
import { Modal, Button, Table, Badge } from "react-bootstrap";
import { useTranslation, Trans } from "react-i18next";
import { useSelector } from "react-redux";

// أضف بعض الأنماط المباشرة لتكبير الخط
const largerFont = { fontSize: "1rem" };
const largerFontTwo = { fontSize: "1.2rem" };

const FeeExplanationModal = ({ show, onHide, feeDetails, agreedPrice }) => {
  const { t } = useTranslation();
  const currentUser = useSelector((state) => state.userReducer.user);
  const userRole = currentUser?.userRole;

  const TND_USD_EXCHANGE_RATE = 3.0;

  const formatCurrencyDynamic = (amount, currency) => {
    const locale = currency === "USD" ? "en-US" : "fr-TN";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const hasDynamicData = feeDetails && !feeDetails.error && agreedPrice > 0;
  const currency = hasDynamicData ? feeDetails.currencyUsed : "TND";

  const feeTiers = useMemo(() => {
      const tndTiers = [
        { min: 1, max: 15, percentage: "5%" },
        { min: 15.01, max: 50, percentage: "6%" },
        { min: 50.01, max: 100, percentage: "7%" },
        { min: 100.01, max: Infinity, percentage: "8%" },
      ];
  
      if (currency === "USD") {
        return tndTiers.map((tier) => {
          const minUSD = tier.min / TND_USD_EXCHANGE_RATE;
          if (tier.max === Infinity) {
            return {
              range: `> ${formatCurrencyDynamic(minUSD, "USD")}`,
              percentage: tier.percentage,
            };
          }
          const maxUSD = tier.max / TND_USD_EXCHANGE_RATE;
          return {
            range: `${formatCurrencyDynamic(
              minUSD,
              "USD"
            )} - ${formatCurrencyDynamic(maxUSD, "USD")}`,
            percentage: tier.percentage,
          };
        });
      }
  
      return tndTiers.map((tier) => {
        if (tier.max === Infinity) {
          return {
            range: `> ${tier.min.toFixed(2)} TND`,
            percentage: tier.percentage,
          };
        }
        return {
          range: `${tier.min.toFixed(2)} - ${tier.max.toFixed(2)} TND`,
          percentage: tier.percentage,
        };
      });
    }, [currency]);

  const getHighlightClass = (perspective) => {
    const lowerCaseUserRole = userRole?.toLowerCase();
    if (perspective.toLowerCase() === lowerCaseUserRole) {
      return "table-primary";
    }
    if (perspective === "Mediator" && currentUser?.isMediatorQualified) {
      return "table-primary";
    }
    return "";
  };

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{t("feeModal.title")}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          <Trans i18nKey="feeModal.description">...</Trans>
        </p>
        <h5 className="mt-4">{t("feeModal.feeTiers")}</h5>
        {/* [!!!] START: تعديل جدول الشرائح [!!!] */}
        <Table
          striped
          bordered
          hover
          responsive
          className="mt-2 text-center align-middle"
        >
          <thead>
            <tr>
              <th className="text-center">
                {t(
                  currency === "USD"
                    ? "feeModal.priceRangeUSD"
                    : "feeModal.priceRange"
                )}
              </th>
              <th className="text-center">{t("feeModal.commissionRate")}</th>
            </tr>
          </thead>
          <tbody>
            {feeTiers.map((tier, index) => (
              <tr key={index}>
                <td className="text-center">{tier.range}</td>
                <td className="text-center" style={largerFontTwo}>
                  <Badge bg="info">{tier.percentage}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        {/* [!!!] END: نهاية تعديل جدول الشرائح [!!!] */}

        <h5 className="mt-4">{t("feeModal.example.title")}</h5>

        {hasDynamicData ? (
          <>
            <p>
              <Trans
                i18nKey="feeModal.example.dynamicScenario"
                values={{ price: formatCurrencyDynamic(agreedPrice, currency) }}
                components={{ strong: <strong /> }}
              />
            </p>
            {/* [!!!] START: تعديل جدول المثال [!!!] */}
            <Table
              bordered
              responsive
              size="sm"
              className="mt-2 calculation-table align-middle"
            >
              <tbody>
                <tr>
                  <td>{t("feeModal.example.rate")}</td>
                  <td className="text-center" style={largerFont}>
                    <strong>
                      {((feeDetails.fee / agreedPrice) * 100).toFixed(0)}%
                    </strong>
                  </td>
                </tr>
                <tr className={getHighlightClass("Mediator")}>
                  <td>
                    {t("feeModal.example.totalFee", {
                      price: agreedPrice.toFixed(2),
                      percent: ((feeDetails.fee / agreedPrice) * 100).toFixed(
                        0
                      ),
                    })}
                  </td>
                  <td className="text-center" style={largerFont}>
                    <strong>
                      {formatCurrencyDynamic(feeDetails.fee, currency)}
                    </strong>
                  </td>
                </tr>
                <tr className={getHighlightClass("Buyer")}>
                  <td>{t("feeModal.example.buyerShare")}</td>
                  <td className="text-center" style={largerFont}>
                    <strong>
                      {formatCurrencyDynamic(feeDetails.buyerShare, currency)}
                    </strong>
                  </td>
                </tr>
                <tr className={getHighlightClass("Seller")}>
                  <td>{t("feeModal.example.sellerShare")}</td>
                  <td className="text-center" style={largerFont}>
                    <strong>
                      {formatCurrencyDynamic(feeDetails.sellerShare, currency)}
                    </strong>
                  </td>
                </tr>
                <tr className={`fw-bold ${getHighlightClass("Buyer")}`}>
                  <td>
                    {t("feeModal.example.buyerTotal", {
                      price: agreedPrice.toFixed(2),
                      share: feeDetails.buyerShare.toFixed(2),
                    })}
                  </td>
                  <td className="text-center text-danger" style={largerFont}>
                    <strong>
                      {formatCurrencyDynamic(
                        feeDetails.totalForBuyer,
                        currency
                      )}
                    </strong>
                  </td>
                </tr>
                <tr className={`fw-bold ${getHighlightClass("Seller")}`}>
                  <td>
                    {t("feeModal.example.sellerNet", {
                      price: agreedPrice.toFixed(2),
                      share: feeDetails.sellerShare.toFixed(2),
                    })}
                  </td>
                  <td className="text-center text-success" style={largerFont}>
                    <strong>
                      {formatCurrencyDynamic(feeDetails.netForSeller, currency)}
                    </strong>
                  </td>
                </tr>
              </tbody>
            </Table>
            {/* [!!!] END: نهاية تعديل جدول المثال [!!!] */}
          </>
        ) : (
          <p>{t("feeModal.example.noData")}</p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          {t("common.close")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default FeeExplanationModal;