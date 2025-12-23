import React, { useMemo } from 'react';
import { Table, Badge, Row, Col } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FaTrophy, FaFutbol, FaShieldAlt } from 'react-icons/fa';
import './LeagueStandingsView.css';

const LeagueStandingsView = ({ matches, participants, showStatsOnly = false, hideStatsCards = false }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    // حساب ترتيب الدوري من المشاركين والمباريات
    const standings = useMemo(() => {
        if (!participants || participants.length === 0) return [];

        const stats = {};

        // تهيئة الإحصائيات لكل لاعب
        participants.forEach(p => {
            stats[p.user?._id || p.user] = {
                id: p.user?._id || p.user,
                name: p.user?.fullName || p.username || 'Unknown',
                avatar: p.user?.avatarUrl || p.avatar,
                team: p.selectedTeam,
                teamLogo: p.selectedTeamLogo,
                played: 0,
                won: 0,
                drawn: 0,
                lost: 0,
                goalsFor: 0,
                goalsAgainst: 0,
                goalDiff: 0,
                points: 0
            };
        });

        // حساب الإحصائيات من المباريات المكتملة
        if (matches) {
            matches.filter(m => m.status === 'completed').forEach(match => {
                const p1Id = match.player1?._id || match.player1;
                const p2Id = match.player2?._id || match.player2;
                const score1 = match.scorePlayer1 || 0;
                const score2 = match.scorePlayer2 || 0;

                if (stats[p1Id]) {
                    stats[p1Id].played++;
                    stats[p1Id].goalsFor += score1;
                    stats[p1Id].goalsAgainst += score2;

                    if (score1 > score2) {
                        stats[p1Id].won++;
                        stats[p1Id].points += 3;
                    } else if (score1 === score2) {
                        stats[p1Id].drawn++;
                        stats[p1Id].points += 1;
                    } else {
                        stats[p1Id].lost++;
                    }
                }

                if (stats[p2Id]) {
                    stats[p2Id].played++;
                    stats[p2Id].goalsFor += score2;
                    stats[p2Id].goalsAgainst += score1;

                    if (score2 > score1) {
                        stats[p2Id].won++;
                        stats[p2Id].points += 3;
                    } else if (score2 === score1) {
                        stats[p2Id].drawn++;
                        stats[p2Id].points += 1;
                    } else {
                        stats[p2Id].lost++;
                    }
                }
            });
        }

        // ترتيب حسب النقاط ثم فارق الأهداف
        return Object.values(stats)
            .map(s => ({ ...s, goalDiff: s.goalsFor - s.goalsAgainst }))
            .sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor);
    }, [participants, matches]);

    // أفضل هجوم ودفاع
    const stats = useMemo(() => {
        if (standings.length === 0) return { bestAttack: null, bestDefense: null, biggestWin: null };

        const bestAttack = [...standings].sort((a, b) => b.goalsFor - a.goalsFor)[0];
        const bestDefense = [...standings].filter(s => s.played > 0).sort((a, b) => a.goalsAgainst - b.goalsAgainst)[0];

        // أكبر فوز
        let biggestWin = null;
        let maxDiff = 0;
        if (matches) {
            matches.filter(m => m.status === 'completed').forEach(match => {
                const diff = Math.abs((match.scorePlayer1 || 0) - (match.scorePlayer2 || 0));
                if (diff > maxDiff) {
                    maxDiff = diff;
                    biggestWin = match;
                }
            });
        }

        return { bestAttack, bestDefense, biggestWin };
    }, [standings, matches]);

    const handleMatchClick = (matchId) => {
        navigate(`/match/${matchId}`);
    };

    const getStatusBadge = (status) => {
        const variants = {
            scheduled: 'secondary',
            ongoing: 'warning',
            completed: 'success'
        };
        return <Badge bg={variants[status] || 'secondary'}>{t(`match.status.${status}`, status)}</Badge>;
    };

    // For showStatsOnly mode - show top 5 leaderboards
    if (showStatsOnly) {
        const top5Scorers = [...standings].sort((a, b) => b.goalsFor - a.goalsFor).slice(0, 5);
        const top5Defense = [...standings].sort((a, b) => a.goalsAgainst - b.goalsAgainst).slice(0, 5);

        return (
            <div className="league-stats-container">
                <Row className="g-4">
                    {/* أفضل 5 هدافين */}
                    <Col md={6}>
                        <div className="stats-leaderboard attack-leaderboard">
                            <div className="leaderboard-header">
                                <FaFutbol className="header-icon" />
                                <span>{t('tournament.stats.topScorers', 'أفضل 5 هدافين')}</span>
                            </div>
                            <div className="leaderboard-list">
                                {top5Scorers.map((player, idx) => (
                                    <div key={player.id} className={`leaderboard-item ${idx === 0 ? 'first' : ''}`}>
                                        <span className="rank">{idx + 1}</span>
                                        <img src={player.teamLogo || 'https://placehold.co/32'} alt="" className="team-logo" />
                                        <div className="player-info">
                                            <span className="team-name">{player.team}</span>
                                            <span className="player-name">{player.name}</span>
                                        </div>
                                        <Badge bg="success" className="goals-badge">{player.goalsFor}</Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Col>

                    {/* أفضل 5 دفاعات */}
                    <Col md={6}>
                        <div className="stats-leaderboard defense-leaderboard">
                            <div className="leaderboard-header">
                                <FaShieldAlt className="header-icon" />
                                <span>{t('tournament.stats.topDefense', 'أفضل 5 دفاعات')}</span>
                            </div>
                            <div className="leaderboard-list">
                                {top5Defense.map((player, idx) => (
                                    <div key={player.id} className={`leaderboard-item ${idx === 0 ? 'first' : ''}`}>
                                        <span className="rank">{idx + 1}</span>
                                        <img src={player.teamLogo || 'https://placehold.co/32'} alt="" className="team-logo" />
                                        <div className="player-info">
                                            <span className="team-name">{player.team}</span>
                                            <span className="player-name">{player.name}</span>
                                        </div>
                                        <Badge bg="info" className="goals-badge">{player.goalsAgainst}</Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Col>
                </Row>

                {/* جدول مباريات كل لاعب */}
                <div className="player-fixtures-section mt-4">
                    <div className="section-header mb-3">
                        <FaTrophy className="me-2 text-warning" />
                        <span>{t('tournament.stats.fixtures', 'جدول مباريات كل لاعب')}</span>
                    </div>
                    <Row className="g-3">
                        {standings.map(player => {
                            const playerId = String(player.id);
                            const playerMatches = matches?.filter(m => {
                                const p1Id = String(m.player1?._id || m.player1 || '');
                                const p2Id = String(m.player2?._id || m.player2 || '');
                                return p1Id === playerId || p2Id === playerId;
                            }) || [];

                            // Debug log
                            if (playerMatches.length === 0 && matches?.length > 0) {
                                console.log('No matches for player:', playerId, 'Total matches:', matches.length);
                                console.log('Match sample:', matches[0]?.player1, matches[0]?.player2);
                            }

                            return (
                                <Col md={6} lg={4} key={player.id}>
                                    <div className="player-fixture-card">
                                        <div className="fixture-player-header">
                                            <img src={player.teamLogo || 'https://placehold.co/32'} alt="" />
                                            <div>
                                                <span className="fixture-team">{player.team}</span>
                                                <span className="fixture-player">{player.name}</span>
                                            </div>
                                        </div>
                                        <div className="fixture-list">
                                            {playerMatches.length === 0 ? (
                                                <div className="no-matches-msg">
                                                    {t('tournament.noMatches', 'لا توجد مباريات بعد')}
                                                </div>
                                            ) : (
                                                playerMatches.map((match, idx) => {
                                                    const p1Id = String(match.player1?._id || match.player1 || '');
                                                    const isPlayer1 = p1Id === playerId;
                                                    const opponent = isPlayer1 ? match.player2Team : match.player1Team;
                                                    const opponentLogo = isPlayer1 ? match.player2TeamLogo : match.player1TeamLogo;
                                                    const myScore = isPlayer1 ? match.scorePlayer1 : match.scorePlayer2;
                                                    const oppScore = isPlayer1 ? match.scorePlayer2 : match.scorePlayer1;

                                                    return (
                                                        <div key={match._id} className={`fixture-item ${match.status}`} onClick={() => navigate(`/match/${match._id}`)}>
                                                            <span className="fixture-round">ج{idx + 1}</span>
                                                            <img src={opponentLogo || 'https://placehold.co/24'} alt="" className="opponent-logo" />
                                                            <span className="opponent-name">{opponent || 'TBD'}</span>
                                                            {match.status === 'completed' ? (
                                                                <span className={`fixture-score ${myScore > oppScore ? 'win' : myScore < oppScore ? 'loss' : 'draw'}`}>
                                                                    {myScore} - {oppScore}
                                                                </span>
                                                            ) : (
                                                                <Badge bg="secondary" className="fixture-status">
                                                                    {t(`match.status.${match.status}`, match.status)}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </Col>
                            );
                        })}
                    </Row>
                </div>
            </div>
        );
    }

    return (
        <div className="league-standings-container">
            {/* إحصائيات سريعة - تظهر فقط إذا لم يكن hideStatsCards */}
            {!hideStatsCards && (
                <Row className="stats-cards mb-4">
                    <Col md={4}>
                        <div className="stat-card attack">
                            <FaFutbol className="stat-icon" />
                            <div className="stat-content">
                                <span className="stat-label">{t('tournament.stats.bestAttack', 'أفضل هجوم')}</span>
                                {stats.bestAttack && (
                                    <div className="stat-value">
                                        <img src={stats.bestAttack.teamLogo || 'https://placehold.co/24'} alt="" className="stat-team-logo" />
                                        <span>{stats.bestAttack.team}</span>
                                        <Badge bg="success" className="ms-2">{stats.bestAttack.goalsFor}</Badge>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Col>
                    <Col md={4}>
                        <div className="stat-card defense">
                            <FaShieldAlt className="stat-icon" />
                            <div className="stat-content">
                                <span className="stat-label">{t('tournament.stats.bestDefense', 'أفضل دفاع')}</span>
                                {stats.bestDefense && (
                                    <div className="stat-value">
                                        <img src={stats.bestDefense.teamLogo || 'https://placehold.co/24'} alt="" className="stat-team-logo" />
                                        <span>{stats.bestDefense.team}</span>
                                        <Badge bg="info" className="ms-2">{stats.bestDefense.goalsAgainst}</Badge>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Col>
                    <Col md={4}>
                        <div className="stat-card trophy">
                            <FaTrophy className="stat-icon" />
                            <div className="stat-content">
                                <span className="stat-label">{t('tournament.stats.leader', 'المتصدر')}</span>
                                {standings[0] && (
                                    <div className="stat-value">
                                        <img src={standings[0].teamLogo || 'https://placehold.co/24'} alt="" className="stat-team-logo" />
                                        <span>{standings[0].team}</span>
                                        <Badge bg="warning" className="ms-2">{standings[0].points} نقاط</Badge>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Col>
                </Row>
            )}

            {/* جدول الترتيب - يظهر فقط إذا لم يكن showStatsOnly */}
            {!showStatsOnly && (
                <>
                    <div className="league-table-section">
                        <h5 className="section-title">
                            <FaTrophy className="me-2 text-warning" />
                            {t('tournament.standings.title', 'جدول الترتيب')}
                        </h5>
                        <Table responsive className="league-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>{t('tournament.standings.team', 'الفريق')}</th>
                                    <th>{t('tournament.standings.played', 'لعب')}</th>
                                    <th>{t('tournament.standings.won', 'ف')}</th>
                                    <th>{t('tournament.standings.drawn', 'ت')}</th>
                                    <th>{t('tournament.standings.lost', 'خ')}</th>
                                    <th>{t('tournament.standings.gf', '+')}</th>
                                    <th>{t('tournament.standings.ga', '-')}</th>
                                    <th>{t('tournament.standings.gd', '±')}</th>
                                    <th>{t('tournament.standings.points', 'نقاط')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {standings.map((player, index) => (
                                    <tr key={player.id} className={index === 0 ? 'leader-row' : ''}>
                                        <td>
                                            {index === 0 && <FaTrophy className="text-warning me-1" />}
                                            {index + 1}
                                        </td>
                                        <td>
                                            <div className="team-cell">
                                                <img src={player.teamLogo || 'https://placehold.co/30'} alt="" className="team-logo" />
                                                <div className="team-info">
                                                    <span className="team-name">{player.team}</span>
                                                    <span className="player-name">{player.name}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>{player.played}</td>
                                        <td className="text-success">{player.won}</td>
                                        <td className="text-muted">{player.drawn}</td>
                                        <td className="text-danger">{player.lost}</td>
                                        <td>{player.goalsFor}</td>
                                        <td>{player.goalsAgainst}</td>
                                        <td className={player.goalDiff > 0 ? 'text-success' : player.goalDiff < 0 ? 'text-danger' : ''}>
                                            {player.goalDiff > 0 ? '+' : ''}{player.goalDiff}
                                        </td>
                                        <td><strong>{player.points}</strong></td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </div>

                    {/* جدول مباريات كل لاعب */}
                    <div className="player-fixtures-section mt-4">
                        <h5 className="section-title">
                            <FaFutbol className="me-2 text-primary" />
                            {t('tournament.stats.fixtures', 'جدول مباريات كل لاعب')}
                        </h5>
                        <Row className="g-3">
                            {standings.map(player => {
                                const playerId = String(player.id);
                                const playerMatches = matches?.filter(m => {
                                    const p1Id = String(m.player1?._id || m.player1 || '');
                                    const p2Id = String(m.player2?._id || m.player2 || '');
                                    return p1Id === playerId || p2Id === playerId;
                                }) || [];

                                return (
                                    <Col md={6} lg={4} key={player.id}>
                                        <div className="player-fixture-card">
                                            <div className="fixture-player-header">
                                                <img src={player.teamLogo || 'https://placehold.co/32'} alt="" />
                                                <div>
                                                    <span className="fixture-team">{player.team}</span>
                                                    <span className="fixture-player">{player.name}</span>
                                                </div>
                                            </div>
                                            <div className="fixture-list">
                                                {playerMatches.length === 0 ? (
                                                    <div className="no-matches-msg">
                                                        {t('tournament.noMatches', 'لا توجد مباريات بعد')}
                                                    </div>
                                                ) : (
                                                    playerMatches.map((match, idx) => {
                                                        const p1Id = String(match.player1?._id || match.player1 || '');
                                                        const isPlayer1 = p1Id === playerId;
                                                        const opponent = isPlayer1 ? match.player2Team : match.player1Team;
                                                        const opponentLogo = isPlayer1 ? match.player2TeamLogo : match.player1TeamLogo;
                                                        const myScore = isPlayer1 ? match.scorePlayer1 : match.scorePlayer2;
                                                        const oppScore = isPlayer1 ? match.scorePlayer2 : match.scorePlayer1;

                                                        return (
                                                            <div key={match._id} className={`fixture-item ${match.status}`} onClick={() => navigate(`/match/${match._id}`)}>
                                                                <span className="fixture-round">ج{idx + 1}</span>
                                                                <img src={opponentLogo || 'https://placehold.co/24'} alt="" className="opponent-logo" />
                                                                <span className="opponent-name">{opponent || 'TBD'}</span>
                                                                {match.status === 'completed' ? (
                                                                    <span className={`fixture-score ${myScore > oppScore ? 'win' : myScore < oppScore ? 'loss' : 'draw'}`}>
                                                                        {myScore} - {oppScore}
                                                                    </span>
                                                                ) : (
                                                                    <Badge bg="secondary" className="fixture-status">
                                                                        {t(`match.status.${match.status}`, match.status)}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    </Col>
                                );
                            })}
                        </Row>
                    </div>
                </>
            )}
        </div>
    );
};

export default LeagueStandingsView;
