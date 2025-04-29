// src/hooks/useCurrencyDisplay.js (Hook مخصص جديد)
import { useMemo } from 'react';
import { useSelector } from 'react-redux';

// سعر الصرف - يجب أن يكون في مكان مركزي أو كـ prop إذا تغير
const TND_TO_USD_RATE = 3.0;

/**
 * Hook مخصص لحساب وعرض العملات بناءً على التفضيل العام.
 * @param {number | string | undefined} baseAmountTND - المبلغ الأساسي بالدينار التونسي.
 * @returns {object} - كائن يحتوي على المبلغ المعروض المنسق، العملة المعروضة، والمبلغ التقريبي المنسق.
 * { displayValue: string, displayCurrency: string, approxValue: string }
 */
const useCurrencyDisplay = (baseAmountTND) => {
    const displayCurrency = useSelector(state => state.ui?.displayCurrency || 'TND');
    const baseAmount = Number(baseAmountTND) || 0; // تحويل آمن لرقم، الافتراضي 0

    const { displayValue, approxValue } = useMemo(() => {
        let displayedAmount = baseAmount;
        let approximateAmount = baseAmount / TND_TO_USD_RATE;
        let approximateCurrency = 'USD';

        if (displayCurrency === 'USD') {
            displayedAmount = baseAmount / TND_TO_USD_RATE;
            approximateAmount = baseAmount; // المبلغ الأصلي بالـ TND
            approximateCurrency = 'TND';
        }

        const formatOptions = { style: 'currency', minimumFractionDigits: 2 };

        const formattedDisplayValue = new Intl.NumberFormat('en-US', {
            ...formatOptions,
            currency: displayCurrency,
        }).format(displayedAmount);

        const formattedApproxValue = `≈ ${new Intl.NumberFormat('en-US', {
            ...formatOptions,
            currency: approximateCurrency,
        }).format(approximateAmount)}`;

        return { displayValue: formattedDisplayValue, approxValue: formattedApproxValue };

    }, [baseAmount, displayCurrency]); // إعادة الحساب فقط عند تغير المبلغ الأساسي أو العملة المختارة

    return { displayValue, displayCurrency, approxValue };
};

export default useCurrencyDisplay;