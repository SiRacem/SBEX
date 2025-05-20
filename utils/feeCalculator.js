// utils/feeCalculator.js
const TND_USD_EXCHANGE_RATE = 3.0; // سعر الصرف المعتمد

const calculateMediatorFeeDetails = (agreedPrice, currency = "TND") => {
    let originalPrice = Number(agreedPrice);

    console.log(`[FeeCalculator SERVER IN] agreedPrice: ${agreedPrice}, currency: ${currency}, originalPrice: ${originalPrice}`);

    if (isNaN(originalPrice) || originalPrice <= 0) {
        console.warn("[FeeCalculator SERVER] Invalid or zero price received:", agreedPrice);
        const result = {
            fee: 0, sellerShare: 0, buyerShare: 0,
            totalForBuyer: originalPrice, netForSeller: originalPrice,
            error: "Invalid or zero price", currencyUsed: currency,
            feeInTND: 0, priceOriginal: originalPrice
        };
        console.log("[FeeCalculator SERVER OUT - Invalid Price]:", JSON.stringify(result, null, 2));
        return result;
    }

    let priceInTND;
    let actualCurrency = currency.toUpperCase(); // توحيد حالة الأحرف للتحقق

    if (actualCurrency === "USD") {
        priceInTND = originalPrice * TND_USD_EXCHANGE_RATE;
    } else if (actualCurrency === "TND") {
        priceInTND = originalPrice;
    } else {
        console.warn(`[FeeCalculator SERVER] Unsupported currency for fee calculation: ${currency}. Returning original price without fees.`);
        const result = {
            fee: 0, sellerShare: 0, buyerShare: 0,
            totalForBuyer: originalPrice,
            netForSeller: originalPrice,
            error: `Unsupported currency: ${currency}`,
            currencyUsed: currency,
            feeInTND: 0,
            priceOriginal: originalPrice
        };
        console.log("[FeeCalculator SERVER OUT - Unsupported Currency]:", JSON.stringify(result, null, 2));
        return result;
    }
    console.log(`[FeeCalculator SERVER] priceInTND for slab calculation: ${priceInTND}`);

    let feePercent = 0;
    if (priceInTND >= 1 && priceInTND <= 15) {
        feePercent = 0.05; // 5%
    } else if (priceInTND > 15 && priceInTND <= 50) {
        feePercent = 0.06; // 6%
    } else if (priceInTND > 50 && priceInTND <= 100) {
        feePercent = 0.07; // 7%
    } else if (priceInTND > 100) {
        feePercent = 0.08; // 8%
    }
    console.log(`[FeeCalculator SERVER] feePercent determined: ${feePercent * 100}%`);

    let calculatedFeeInTND = priceInTND * feePercent;
    console.log(`[FeeCalculator SERVER] calculatedFeeInTND: ${calculatedFeeInTND}`);

    let feeInOriginalCurrency = calculatedFeeInTND;
    if (actualCurrency === "USD") {
        feeInOriginalCurrency = calculatedFeeInTND / TND_USD_EXCHANGE_RATE;
    }
    console.log(`[FeeCalculator SERVER] feeInOriginalCurrency (before cap): ${feeInOriginalCurrency} ${actualCurrency}`);

    if (feeInOriginalCurrency > originalPrice && originalPrice > 0) {
        console.log(`[FeeCalculator SERVER] Fee capped at original price. Old fee: ${feeInOriginalCurrency}, New fee: ${originalPrice}`);
        feeInOriginalCurrency = originalPrice;
        if (actualCurrency === "USD") {
            calculatedFeeInTND = feeInOriginalCurrency * TND_USD_EXCHANGE_RATE;
        } else {
            calculatedFeeInTND = feeInOriginalCurrency;
        }
        console.log(`[FeeCalculator SERVER] Recalculated calculatedFeeInTND after cap: ${calculatedFeeInTND}`);
    }

    const sellerShare = parseFloat((feeInOriginalCurrency / 2).toFixed(2)); // تغيير إلى toFixed(2) للاتساق
    const buyerShare = parseFloat((feeInOriginalCurrency / 2).toFixed(2));  // تغيير إلى toFixed(2)
    const totalForBuyer = parseFloat((originalPrice + buyerShare).toFixed(2)); // تغيير إلى toFixed(2)
    const netForSeller = parseFloat((originalPrice - sellerShare).toFixed(2));   // تغيير إلى toFixed(2)

    const result = {
        fee: parseFloat(feeInOriginalCurrency.toFixed(2)),
        sellerShare,
        buyerShare,
        totalForBuyer,
        netForSeller,
        currencyUsed: actualCurrency, // استخدام العملة الموحدة
        feeInTND: parseFloat(calculatedFeeInTND.toFixed(2)),
        priceOriginal: parseFloat(originalPrice.toFixed(2)), // تغيير إلى toFixed(2)
    };
    console.log("[FeeCalculator SERVER OUT - Success]:", JSON.stringify(result, null, 2));
    return result;
};

module.exports = { calculateMediatorFeeDetails };