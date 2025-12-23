import React from 'react';
import { Card, Table, Badge, Row, Col } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaTrophy, FaFutbol } from 'react-icons/fa';
import './GroupStageView.css';

const GroupStageView = ({ matches, participants, qualifiersPerGroup = 2 }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    // 1. تجميع المباريات حسب المجموعة
    const groups = {};
    matches.forEach(match => {
        const gIndex = match.groupIndex !== undefined ? match.groupIndex : 0;
        if (!groups[gIndex]) groups[gIndex] = { matches: [], players: {} };
        groups[gIndex].matches.push(match);
    });

    // 2. حساب النقاط (Standings Logic)
    Object.keys(groups).forEach(gIndex => {
        const group = groups[gIndex];

        // تهيئة اللاعبين في المجموعة
        group.matches.forEach(m => {
            [
                { player: m.player1, team: m.player1Team, logo: m.player1TeamLogo },
                { player: m.player2, team: m.player2Team, logo: m.player2TeamLogo }
            ].forEach(({ player, team, logo }) => {
                if (player && !group.players[player._id]) {
                    group.players[player._id] = {
                        id: player._id,
                        name: player.fullName,
                        avatar: player.avatarUrl,
                        team: team,
                        teamLogo: logo,
                        played: 0, won: 0, drawn: 0, lost: 0,
                        gf: 0, ga: 0, gd: 0, points: 0
                    };
                }
            });
        });

        // حساب النتائج من المباريات المكتملة
        group.matches.forEach(m => {
            if (m.status === 'completed' && m.winner) {
                const p1 = group.players[m.player1._id];
                const p2 = group.players[m.player2._id];

                if (!p1 || !p2) return;

                p1.played++; p2.played++;
                p1.gf += m.scorePlayer1; p1.ga += m.scorePlayer2;
                p2.gf += m.scorePlayer2; p2.ga += m.scorePlayer1;

                if (m.scorePlayer1 > m.scorePlayer2) {
                    p1.won++; p1.points += 3;
                    p2.lost++;
                } else if (m.scorePlayer2 > m.scorePlayer1) {
                    p2.won++; p2.points += 3;
                    p1.lost++;
                } else {
                    p1.drawn++; p1.points += 1;
                    p2.drawn++; p2.points += 1;
                }
            }
        });

        // تحويل اللاعبين لمصفوفة وترتيبهم
        group.standings = Object.values(group.players).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if ((b.gf - b.ga) !== (a.gf - a.ga)) return (b.gf - b.ga) - (a.gf - a.ga);
            return b.gf - a.gf;
        });
    });

    // Helper to get status badge
    const getStatusBadge = (status) => {
        const statusMap = {
            scheduled: { bg: 'secondary', key: 'matchRoom.status.scheduled' },
            ongoing: { bg: 'warning', key: 'matchRoom.status.ongoing' },
            completed: { bg: 'success', key: 'matchRoom.status.completed' },
            review: { bg: 'info', key: 'matchRoom.status.review' },
            dispute: { bg: 'danger', key: 'matchRoom.status.dispute' }
        };
        const config = statusMap[status] || statusMap.scheduled;
        return <Badge bg={config.bg} className="status-badge-sm">{t(config.key)}</Badge>;
    };

    return (
        <div className="group-stage-container">
            {Object.keys(groups).map((gIndex) => (
                <div key={gIndex} className="group-section">
                    {/* Group Header */}
                    <div className="group-header">
                        <div className="group-letter">{String.fromCharCode(65 + parseInt(gIndex))}</div>
                        <h4 className="group-title">
                            {t('groupStage.groupTitle', { letter: String.fromCharCode(65 + parseInt(gIndex)) })}
                        </h4>
                    </div>

                    {/* جدول الترتيب */}
                    <Card className="standings-card">
                        <Table responsive className="standings-table mb-0">
                            <thead>
                                <tr>
                                    <th className="rank-col">#</th>
                                    <th className="team-col">{t('groupStage.table.team')}</th>
                                    <th>{t('groupStage.table.mp')}</th>
                                    <th>{t('groupStage.table.w')}</th>
                                    <th>{t('groupStage.table.d')}</th>
                                    <th>{t('groupStage.table.l')}</th>
                                    <th>{t('groupStage.table.gf')}</th>
                                    <th>{t('groupStage.table.ga')}</th>
                                    <th>{t('groupStage.table.gd')}</th>
                                    <th className="pts-col">{t('groupStage.table.pts')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groups[gIndex].standings.map((player, idx) => (
                                    <tr key={player.id} className={`standing-row ${idx < qualifiersPerGroup ? 'qualified' : ''}`}>
                                        <td className="rank-cell">
                                            {idx < qualifiersPerGroup ? (
                                                <div className="rank-badge qualified">
                                                    <FaTrophy className="trophy-icon" />
                                                    {idx + 1}
                                                </div>
                                            ) : (
                                                <div className="rank-badge">{idx + 1}</div>
                                            )}
                                        </td>
                                        <td className="team-cell">
                                            <div className="team-info">
                                                {player.teamLogo && (
                                                    <img
                                                        src={player.teamLogo}
                                                        alt={player.team}
                                                        className="team-logo"
                                                    />
                                                )}
                                                <div className="team-details">
                                                    <span className="player-name">{player.name}</span>
                                                    <span className="team-name">{player.team}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>{player.played}</td>
                                        <td className="win-cell">{player.won}</td>
                                        <td>{player.drawn}</td>
                                        <td className="loss-cell">{player.lost}</td>
                                        <td>{player.gf}</td>
                                        <td>{player.ga}</td>
                                        <td className={player.gf - player.ga > 0 ? 'positive-gd' : player.gf - player.ga < 0 ? 'negative-gd' : ''}>
                                            {player.gf - player.ga > 0 ? '+' : ''}{player.gf - player.ga}
                                        </td>
                                        <td className="pts-cell">{player.points}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </Card>

                    {/* قائمة المباريات */}
                    <h5 className="matches-subtitle">
                        <FaFutbol className="me-2" />
                        {t('groupStage.matches')}
                    </h5>
                    <Row className="matches-grid g-3">
                        {groups[gIndex].matches.map(match => (
                            <Col xs={12} md={6} key={match._id}>
                                <div
                                    className={`gs-match-card ${match.status}`}
                                    onClick={() => navigate(`/dashboard/match/${match._id}`)}
                                >
                                    {/* Match Header */}
                                    <div className="gs-match-header">
                                        <span className="gs-match-number">
                                            {t('groupStage.matchNumber', { num: match.matchIndex + 1 })}
                                        </span>
                                        {getStatusBadge(match.status)}
                                    </div>

                                    {/* Match Body - Horizontal Layout */}
                                    <div className="gs-match-body">
                                        {/* Team 1 - Logo Only */}
                                        <div className={`gs-team-logo-only ${match.winner === match.player1?._id ? 'winner' : ''}`}>
                                            <img
                                                src={match.player1TeamLogo || 'https://placehold.co/50'}
                                                alt={match.player1Team || ''}
                                                className="gs-logo"
                                            />
                                        </div>

                                        {/* Score / VS */}
                                        <div className="gs-score-center">
                                            {match.status === 'completed' ? (
                                                <span className="gs-score">{match.scorePlayer1} - {match.scorePlayer2}</span>
                                            ) : (
                                                <span className="gs-vs">VS</span>
                                            )}
                                        </div>

                                        {/* Team 2 - Logo Only */}
                                        <div className={`gs-team-logo-only ${match.winner === match.player2?._id ? 'winner' : ''}`}>
                                            <img
                                                src={match.player2TeamLogo || 'https://placehold.co/50'}
                                                alt={match.player2Team || ''}
                                                className="gs-logo"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </Col>
                        ))}
                    </Row>
                </div>
            ))}
        </div>
    );
};

export default GroupStageView;