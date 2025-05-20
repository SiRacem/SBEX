// client/src/components/vendor/feeCalculator.js أو المسار الصحيح

// افترض أن لديك TND_USD_EXCHANGE_RATE متاح هنا أيضًا (يمكن تمريره أو استيراده)
const TND_USD_EXCHANGE_RATE = 3.0; // أو احصل عليه من config/env

export const calculateMediatorFeeDetails = (agreedPrice, currency = "TND") => {
    let originalPrice = Number(agreedPrice);
    if (isNaN(originalPrice) || originalPrice <= 0) {
        console.warn("[FeeCalculator FE] Invalid or zero price received:", agreedPrice);
        return { 
            fee: 0, sellerShare: 0, buyerShare: 0, 
            totalForBuyer: originalPrice, // اسم موحد
            netForSeller: originalPrice,    // اسم موحد
            error: "Invalid or zero price", 
            currencyUsed: currency, 
            feeInTND: 0, 
            priceOriginal: originalPrice 
        };
    }

    let priceInTNDForSlab;
    let actualCurrency = currency.toUpperCase(); // توحيد حالة الأحرف

    if (actualCurrency === "USD") {
        priceInTNDForSlab = originalPrice * TND_USD_EXCHANGE_RATE;
    } else if (actualCurrency === "TND") {
        priceInTNDForSlab = originalPrice;
    } else {
        console.warn(`[FeeCalculator FE] Unsupported currency: ${currency}. Assuming TND for slabs.`);
        // يمكنك هنا أن تقرر إرجاع خطأ أو افتراض TND بحذر
        priceInTNDForSlab = originalPrice; // افتراض حذر
        // أو:
        // return { error: `Unsupported currency: ${currency}`, ... (باقي القيم صفرية) };
    }

    let feePercent = 0;
    if (priceInTNDForSlab >= 1 && priceInTNDForSlab <= 15) {
        feePercent = 0.05;
    } else if (priceInTNDForSlab > 15 && priceInTNDForSlab <= 50) {
        feePercent = 0.06;
    } else if (priceInTNDForSlab > 50 && priceInTNDForSlab <= 100) {
        feePercent = 0.07;
    } else if (priceInTNDForSlab > 100) {
        feePercent = 0.08;
    }

    let calculatedFeeInTND = priceInTNDForSlab * feePercent;

    let feeInOriginalCurrency = calculatedFeeInTND;
    if (actualCurrency === "USD") {
        feeInOriginalCurrency = calculatedFeeInTND / TND_USD_EXCHANGE_RATE;
    }
    
    // تأكد أن العمولة لا تتجاوز السعر الأصلي
    if (feeInOriginalCurrency > originalPrice && originalPrice > 0) {
        feeInOriginalCurrency = originalPrice;
         // إذا تم تعديل العمولة، أعد حسابها بالدينار للمرجعية فقط
        if (actualCurrency === "USD") {
            calculatedFeeInTND = feeInOriginalCurrency * TND_USD_EXCHANGE_RATE;
        } else {
            calculatedFeeInTND = feeInOriginalCurrency;
        }
    }

    const sellerShare = parseFloat((feeInOriginalCurrency / 2).toFixed(2));
    const buyerShare = parseFloat((feeInOriginalCurrency / 2).toFixed(2));
    
    // استخدام الأسماء الموحدة
    const totalForBuyer = parseFloat((originalPrice + buyerShare).toFixed(2));
    const netForSeller = parseFloat((originalPrice - sellerShare).toFixed(2));

    return {
        fee: parseFloat(feeInOriginalCurrency.toFixed(2)),
        sellerShare,
        buyerShare,
        totalForBuyer, // اسم موحد
        netForSeller,   // اسم موحد
        currencyUsed: actualCurrency, // استخدام العملة الموحدة
        feeInTND: parseFloat(calculatedFeeInTND.toFixed(2)),
        priceOriginal: parseFloat(originalPrice.toFixed(2)),
    };
};