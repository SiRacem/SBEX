// src/hooks/useCurrencyDisplay.js
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next'; // <-- 1. استيراد الهوك

const useCurrencyDisplay = (baseAmountTND) => {
    // 2. الحصول على دالة الترجمة t و instance i18n
    const { t, i18n } = useTranslation();

    // تأكد من أن مسار displayCurrency في الـ reducer صحيح
    const displayCurrency = useSelector(state => state.currencyReducer?.selectedCurrency || 'TND');
    const exchangeRates = useSelector(state => state.currencyReducer?.exchangeRates || {});

    const baseAmount = Number(baseAmountTND) || 0;

    const formattedValue = useMemo(() => {
        let displayedAmount = baseAmount;
        let approximateAmount;
        let approximateCurrency;

        // تحديد المبلغ المعروض والمبلغ التقريبي
        if (displayCurrency === 'USD') {
            displayedAmount = baseAmount * (exchangeRates.USD || (1 / 3.0)); // استخدام سعر الصرف أو قيمة افتراضية
            approximateAmount = baseAmount; // المبلغ الأصلي بالـ TND
            approximateCurrency = 'TND';
        } else { // الحالة الافتراضية هي TND
            displayedAmount = baseAmount;
            approximateAmount = baseAmount * (exchangeRates.USD || (1 / 3.0));
            approximateCurrency = 'USD';
        }

        // 3. استخدام لغة i18n الحالية لتهيئة الأرقام (للفواصل العشرية وآلاف)
        const numberFormatter = new Intl.NumberFormat(i18n.language, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

        const formattedAmount = numberFormatter.format(displayedAmount);

        // 4. ترجمة رمز العملة إلى اسمها الكامل
        const currencyDisplayName = t(`dashboard.currencies.${displayCurrency}`, displayCurrency);

        // 5. تحديد مكان رمز العملة بناءً على اتجاه اللغة
        const displayValue = i18n.dir() === 'rtl'
            ? `${formattedAmount} ${currencyDisplayName}`
            : `${currencyDisplayName} ${formattedAmount}`;

        let approxValue = '';
        if (approximateCurrency) {
            const formattedApproxAmount = numberFormatter.format(approximateAmount);
            const approxCurrencyDisplayName = t(`dashboard.currencies.${approximateCurrency}`, approximateCurrency);

            approxValue = i18n.dir() === 'rtl'
                ? `≈ ${formattedApproxAmount} ${approxCurrencyDisplayName}`
                : `≈ ${approxCurrencyDisplayName} ${formattedApproxAmount}`;
        }

        return { displayValue, approxValue };

    }, [baseAmount, displayCurrency, exchangeRates, t, i18n.language, i18n.dir]);

    return formattedValue;
};

export default useCurrencyDisplay;