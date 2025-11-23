import React, { useEffect, useState, useContext } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Container, Card, Tab, Nav, Spinner, Image, Badge, Table } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { getLeaderboards } from '../redux/actions/leaderboardAction';
import { FaCrown, FaTrophy } from 'react-icons/fa';
import './LeaderboardPage.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const defaultAvatar = "https://bootdey.com/img/Content/avatar/avatar7.png";

const handleImageError = (e) => {
    if (e.target.src !== defaultAvatar) {
        e.target.onerror = null;
        e.target.src = defaultAvatar;
    }
};

const getAvatarSrc = (avatarUrl) => {
    if (!avatarUrl) return defaultAvatar;
    if (avatarUrl.startsWith('http')) return avatarUrl;
    const cleanPath = avatarUrl.startsWith('/') ? avatarUrl.substring(1) : avatarUrl;
    return `${BACKEND_URL}/${cleanPath}`;
};

// مكون فرعي لعرض مؤشر الصعود/الهبوط
const TrendIndicator = ({ currentRank, previousRank }) => {
    if (!previousRank || previousRank === 0) {
        return <small className="text-success fw-bold" style={{fontSize: '0.65rem'}}>NEW</small>;
    }

    const diff = previousRank - currentRank; // إيجابي = صعود، سلبي = هبوط

    if (diff > 0) {
        return <small className="text-success fw-bold" style={{fontSize: '0.7rem'}}>▲ {diff}</small>;
    } else if (diff < 0) {
        return <small className="text-danger fw-bold" style={{fontSize: '0.7rem'}}>▼ {Math.abs(diff)}</small>;
    } else {
        return null;
    }
};

const Podium = ({ topThree, scoreKey, label }) => {
    const first = topThree[0];
    const second = topThree[1];
    const third = topThree[2];

    const renderPodiumItem = (user, rank) => {
        if (!user) return <div className={`podium-item podium-rank-${rank}`} style={{ opacity: 0 }}></div>;

        return (
            <div className={`podium-item podium-rank-${rank}`}>
                <div className="podium-avatar-container">
                    {rank === 1 && <FaCrown className="crown-icon" />}
                    <Image
                        src={getAvatarSrc(user.avatarUrl)}
                        roundedCircle
                        className="podium-avatar"
                        onError={handleImageError}
                        alt={user.fullName}
                    />
                    <Badge bg="dark" className="position-absolute bottom-0 start-50 translate-middle-x shadow-sm">
                        Lvl {user.level || 1}
                    </Badge>
                </div>
                <div className="podium-user-name" title={user.fullName}>{user.fullName}</div>
                <div className="podium-score">{user[scoreKey]} {label}</div>
                <div className="podium-base">{rank}</div>
            </div>
        );
    };

    return (
        <div className="podium-container">
            {renderPodiumItem(second, 2)}
            {renderPodiumItem(first, 1)}
            {renderPodiumItem(third, 3)}
        </div>
    );
};

