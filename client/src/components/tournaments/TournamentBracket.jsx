import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getTournamentMatches } from '../../redux/actions/tournamentAction';
import { useNavigate } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import './TournamentBracket.css';
import { WAITING_IMG, DEAD_IMG } from './TournamentImages';

const TournamentBracket = ({ tournamentId, maxParticipants }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { matches, loadingMatches } = useSelector(state => state.tournamentReducer);

    useEffect(() => {
        if (tournamentId) {
            dispatch(getTournamentMatches(tournamentId));
        }
    }, [dispatch, tournamentId]);

    if (loadingMatches) return <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>;

    // حساب عدد الجولات
    const totalRounds = Math.log2(maxParticipants || 16);

    // تجميع المباريات حسب الجولة
    const matchesByRound = matches.reduce((acc, match) => {
        acc[match.round] = acc[match.round] || [];
        acc[match.round].push(match);
        return acc;
    }, {});

    const bracketStructure = [];

    for (let r = 1; r <= totalRounds; r++) {
        // ترتيب المباريات حسب index لضمان الرسم الصحيح
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
                                // السماح بالضغط فقط إذا كانت المباراة حقيقية
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

// --- Sub-Component: Match Card ---
const MatchCard = ({ match, onClick, t }) => {
    // Helper للصورة
    const getImg = (url) => {
        if (!url) return WAITING_IMG;
        if (url.startsWith('data:') || url.startsWith('http')) return url;
        const baseUrl = process.env.REACT_APP_API_URL || "http://localhost:8000";
        return `${baseUrl}/${url}`;
    };

    // 1. حالة الإلغاء (المسارات الميتة)
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

    // 2. حالة الانتظار (لم يتحدد أي طرف بعد)
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

    // 3. المباراة النشطة أو المكتملة
    const isP1Winner = match.winner && match.player1 && match.winner === match.player1._id;
    const isP2Winner = match.winner && match.player2 && match.winner === match.player2._id;

    const statusClass = `status-${match.status}`;

    const renderPlayer = (player, teamName, teamLogo, isWinner, score) => {
        let displayImg = WAITING_IMG;
        
        if (teamLogo) displayImg = getImg(teamLogo);
        else if (player && player.avatarUrl) displayImg = getImg(player.avatarUrl);

        // إذا كانت Bye ولا يوجد لاعب، اعرض صورة X
        if (match.isBye && !player) {
            displayImg = DEAD_IMG;
        }

        return (
            <div className={`match-player ${isWinner ? 'winner' : ''}`}>
                <div className="player-info-enhanced">
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

                <span className="score-badge">
                    {match.status === 'scheduled' ? '-' : score}
                </span>
            </div>
        );
    };

    return (
        <div className="match-card" onClick={onClick}>
            <div className={`match-status-bar ${statusClass}`}></div>

            {renderPlayer(match.player1, match.player1Team, match.player1TeamLogo, isP1Winner, match.scorePlayer1)}
            <div className="match-divider"></div>
            {renderPlayer(match.player2, match.player2Team, match.player2TeamLogo, isP2Winner, match.scorePlayer2)}

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