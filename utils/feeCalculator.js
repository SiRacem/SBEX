// server/utils/feeCalculator.js
const TND_USD_EXCHANGE_RATE = 3.0; // سعر الصرف المعتمد الذي ذكرته

const calculateMediatorFeeDetails = (agreedPrice, currency = "TND") => {
    let originalPrice = Number(agreedPrice);
    if (isNaN(originalPrice) || originalPrice <= 0) {
        console.warn("[FeeCalculator BE] Invalid or zero price received:", agreedPrice);
        return { fee: 0, sellerShare: 0, buyerShare: 0, totalForBuyerAfterFee: originalPrice, netForSellerAfterFee: originalPrice, error: "Invalid or zero price", currencyUsed: currency, feeInTND: 0, priceOriginal: originalPrice };
    }

    let priceInTND;
    if (currency === "USD") {
        priceInTND = originalPrice * TND_USD_EXCHANGE_RATE;
    } else if (currency === "TND") {
        priceInTND = originalPrice;
    } else {
        console.warn(`[FeeCalculator BE] Unsupported currency for fee calculation: ${currency}`);
        return {
            fee: 0, sellerShare: 0, buyerShare: 0,
            totalForBuyerAfterFee: price, // اسم أوضح
            netForSellerAfterFee: price,    // اسم أوضح
            error: "Invalid or zero price",
            currencyUsed: currency,
            feeInTND: 0, // إذا كان السعر صفرًا، فالعمولة صفر
            priceOriginal: price
        };
    }

    let feePercent = 0;
    if (priceInTND >= 1 && priceInTND <= 15) {
        feePercent = 0.05; // 5%
    } else if (priceInTND > 15 && priceInTND <= 50) { // من 16 إلى 50 TND
        feePercent = 0.06; // 6%
    } else if (priceInTND > 50 && priceInTND <= 100) {
        feePercent = 0.07; // 7%
    } else if (priceInTND > 100) {
        feePercent = 0.08; // 8%
    }
    // لا يوجد 'else' هنا، feePercent سيبقى 0 إذا كان priceInTND أقل من 1

    let calculatedFeeInTND = priceInTND * feePercent;

    // إذا كان سعر المنتج الأصلي بالدولار، قم بتحويل العمولة المحسوبة بالدينار مرة أخرى إلى الدولار
    let feeInOriginalCurrency = calculatedFeeInTND;
    if (currency === "USD") {
        feeInOriginalCurrency = calculatedFeeInTND / TND_USD_EXCHANGE_RATE;
    }

    // تأكد أن العمولة (بعملة المنتج الأصلية) لا تتجاوز السعر الأصلي
    if (feeInOriginalCurrency > originalPrice && originalPrice > 0) {
        feeInOriginalCurrency = originalPrice;
        // إذا تم تعديل العمولة، أعد حسابها بالدينار
        if (currency === "USD") {
            calculatedFeeInTND = feeInOriginalCurrency * TND_USD_EXCHANGE_RATE;
        } else {
            calculatedFeeInTND = feeInOriginalCurrency;
        }
    }
    
    // الآن feeInOriginalCurrency هي العمولة بعملة المنتج، و calculatedFeeInTND هي العمولة بالدينار

    const sellerShare = parseFloat((feeInOriginalCurrency / 2).toFixed(3));
    const buyerShare = parseFloat((feeInOriginalCurrency / 2).toFixed(3));
    const totalForBuyerAfterFee = parseFloat((originalPrice + buyerShare).toFixed(3));
    const netForSellerAfterFee = parseFloat((originalPrice - sellerShare).toFixed(3));

    return {
        fee: parseFloat(feeInOriginalCurrency.toFixed(3)), // العمولة بعملة المنتج الأصلية
        sellerShare, // بعملة المنتج الأصلية
        buyerShare,  // بعملة المنتج الأصلية
        totalForBuyerAfterFee, // بعملة المنتج الأصلية
        netForSellerAfterFee,    // بعملة المنتج الأصلية
        currencyUsed: currency,
        feeInTND: parseFloat(calculatedFeeInTND.toFixed(3)), // العمولة دائمًا بالدينار للمرجعية
        priceOriginal: parseFloat(originalPrice.toFixed(3)),
    };
};

module.exports = { calculateMediatorFeeDetails };