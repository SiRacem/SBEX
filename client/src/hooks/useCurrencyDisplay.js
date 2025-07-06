// src/hooks/useCurrencyDisplay.js
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

/**
 * Hook مخصص لحساب وعرض العملات بناءً على التفضيل العام واللغة الحالية.
 * @param {number | string | undefined} baseAmountTND - المبلغ الأساسي بالدينار التونسي.
 * @returns {{ displayValue: string, approxValue: string }} - كائن يحتوي على المبلغ المعروض والمبلغ التقريبي.
 */
const useCurrencyDisplay = (baseAmountTND) => {
    const { t, i18n } = useTranslation();

    // تأكد من أن مسار الـ reducer صحيح أو استخدم قيمًا افتراضية
    const displayCurrency = useSelector(state => state.currencyReducer?.selectedCurrency || 'TND');
    const exchangeRates = useSelector(state => state.currencyReducer?.exchangeRates || {});

    const baseAmount = Number(baseAmountTND) || 0;

    const formattedValue = useMemo(() => {
        let displayedAmount = baseAmount;
        let approximateAmount;
        let approximateCurrency;

        // منطق حساب العملة
        if (displayCurrency === 'USD') {
            // لنفترض أن exchangeRates.TND_per_USD هو سعر الدولار بالدينار (مثل 3.0)
            displayedAmount = baseAmount / (exchangeRates.TND_per_USD || 3.0);
            approximateAmount = baseAmount;
            approximateCurrency = 'TND';
        } else if (displayCurrency === 'EUR') {
            // لنفترض أن exchangeRates.TND_per_EUR هو سعر اليورو بالدينار (مثل 3.3)
            displayedAmount = baseAmount / (exchangeRates.TND_per_EUR || 3.3);
            approximateAmount = baseAmount;
            approximateCurrency = 'TND';
        } else { // الحالة الافتراضية هي TND
            displayedAmount = baseAmount;
            approximateAmount = baseAmount / (exchangeRates.TND_per_USD || 3.0);
            approximateCurrency = 'USD';
        }

        // 1. تهيئة الرقم كنص مع فواصل عشرية فقط، بدون رمز العملة.
        const numberFormatter = (num) => num.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

        const formattedAmount = numberFormatter(displayedAmount);

        // 2. ترجمة اسم العملة (مثل "دينار تونسي", "TND", "دينار")
        const currencyDisplayName = t(`dashboard.currencies.${displayCurrency}`, displayCurrency);

        // 3. نركب السلسلة النهائية يدويًا بناءً على اتجاه اللغة
        const displayValue = i18n.dir() === 'rtl'
            ? `${formattedAmount} ${currencyDisplayName}`
            : `${currencyDisplayName} ${formattedAmount}`;

        // 4. نفس المنطق للجزء التقريبي، مع استخدام الرموز العالمية للألفة
        let approxValue = '';
        if (approximateCurrency && approximateAmount !== undefined) {
            const formattedApproxAmount = numberFormatter(approximateAmount);

            if (approximateCurrency === 'USD') {
                approxValue = `≈ $${formattedApproxAmount}`;
            } else if (approximateCurrency === 'EUR') {
                approxValue = `≈ €${formattedApproxAmount}`;
            } else if (approximateCurrency === 'TND') {
                const tndDisplayName = t('dashboard.currencies.TND', 'TND');
                approxValue = i18n.dir() === 'rtl'
                    ? `≈ ${formattedApproxAmount} ${tndDisplayName}`
                    : `≈ ${tndDisplayName} ${formattedApproxAmount}`;
            }
        }

        return { displayValue, approxValue };

    }, [baseAmount, displayCurrency, exchangeRates, t, i18n]);

    return formattedValue;
};

export default useCurrencyDisplay;