const LeaderboardPage = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [activeTab, setActiveTab] = useState('legends');

    const { leaderboards, myRanks, loading } = useSelector(state => state.leaderboardReducer);
    const { user } = useSelector(state => state.userReducer);

    const fetchLeaderboards = () => {
        dispatch(getLeaderboards());
    };

    useEffect(() => {
        fetchLeaderboards();
    }, [dispatch]);

    const tabConfig = {
        legends: {
            dataKey: 'topReputation',
            scoreField: 'reputationPoints',
            unit: t('leaderboard.myRank.points'),
            rankKey: 'reputation'
        },
        sellers: {
            dataKey: 'topSellers',
            scoreField: 'productsSoldCount',
            unit: t('leaderboard.myRank.sales'),
            rankKey: 'sales'
        },
        mediators: {
            dataKey: 'topMediators',
            scoreField: 'successfulMediationsCount',
            unit: t('leaderboard.myRank.mediations'),
            rankKey: 'mediation'
        },
        buyers: {
            dataKey: 'topBuyers',
            scoreField: 'productsBoughtCount',
            unit: t('leaderboard.myRank.purchases'),
            rankKey: 'buys'
        },
        bidders: {
            dataKey: 'topBidders',
            scoreField: 'bidsPlacedCount',
            unit: t('leaderboard.myRank.bids'),
            rankKey: 'bids'
        }
    };

    const currentConfig = tabConfig[activeTab];
    const currentList = (leaderboards && leaderboards[currentConfig.dataKey]) ? leaderboards[currentConfig.dataKey] : [];
    const topThree = currentList.slice(0, 3);
    const restOfList = currentList.slice(3);
    const myCurrentRankInfo = (myRanks && myRanks[currentConfig.dataKey]) ? myRanks[currentConfig.dataKey] : null;

    const getBadgeName = (levelName) => {
        return t(`reputationLevels.${levelName}`, levelName);
    };

    return (
        <div className="leaderboard-page">
            <Container className="py-5">
                <div className="text-center mb-5">
                    <h1 className="fw-bold display-5">
                        {t('leaderboard.pageTitle')} <FaTrophy className="text-warning ms-2" />
                    </h1>
                    <p className="text-muted lead">{t('leaderboard.pageSubtitle')}</p>
                </div>

                <Tab.Container id="leaderboard-tabs" activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
                    <Nav variant="pills" className="justify-content-center mb-5 gap-2 flex-wrap">
                        {Object.keys(tabConfig).map(key => (
                            <Nav.Item key={key}>
                                <Nav.Link eventKey={key} className="px-4 py-2 fw-bold shadow-sm rounded-pill">
                                    {t(`leaderboard.tabs.${key}`)}
                                </Nav.Link>
                            </Nav.Item>
                        ))}
                    </Nav>

                    <Tab.Content>
                        <Tab.Pane eventKey={activeTab}>
                            {loading && !currentList.length ? (
                                <div className="text-center py-5">
                                    <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
                                    <p className="mt-3 text-muted">{t("common.loading")}</p>
                                </div>
                            ) : currentList.length === 0 ? (
                                <div className="text-center py-5 text-muted">
                                    <div className="mb-3" style={{ fontSize: '3rem', opacity: 0.3 }}>🏆</div>
                                    <h4>{t('leaderboard.empty')}</h4>
                                </div>
                            ) : (
                                <>
                                    <Podium topThree={topThree} scoreKey={currentConfig.scoreField} label={currentConfig.unit} />

                                    {restOfList.length > 0 && (
                                        <Card className="leaderboard-list-card shadow-sm mt-4">
                                            <Card.Body className="p-0">
                                                <Table hover responsive className="mb-0 align-middle text-center">
                                                    <thead className="bg-light text-uppercase small text-muted">
                                                        <tr>
                                                            <th style={{ width: '80px' }}>{t('leaderboard.table.rank')}</th>
                                                            <th style={{ width: '80px' }}></th>
                                                            <th className="text-start">{t('leaderboard.table.user')}</th>
                                                            <th>{t('selectMediatorModal.level')}</th>
                                                            <th style={{ width: '100px' }}>{t('leaderboard.table.level')}</th>
                                                            <th className="text-end pe-4">{t('leaderboard.table.score')}</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {restOfList.map((u, idx) => {
                                                            const rank = idx + 4;
                                                            // استخراج الترتيب السابق من الكائن الجديد في قاعدة البيانات
                                                            const previousRank = u.previousRanks ? u.previousRanks[currentConfig.rankKey] : 0;

                                                            return (
                                                                <tr key={u._id} className="rank-item-row">
                                                                    <td className="fw-bold text-muted">
                                                                        <div className="d-flex flex-column align-items-center">
                                                                            <span className="fs-5">#{rank}</span>
                                                                            {/* استخدام المكون الجديد */}
                                                                            <TrendIndicator currentRank={rank} previousRank={previousRank} />
                                                                        </div>
                                                                    </td>
                                                                    <td>
                                                                        <Image
                                                                            src={getAvatarSrc(u.avatarUrl)}
                                                                            roundedCircle
                                                                            width={50}
                                                                            height={50}
                                                                            className="border shadow-sm"
                                                                            onError={handleImageError}
                                                                        />
                                                                    </td>
                                                                    <td className="text-start fw-bold text-dark">
                                                                        {u.fullName}
                                                                    </td>
                                                                    <td>
                                                                        <Badge bg="light" text="dark" className="border px-3 py-2">
                                                                            {getBadgeName(u.reputationLevel)}
                                                                        </Badge>
                                                                    </td>
                                                                    <td>
                                                                        <div className="d-flex justify-content-center">
                                                                            <div className="level-circle-indicator">
                                                                                {u.level || 1}
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="text-end pe-4">
                                                                        <span className="fw-bold text-primary fs-5">{u[currentConfig.scoreField]}</span>
                                                                        <small className="text-muted ms-1">{currentConfig.unit}</small>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </Table>
                                            </Card.Body>
                                        </Card>
                                    )}
                                </>
                            )}
                        </Tab.Pane>
                    </Tab.Content>
                </Tab.Container>
            </Container>

            {/* الشريط السفلي بالتصميم الجديد */}
            {user && !loading && myCurrentRankInfo && (
                <div className="my-rank-bar">
                    <div className="d-flex align-items-center">
                        <Image
                            src={getAvatarSrc(user.avatarUrl)}
                            roundedCircle
                            width={50}
                            height={50}
                            className="me-3 border border-3 border-warning shadow-sm"
                            onError={handleImageError}
                        />
                        <div>
                            <div className="fw-bold text-dark" style={{ fontSize: '1.1rem' }}>{t('leaderboard.myRank.label')}</div>
                            <div className="small text-muted">{user.fullName}</div>
                        </div>
                    </div>

                    <div className="d-flex align-items-center gap-4">
                        <div className="text-end d-none d-sm-block">
                            <small className="text-uppercase text-muted d-block" style={{ fontSize: '0.65rem' }}>{t('leaderboard.myRank.scoreLabel')}</small>
                            <span className="fw-bold text-dark">
                                {myCurrentRankInfo.score} <span className="text-muted small">{currentConfig.unit}</span>
                            </span>
                        </div>
                        <div className="text-end ps-3 border-start">
                            <small className="text-uppercase text-muted d-block" style={{ fontSize: '0.65rem' }}>{t('leaderboard.myRank.rankLabel')}</small>
                            <span className="display-6 fw-bold text-primary" style={{ fontSize: '2rem', lineHeight: 1 }}>
                                #{myCurrentRankInfo.rank}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeaderboardPage;