// src/redux/store.js
import { createStore, applyMiddleware, compose } from 'redux';
import { thunk } from 'redux-thunk'; // تأكد من أن هذا هو الاستيراد الصحيح لمكتبة redux-thunk
import rootReducer from './reducers/rootReducer';

const initialState = {}; // من الجيد أن يكون لديك initialState فارغ على الأقل

const middleware = [thunk];

// --- الطريقة الصحيحة لدمج Redux DevTools ---
const composeEnhancers = 
    typeof window === 'object' && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ ?   
        window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({
            // Specify extension’s options like name, actionsBlacklist, actionsCreators, serialize...
        }) : compose;

const enhancer = composeEnhancers(
  applyMiddleware(...middleware)
  // يمكنك إضافة enhancers أخرى هنا إذا أردت
);

const store = createStore(
  rootReducer,
  initialState,
  enhancer // استخدم الـ enhancer المجمع هنا
);
// -----------------------------------------

export default store;