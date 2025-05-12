
export const calculateMediatorFeeDetails = (agreedPrice, currency = "TND") => {
    let price = Number(agreedPrice);
    if (isNaN(price) || price <= 0) {
        return { fee: 0, sellerShare: 0, buyerShare: 0, totalForBuyer: price, netForSeller: price, error: "Invalid or zero price" };
    }

    // حساب العمولة حسب الشرائح على العملة الأصلية
    let percent = 0.05;
    if (price > 15 && price <= 50) {
        percent = 0.06;
    } else if (price > 50 && price <= 100) {
        percent = 0.07;
    } else if (price > 100) {
        percent = 0.08;
    }
    let fee = price * percent;

    // تأكد من أن العمولة لا تتجاوز السعر
    if (fee > price) {
        fee = price;
    }

    // تقسيم العمولة
    const sellerShare = parseFloat((fee / 2).toFixed(3));
    const buyerShare = parseFloat((fee / 2).toFixed(3));
    let totalForBuyer = parseFloat((price + buyerShare).toFixed(3));
    let netForSeller = parseFloat((price - sellerShare).toFixed(3));

    // العمولة بالدينار دائماً (للمراجعة أو التقارير)
    let feeInTND = currency === "USD" || currency === "$US" || currency === "$USD" ? parseFloat((fee * 3).toFixed(3)) : parseFloat(fee.toFixed(3));

    return {
        fee: parseFloat(fee.toFixed(3)), // دائماً بالعملة الأصلية
        sellerShare,
        buyerShare,
        totalForBuyer,
        netForSeller,
        currencyUsed: currency,
        feeInTND,
        priceOriginal: price,
    };
};