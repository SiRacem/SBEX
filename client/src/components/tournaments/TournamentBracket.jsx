import React, { useEffect, useContext, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getTournamentMatches } from '../../redux/actions/tournamentAction';
import { useNavigate } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { SocketContext } from '../../App';
import { FaGavel } from 'react-icons/fa'; // [جديد]
import './TournamentBracket.css';
import { WAITING_IMG, DEAD_IMG } from './TournamentImages';

const TournamentBracket = ({ tournamentId, maxParticipants }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const socket = useContext(SocketContext);
    
    const { matches, loadingMatches } = useSelector(state => state.tournamentReducer);

    useEffect(() => {
        if (tournamentId) {
            dispatch(getTournamentMatches(tournamentId));
        }
    }, [dispatch, tournamentId]);

    useEffect(() => {
        if (socket) {
            socket.on('match_updated', (updatedMatch) => {
                if (updatedMatch.tournament === tournamentId) {
                    dispatch(getTournamentMatches(tournamentId));
                }
            });
            socket.on('tournament_updated', (data) => {
                if (data._id === tournamentId) {
                    dispatch(getTournamentMatches(tournamentId));
                }
            });
        }
    }, [socket, tournamentId, dispatch]);

    if (loadingMatches) return <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>;

    const totalRounds = Math.log2(maxParticipants || 16);

    const matchesByRound = matches.reduce((acc, match) => {
        acc[match.round] = acc[match.round] || [];
        acc[match.round].push(match);
        return acc;
    }, {});

    const bracketStructure = [];

    for (let r = 1; r <= totalRounds; r++) {
        const roundMatches = (matchesByRound[r] || []).sort((a, b) => a.matchIndex - b.matchIndex);
        bracketStructure.push({ round: r, matches: roundMatches });
    }

    const getRoundName = (roundNum) => {
        const diff = totalRounds - roundNum;
        if (diff === 0) return t('bracket.final');
        if (diff === 1) return t('bracket.semiFinal');
        if (diff === 2) return t('bracket.quarterFinal');
        return `${t('bracket.round')} ${Math.pow(2, diff + 1)}`;
    };

    return (
        <div className="bracket-container custom-scrollbar">
            {bracketStructure.map((roundData) => (
                <div key={roundData.round} className="round-column">
                    <div className="round-title">
                        {getRoundName(roundData.round)}
                    </div>

                    {roundData.matches.map((match) => (
                        <MatchCard
                            key={match._id}
                            match={match}
                            onClick={() => {
                                if (match.status !== 'cancelled' && (match.player1 || match.player2)) {
                                    navigate(`/dashboard/match/${match._id}`);
                                }
                            }}
                            t={t}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
};

const MatchCard = ({ match, onClick, t }) => {
    const [animateClass, setAnimateClass] = useState('');

    useEffect(() => {
        setAnimateClass('just-updated');
        const timer = setTimeout(() => setAnimateClass(''), 1000);
        return () => clearTimeout(timer);
    }, [match.status, match.winner, match.player1]); 

    const getImg = (url) => {
        if (!url) return WAITING_IMG;
        if (url.startsWith('data:') || url.startsWith('http')) return url;
        const baseUrl = process.env.REACT_APP_API_URL || "http://localhost:8000";
        return `${baseUrl}/${url}`;
    };

    if (match.status === 'cancelled') {
        return (
            <div className="match-card placeholder cancelled-slot">
                <div className="placeholder-content">
                    <img src={DEAD_IMG} className="player-avatar-main small-x" alt="X" />
                    <span>{t('status.cancelled')}</span>
                </div>
            </div>
        );
    }

    if (!match.player1 && !match.player2 && match.status === 'scheduled') {
        return (
            <div className="match-card placeholder">
                <div className="placeholder-content">
                    <span>{t('matchRoom.tbd')}</span>
                    <span className="vs-placeholder">{t('matchRoom.vs')}</span>
                    <span>{t('matchRoom.tbd')}</span>
                </div>
            </div>
        );
    }

    const isP1Winner = match.winner && match.player1 && match.winner === match.player1._id;
    const isP2Winner = match.winner && match.player2 && match.winner === match.player2._id;

    const statusClass = `status-${match.status}`;
    const disputeClass = match.status === 'dispute' ? 'dispute-card' : '';
    
    // [جديد] التحقق من قرار الأدمن (لإظهار المطرقة)
    const isAdminResolved = match.dispute && match.dispute.adminDecision;

    const hasPenalties = (match.penaltiesPlayer1 !== undefined && match.penaltiesPlayer1 !== null) || 
                         (match.penaltiesPlayer2 !== undefined && match.penaltiesPlayer2 !== null);

    const renderPlayer = (player, teamName, teamLogo, isWinner, score, penaltyScore) => {
        let displayImg = WAITING_IMG;
        if (teamLogo) displayImg = getImg(teamLogo);
        else if (player && player.avatarUrl) displayImg = getImg(player.avatarUrl);

        if (match.isBye && !player) {
            displayImg = DEAD_IMG;
        }

        const animationKey = player ? player._id : (match.isBye ? 'bye' : 'empty');

        return (
            <div className={`match-player ${isWinner ? 'winner' : ''}`}>
                <div key={animationKey} className="player-info-enhanced animate-entry">
                    <img
                        src={displayImg}
                        className="player-avatar-main"
                        alt="team"
                        onError={(e) => e.target.src = WAITING_IMG}
                    />

                    <div className="text-content">
                        <span className="team-name-bold">
                            {teamName || (player ? "---" : (match.isBye ? "---" : t('matchRoom.tbd')))}
                        </span>
                        <span className="player-username">
                            {player ? player.fullName : (match.isBye ? "" : "")}
                        </span>
                    </div>
                </div>

                <div className="d-flex flex-column align-items-center">
                    <span className="score-badge">
                        {match.status === 'scheduled' ? '-' : score}
                    </span>
                    {hasPenalties && (
                        <span style={{fontSize: '0.65rem', color: '#f59e0b', marginTop: '-2px', fontWeight: 'bold'}}>
                            ({penaltyScore})
                        </span>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className={`match-card ${animateClass} ${disputeClass}`} onClick={onClick}>
            <div className={`match-status-bar ${statusClass}`}></div>
            
            {/* [جديد] شارة الأدمن */}
            {isAdminResolved && (
                <div className="admin-resolution-badge" title="Resolved by Admin">
                    <FaGavel size={12} />
                </div>
            )}

            {renderPlayer(match.player1, match.player1Team, match.player1TeamLogo, isP1Winner, match.scorePlayer1, match.penaltiesPlayer1)}
            <div className="match-divider"></div>
            {renderPlayer(match.player2, match.player2Team, match.player2TeamLogo, isP2Winner, match.scorePlayer2, match.penaltiesPlayer2)}

            <div className="match-footer">
                <span className="match-id">#{match.matchIndex + 1}</span>
                <span className={`status-text ${match.status === 'ongoing' ? 'text-warning' : ''}`}>
                    {t(`status.${match.status.toLowerCase()}`, { defaultValue: match.status })}
                </span>
            </div>
        </div>
    );
};

export default TournamentBracket;