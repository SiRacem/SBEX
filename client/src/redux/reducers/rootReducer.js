import { combineReducers } from "redux";
import userReducer from "./userReducer";
import productReducer from "./productReducer";
import notificationReducer from "./notificationReducer";
import walletReducer from "./walletReducer";
import adminUserReducer from "./adminUserReducer";
import transactionReducer from "./transactionReducer";
import uiReducer from "./uiReducer";
import paymentMethodReducer from "./paymentMethodReducer";
import depositRequestReducer from "./depositRequestReducer";
import withdrawalRequestReducer from "./withdrawalRequestReducer";
import mediationReducer from "./mediationReducer";
import ratingReducer from './ratingReducer';
import { ticketReducer } from './ticketReducer';
import { faqReducer } from './faqReducer';
import { currencyReducer } from './currencyReducer';
import newsReducer from './newsReducer';
import achievementReducer from './achievementReducer';
import leaderboardReducer from './leaderboardReducer';
import referralReducer from './referralReducer';
import questReducer from './questReducer';
import chatReducer from './chatReducer';
import tournamentReducer from './tournamentReducer';
import leagueReducer from './leagueReducer';
// import orderReducer from "./orderReducer";
// import cartReducer from "./cartReducer";

const rootReducer = combineReducers({
    userReducer,
    productReducer,
    notificationReducer,
    walletReducer,
    adminUserReducer,
    transactionReducer,
    ui: uiReducer,
    paymentMethodReducer,
    depositRequestReducer,
    withdrawalRequestReducer,
    mediationReducer,
    ratingReducer,
    ticketReducer,
    faqReducer,
    currencyReducer,
    newsReducer,
    achievementReducer,
    leaderboardReducer,
    referralReducer,
    questReducer,
    chatReducer,
    tournamentReducer,
    leagueReducer,
    // orderReducer,
    // cartReducer,
});

export default rootReducer