// client/src/components/vendor/feeCalculator.js
const TND_USD_EXCHANGE_RATE = 3.0;

export const calculateMediatorFeeDetails = (agreedPrice, currency = "TND") => {
    let originalPrice = Number(agreedPrice);

    if (isNaN(originalPrice) || originalPrice <= 0) {
        return {
            fee: 0, sellerShare: 0, buyerShare: 0,
            totalForBuyer: 0, netForSeller: 0,
            error: "Invalid price", currencyUsed: currency
        };
    }

    let actualCurrency = currency.toUpperCase();
    let priceInTND = originalPrice;

    if (actualCurrency === "USD") {
        priceInTND = originalPrice * TND_USD_EXCHANGE_RATE;
    }

    let feePercent = 0.05;
    if (priceInTND >= 1 && priceInTND <= 15) feePercent = 0.05;
    else if (priceInTND > 15 && priceInTND <= 50) feePercent = 0.06;
    else if (priceInTND > 50 && priceInTND <= 100) feePercent = 0.07;
    else if (priceInTND > 100) feePercent = 0.08;

    let feeInOriginalCurrency = priceInTND * feePercent;

    if (actualCurrency === "USD") {
        feeInOriginalCurrency = feeInOriginalCurrency / TND_USD_EXCHANGE_RATE;
    }

    if (feeInOriginalCurrency > originalPrice) {
        feeInOriginalCurrency = originalPrice;
    }

    const sellerShare = parseFloat((feeInOriginalCurrency / 2).toFixed(2));
    const buyerShare = parseFloat((feeInOriginalCurrency / 2).toFixed(2));
    
    // [!!!] نفس المنطق الموحد [!!!]
    const totalForBuyer = parseFloat((originalPrice + buyerShare).toFixed(2));
    const netForSeller = parseFloat((originalPrice - sellerShare).toFixed(2));

    return {
        fee: parseFloat(feeInOriginalCurrency.toFixed(2)),
        sellerShare,
        buyerShare,
        totalForBuyer,
        netForSeller,
        currencyUsed: actualCurrency,
        priceOriginal: parseFloat(originalPrice.toFixed(2))
    };
};