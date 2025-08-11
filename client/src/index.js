// src/index.js
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import AppWrapper from './App'; // [!!!] استيراد AppWrapper بدلاً من App
import reportWebVitals from './reportWebVitals';
import store from './redux/store';
import { Provider } from 'react-redux';
import './i18n';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Suspense fallback="loading...">
      <Provider store={store}>
        <AppWrapper /> {/* [!!!] استخدام AppWrapper هنا */}
      </Provider>
    </Suspense>
  </React.StrictMode>
);

reportWebVitals();