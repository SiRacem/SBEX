import React, { memo } from 'react';
import { Wheel } from 'react-custom-roulette';

// استخدام memo لمنع إعادة الرسم غير الضرورية
const WheelComponent = memo(({ mustSpin, prizeNumber, data, onStopSpinning }) => {
    return (
        <div className="wheel-border">
            <Wheel
                mustStartSpinning={mustSpin}
                prizeNumber={prizeNumber}
                data={data}
                onStopSpinning={onStopSpinning}
                outerBorderColor="#2c3e50"
                outerBorderWidth={8}
                innerRadius={10}
                innerBorderColor="#2c3e50"
                innerBorderWidth={0}
                radiusLineColor="rgba(255, 255, 255, 0.2)"
                radiusLineWidth={1}
                fontSize={14}
                textDistance={60}
                perpendicularText={false}
                textColors={['#ffffff']}
            />
        </div>
    );
}, (prevProps, nextProps) => {
    // دالة مقارنة مخصصة: أعد الرسم فقط إذا تغيرت حالة الدوران أو رقم الجائزة
    // أو إذا تغيرت البيانات (وهذا لا يحدث أثناء الدوران)
    return (
        prevProps.mustSpin === nextProps.mustSpin &&
        prevProps.prizeNumber === nextProps.prizeNumber &&
        prevProps.data === nextProps.data // مقارنة المرجع
    );
});

export default WheelComponent;