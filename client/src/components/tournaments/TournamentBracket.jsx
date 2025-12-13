import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getTournamentMatches } from '../../redux/actions/tournamentAction';
import { useNavigate } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import './TournamentBracket.css';

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

    // --- Logic: Build Full Bracket Structure ---
    const totalRounds = Math.log2(maxParticipants || 16);
    
    const matchesByRound = matches.reduce((acc, match) => {
        acc[match.round] = acc[match.round] || [];
        acc[match.round].push(match);
        return acc;
    }, {});

    const bracketStructure = [];
    for (let r = 1; r <= totalRounds; r++) {
        const roundMatches = matchesByRound[r] || [];
        const expectedMatchesCount = (maxParticipants || 16) / Math.pow(2, r);
        
        const fullRound = [];
        for (let i = 0; i < expectedMatchesCount; i++) {
            const existingMatch = roundMatches.find(m => m.matchIndex === i);
            if (existingMatch) {
                if (existingMatch.status === 'cancelled') {
                    fullRound.push({ ...existingMatch, isCancelled: true });
                } else {
                    fullRound.push(existingMatch);
                }
            } else {
                fullRound.push({ _id: `placeholder-${r}-${i}`, isPlaceholder: true });
            }
        }
        bracketStructure.push({ round: r, matches: fullRound });
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
                    
                    {roundData.matches.map((match, idx) => (
                        <MatchCard 
                            key={match._id || idx} 
                            match={match} 
                            onClick={() => !match.isPlaceholder && !match.isCancelled && navigate(`/dashboard/match/${match._id}`)}
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
    // دالة الصور المحسنة (مع Fallback موثوق)
    const getImg = (url) => {
        if (!url) return "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxIQEhUSEBAVFRIWFRUVFRUSFRUXFRUVFRUWFxUVFRUYHSggGBomHRUVITEhJSkrLi4uFx8zODMtNygtLi0BCgoKDg0OGxAQGi0lICUvLS0tLi0tLS0wLS8tLS0tLS0tLS0tLS0tLS0tLS0tNTctLS0tLi0rKy41KzItLS8tK//AABEIAOEA4QMBIgACEQEDEQH/xAAcAAACAgMBAQAAAAAAAAAAAAABAgADBAYHBQj/xABAEAABAwEFBwIDBgQFAwUAAAABAAIDEQQSITFBBQYTIlFhoTKBB0JxFCNikbHBUrLC4YKSovDxctHSFzNDU5P/xAAbAQEAAgMBAQAAAAAAAAAAAAAABAUCAwYBB//EADARAAICAQMCAwcEAgMAAAAAAAABAgMRBAUhEjEyYbEGEyJBUaHhFHHB0SORJDOB/9oADAMBAAIRAxEAPwDs8bC01IwTym96cVDLewpmgBc71QDRODRQ4FVhhrWmFa+yYsv45KcX5adv2QBldeFG4lSI3cHYIBtzHPRQi/jlogFcwk1AwVkjw4UGaUS3eWnZQR3Mc6ICQ8tb2FUsjC41GITHn7U/dQSXMM0A7ngigOKriF01dgjwqc1e6hdfwy1QAlF41biE4eKUrjSnulDrmGeqnCrzV7oARtLTU4BGXm9OKhffwyUBud6oBo3hooc1WxhBqRgmMd7GuahlvctM0AZTe9OKMTg0UOBSgXMc6qFl/HJALcNa0wrX2TyuvCgxKHF+WnavhQMuY56IAxG76sEj2EmoGCYi/jlRES3eWmSAMjw4UGJSw8vqwqoI7uNa0UPP2ogBI0uNRiE7ngilcaUSh9zDNThU5q90BXwXdFFb9o7KIAujDRUZhLGb+enRLGDXGtO+SeX8Pj+yAV7y00GSfhil7XP3UipTmz75qlzrtS40aMSTkANT2QDsdewP1Xh7W3tstlJbxL7hm2PmoehdkPpVajvjvkZSYrMbsWRcMHSf9m9tdei0dzyVCt1WHiJ0+3+z7sip3vHl8/8A06PL8R464WYnuZAPAaVlWT4jQPNJo3sGpFHgflQ+FyxC8tH6uwuJez2jawk155Z3yxbRilaH2eRr2nMg1p2IzB7FZbGBwqc1wXZe1ZbM8SQvLXD8iOjhqF1vdreNluZVvLK0C/GDl+JvVp8KZTqFZx8zmdz2ezR/EuY/X6fue6JCTQ5ZJntuYj6IuIphSvlJFnzZd/7qQUwzG38T9EpkIN3TJSWteXLsnFKaVp71QAewNFRmhHz56dEIwa82XfJGX8Pj+yAD5C00GQTujDRUZqR0pzUr3zVbAa41p3yQDRm/mqrXamwAl72tYMSXGg/NYm8G2IrJHfcccmtaeZx6Dt30XIdu7dltT70jsPlaPS0dAP3zWi69V/uW227VZrHntH6/0dAt+/1ljP3bXyHqOVtf8WPhYH/qW0mjrMadpBX+Vc4JQJUJ6uw6iHs9o0sNN+eX/GDsGzN+LJKQ28YnHSUACv8A1gkfnRbMxgcL3XHDJfPAeto3U3ukspDHlz4Dm2uLO7P/AByW6rV5eJlZr/Z3oj16d58n/B11khcaHIoycmWqSG0sljD4nBzXAFpbqE8Ot72r/dTjlWmnhhYwOFTmlEhJu6ZKSVry1p2yTupTClae9UPA8AKKiju/lRAWukDsBmUGC5nr0RMV3EaINN/PTogA9t7EeVzXfreoyk2eF33TcHEf/I4f0jzn0W3b67SNlsr7po59GNOovVvEf4QfC41I6pULVWtfCjp/Z/b42N3zXZ8fv9QE1WbYbCXlV2KC8VttgsojbUqHCGTpdVqfdrC7mr7TsPDXlle/t+0BxXgFYzST4JGllKVaciArL2bb5IJGyROLXtNQR5BGoPRYaIKxTaeUbrK4zi4yWUdr3U3hZbWXsGytxkj/AKm9Wnxkvfe6/gPriuAbOt74HtkicWvbkR5B6g9F2DdXeSO1x1HLM0feR9PxN6tPjJWlF6msPucDu+0y0suuHg9Pwe+x1zA/XBKYyebTNFrb+J+mCBlpy6ZKSUYznh2A8oMNzPXoiWXMR5QaL+enRAB0ZdiMj1WBt7bsVliL31qcGt1ceg7dShtzbbLFGXPx0Y35nnOg7dSuPbb2vJaZC+Q1OQAyaNGtHRR771WsLuXG1bVLVy6pcQX38kTbe15LTIXyHHIAZNGgaOi89jKlRjar3NlbNriQq3mb5O4br01ajFYSKINkktvLybQy6aLdrdII2UHRaVa3VJK9sika9HdOxtvsY6YFKpVaixaNq3L3pdY5A15JgceYfwE/O39xr9V1++JACw1FKg6EHIhfO15dZ+Ge1zJZjGTV0TgBX/63VLfyIcPoArDSWvws432h0EY/8iC/f+zcmvu4HPsl4ZBvaZpgy/iUvEry6ZKccoPxx3UQ+zjqUUBWxxJock8op6fCL5A4UGaWLk9WCA0P4pyHhwDqZCfYMA/UrnDQupfFCyl8DJQMGPoeweKfqGj3XK71FV6r/sO+9n5J6JJfJv1M2zT8M1WfaNt3hQLwXyqu8tCk0WstPCTzLuZU815UFKCmWLN8UlwKoiUF4ZhBWVs+3Pge2SJxa9pqCPII1B6LERBXqbTyjCyuNkXGSymdq3Y3lZbWcvJK0feRj+ZvVp8ZfXYQ0UrrSvuvn7Z9vkgkbJE8te01BHkEag9F1/dXeJlubUUbM3GSOv8Aqb1b+n62lF6msPucBu20y0suuHgf2PfjJJo7LuvP3g2xHY477jiahrRm89B26lHeHbkVliL3mpPpYM3Ht26lcc23teS0yF8hxyAGTRo1o6L2+9VrC7mO1bVLVy6pcQX38kHbm2JLVIZJHVJyGjRo0dl5zGVUYwle5srZtcSFW8zZ3Ddenr6Y8JE2Ts2uJGC96WRsTcFJJGxNWtbS2gXHNbuIIrEp6meX2BtO33ivGkejLJVUOco7eS4rrVawhi5WRAFYrnICUhEhOZfNgVvnwif9/K05GKvu17afzFc8v1K6X8JbCTxpaYUbGPr6nf0/mpOnX+RFLvM1+knny9UdHkJBoMuyctFK608qRvDRQ5qsMINaYVqrM4MXiO6lRX8ZvVRAJwruNa0Urf7USseXGhyTSC56dUBjbTsjZYnwPFWvaQT0rkR3BofZcL21s+SzSuikFHNPs4HJw7ELv0bA4VOa1/erd5lvZdNGytqI30y/C7q0/wB1Hvp61x3LfadyekniXhffy8ziBKgKytp7Pks8jopWlr2mhB8EHUHqsRVjjg7yq1TSkmOCmBVYRBWJuTLFEAUUMkwKIoLwyIrrLO6Nwcxxa4ZFpII+hCpTNRPBjOEZLDRl2u3SSmsj3Pd1cST+ZVMbKoxR1Xv7L2XXErNJyZGsshRHC4K9lbNvYkL3pHtiapJI2JuC1raW0C45rfxBFWlPVTy+xNpbQLicV40slVJZarHc5aG8lxXXGuOERzlW4qOKrcUSMZzC5yRRX2SyukcGMaXOcQGtGJJOQCzSIs545ZZs6yPle2ONpc9xDWgZkld83c2ULDZ2RDE0q8jV5xcfpoOwC8ncvdBtgj4slHWlwxOYjB+Rv7nX6LaIuf1aKwop6Fl9zjd13H9RLoh4V92Th38a0U4teWnaqEjy00GScxgCuuakFOL9n7+FEnGd1UQF0jgRhn2SQ4erygIy3E6IuN/LTqgBKCTy5dk94UprT3qg19zA+EvDPq0z/dAeDvRuyy2x0dyStB4ch6/wu6tPjNca2lYJIJHRytLXtNCP0IOoPVfQrnX8B9cV4G9e7Udsjo6jZmg8OQafhd1afGaj30dayu5c7VuktNLon4PT8HDkQVlbRsEkEjo5Wlr2nEHwR1B6rEVY1hndV2KaTi+BgU4KrRCxNyLFEAihkmGidrUoKYOQMzrJQL127TuigWuiRB0xWalgi2adWPk9G3bQLtV5UsiD3KhxWLeTbCuMFhEc5VkqOKrJXqRjOYSUiiyLHZXSOaxjS5ziA1rRUknIALNIizn82Sx2V0jmsY0uc4gNa0VJJ0AXadx90mWFvElo60uGJzEYPyN79Tr9Eu5W6bLA0SSgOtLhiRiIwfkb36nX6LaTEXYhT6aenl9zj9z3N3N11v4fm/r+ARgg45d002Pp8ImQOwGvVBvJnr0UkpRoiAObPuqw01rjSvhM5l/EeUTIDy65IB77eoUVP2c9QogC2QuwOR6IvFzLXqnkAphSvbNJFj6vKALWX8T4SiQ+nTL9lJSQeXLsnoKaVp71QAc25iPpig0X8T4QiJJ5su6kuHp8IDwd7N3Y7ay6aNlZ/wC3Jr/0u6tPhcb2ls+SzyOjlaWvaaEHwQdQeq+hWAUxpXvmtd3n3bbbmUPLK0G5If5XdWnx+se+jrWV3Lrat1eml0WeD0/BxBOAsm1WQxvcxwo5pLSOhBoR+ajI1Vs76LTWSkBEhWXEHheGWStRRRASqiiCAVxVTlY5Brar1GMuxjuVay5okkUVVmRZBsdldI5rGNLnOIDWtxJJyAXaNzN0W2BglkAdaXChOYjB+Vvfqf2Q3H3SZY4+LIAbS5v/AOYI9De/U+312mKtebLurCinp5fc43dNzdzdVb+H5+f49QsF/E6dEDIW4DIIy4enwmYBTGle+aklGB0YbiMx1QZz56dEsZNeatO+SabD0+EAHPLcB5TGMAXtc0YwKc2ffNVgmuNaV9qICfaD2UV1G9vCiAqZGWmpyCMhv+nRTi3sKUqoRc71QBY8NFDmkEZre0rX2TXL+OSnF+Wnb9kAZHX8B9VIzcwKBbcxz0UpfxyQCujJNRksHeHbkVliL3mpPobq49Ow6lDbm3I7HGXPxOTWg4vPQdB1K47tva8lpkL5DU5ADJo0a0dFHvvVawu5c7VtUtXLqlxBffyRjbQtJlkdI71OcXGnVxqf1VcaRjKlets/ZpdoqxJyZ3U5Qqhj6GIyDVY04otit0IjatctDsV7JYMKLPeclCiiCwJRFFFEApCkeaJQQNZLJSkiwNQgoveowdSawds3S3hZbWVqBM2nEZ/W3q0+MlsMjr2AzXz7s23yQPbJE4te3IjyD1HZdj3U3kjtkd4YTNHPH/U3q39FZ0Xqaw+5we7bTLSy64eB/b8Hvxm5gUjoy41GRTAX8cqKcW7y0yUkpBnyBwoMylj5PVqpw7uNa0/4UHP2ogA9hcajJOZARd1yS8S5hmpwqc1e9EAnAcom+0dvKKAaRgaKgYpYje9WKWNpBqck0vN6cUAJHFpoMAnuClaY0r7qRODRQ4FVhhrXStfZAGJ140OIXn7f2xHYmX3HP0sGbndug6lHeLbUVlivvNTXlaM3GmQ7dSuO7b2vJaZC+Q46AZNGjW9lHvvVawu5cbVtUtXLqlxBffyRNubYktUhkkdUnIDJo0a0dF5zGVUY2q9vZezr2JCreZvJ3Ldenr6Y8JA2Xs68akL33ubE1R7mxNWubT2gXHNbuIIrEp6mfkJtS23ivGkejLIqHOUdvJcVwVccIYuQvqouS3l7gOaLw9MHLHDk4K8wFPJepRI0p14bEwFBMgvDMCy9nW98D2yROLXtNQR5BGoPRYqCyi8PKNVtUZxcWuDt26+8zLZHy0ZK0feM/qbXNp8LYGMBFSMV8+7Nt8kEjZInFr2moI8g9Qei7DuxvEy3sqKNlaBxGVy/E3q39MlZ0X9aw+5wW7bVLSy64eD0/B7sby40JwTS8vpwqmkeCKDNLDy1vYKSUg0bQ4VOJVYeSaVwrT2RkaXGoyTueKU1pRANwW9P1UWPwndFEBaZb2FM0ALmeNUzow0VGYSsN/PTogIWX8RgvP25tyOyRF0meIa0ZuPQdup0WXbLUIGuc40Y1pcSegxK4tvFtl9qldI84ZNbo1ugH791ovu92vMttq216yznwrv/AEV7b2vJaZC+Q45ADJo0a0dF5zGVUY2q9vZezrxqQqzmbyzu269PX0xWEibL2dexIXvPc2Jqj3Niatb2ltAuOa3cQRWJT1M/Im09oFxzXjTS1QllqsdzlobbZb11xrjhEc5VuKjiq3OXqRjOZHOVTpFHuWO9bIxyV993SsmVHIslpXnxAg0OazGFeTjgz0t3Wsl4TNKrBTArU0WEWWqJWlMvGbEyIIqLwzAFl7Nt8kEjZInFr2moI8gjUHosRFZJtPKNVtUbItSXDO2bp7wx2xl4UbKwfeR/XC83q0+Ml7x58sKLgGy9oSWeRssTqOafYjVpGoK7jsfabLRAyeLJ4xBxuuGDm+xqrSi73iw+58/3fbP0k+qHhf28jPElzDNDhU5vdFjA4VOfZKJCTd0yUgpxvtA6KJuAO6iAqjrXGtO+Sab8P+n+yLpA7AZlBguZ69EBqPxItpjsrY9ZH49brOb9bq5UcV0f4rYtgcMqyD35FzhhxVXqn/kO+9n4KOjTXzb9cfwZuzmC8KraPtDI24Faa6amSV9scdVqjPpJ9+ldrTb4PT2ltAuOa8aWRB8ioe5Yt5ZIrrjWsIjnKtzkHOVbivUjGcwuKrcVCVbZrO+RzWMaXPcQGtaKkk5ABZpZIVtqSyyuz2d0jmsY0ue4gNa0VJJyAC7ZuJuRHYWcWYNfanDPAiKvyM79Xflhm24u6DNnt4kwDrU4YkYiNp+Rh69Tr9FthjJN7TNWFNXSss47cdwd8umHh9TW97d0o9oMxAZO0ckpH+l/Vp8adDxXaFgks8jopmFr2mhB8EHUHQr6Qe+9gM+61ze/dWO3R0dRs7R93INPwv6tPjMd/bautZXc827cZaaWJeH0OGgpwVZtCwSWeR0UrC17TQg+CDqDoVQCq2UccM7im5TimmWgpmlVgo1WtolJlyiQFQuXhsTGKIbVUl6timARI8lPCA7BdM+EduqJoXHAXZG178rv0YuYSvqVvnwljLp5aZCLH3e2n6FStPxNFHvSU9JLPl6nUZK15a07ZeFY6lNK096oNfdwOfZKIyDe0zVmcEJzd/Kiu447ooBTFdx6IA388KJY3EmhOCeYXfTggNZ+IOzzLZHXRV0REg60AIf4JPsuOPdRfRMbA4cwrpj0XGt+t2HWSQyRitne43T/AAE/I79j07hQtVVn4kdRsG4KtOiX7r+jVnOS1SkqXlBwdZ7wLnKpzkHvVZcskjXK1Bc5JVRXWSzOkc1jGlznEBrWipJOQAWSRFss4yyWWzOkc1jGlz3EBrWipJOQAXatydz27PYJZQHWlwoTmIwfkYevU6/RNuRua2wR8WSjrS4YnMRg/Kzv1Ov0W0xG8ebFT6aenl9zkNy3F3Poh4fX8Ba2/icNFOLTlp2QlN00bgE4YKVpjSvupBUALLmIQAv54UQicXGhyRm5fTggNe3x3Zjt0d00bMwfdyebrurT4zHfiu0bBJZ5HRTMLXtNCD4IOoOhX0bGwEVIxWt717tM2gyho2ZoPDkplrdd1afGf10XUqfK7lttu5S00umXh9DhwKYK/aWz5LPI6KZpa9poQfBB1B0KxgVWyjjg7aq5TSaY9UrnIOcqnPXmDc7UOXJC5KXIBZYNErC2Nde+FdgMVnfO4Yyuo2v8EdRX3cXf5VoG5+7UluloKiJpBkf0H8I6uPjNdzsFna1oY1oDGANaBkABQAfkpemreepnN73rV0e4j3fctDL+JQ4teX2SyOINBkrHMFK0xpX3U05gH2cdSiqeK7qogLpHhwoM0sQu+rBThXca1ooTf7UQAkaXGoxCW1wxyxuikaHNc26WkYHsnv3MM1OF81e9PKBPHKOL76bnyWF3EYC6zk4OzLK/K+ng6/Vac96+mH0lBaQKEYg4gjIgj3Wkbf8AhpZZSXQudA440aA6P/ITUexA7KJPTc5idDpd7aj0W/7/ALOLukShy6JJ8I7Tmy0QkfivtP5AH9Vl7M+ExLhx7UKdImY/5nZfksPcS+hKe7U9+o55YLG+Z7Y4mF73GjWtFST/AL1XbNxt0Y7A3iS0daXDE5iMH5GfudfovW2Hu9ZtntpBGKnAvOLzTq46dhQL1OHfxrRb66VHl9yo125yvXRHiPqK2Mg1IwzTym8KNxQ4teWnZS7cxz0W8qwxG6KOwKQxmtaYVr7Jrt/HLRTi05adqoBpHBwoMSli5fVhVTh3Mc1KX+1EAsjC41AwVj3gigzS8S7hStFOFd5q5IDX9691o7dHR9GTNH3cmdPwupm0+MwuJ7W2fLZpDFMwteNDkRo5p1B6r6MJv9qLz9s7IgtLOFaIhIMwcnNJ1a4Yj2Wm2lT5+ZZ6Hcp6b4XzH0/Y+cnvVZeurbU+EbTV1ntRAzuytr/rbT+VeTD8JrS51DaIQOo4hP5XR+qj+4kXC3ep85NBYtm3R3Xltz6CrIgeeQjAfhb/ABO7aaretk/C6zwkOtMrpjndaOGz3oS4/mFvVmsTGNDY2tYwCjWtAAA6ABZw0/OZEXU7z8PTV3+pRsnZjLKxscTLsbfcknNzjqT1WZLzenGinEvctKV/5UHJ3qpaWDn3JyeX3GjcGihwKrDCDWmFapuHfxrRTi15adkPCzjN6/qgk+z9/CiADJC40OSMguenVNIQRhSvZLFh6vKAMbQ4VOaQSGt3StPZGUEnly7J6ilMK096oASNu4jPJSMX8SliFDzZd0ZcfT4QCmQg0GSsewNFRmowimNK+VXGCDzVp3QDR8/q0Qe8tNBkjNjS770TRkAc2fdAR0YAqM80sbr+BStBrjWlfZPKajlz7IBZHXDQZZpxGCL2tK+6ERAHNn3SEGutK+1EAWPLjQ5Iycnp1TSkEcufZLDh6vKAZkYcKnNVtkLjQ5KSAk4Vp2VjyKYUr2QCyC56UY23hU5oRYeryhKCTy5dkAOIa3dK09sk8jbuIzRqKUwrT3qkiBB5su6AaMX8SkdIQaDJNLj6fCZhFMaV7oCPYGiozSx8/q0Sxgg41p3yTTY0u+EAHvLTQZJzGAK65qREAc2fdVgGuNaV9qIAccqK+83qFEBjQeof70V1q0UUQDWbJUD1e/7oKIC+1Ze6FlyP1RUQFMvq91kWj0n/AHqgogEsmvsq7R6lFEBkyen2VNlz9lFEALVn7f8AdXN9Pt+yiiAos3qTWrRRRAWwekLHh9QQUQF1qyCazZKKICj5v8X7q61Ze6KiAWy5FUzeoqKIDJn9J/3qq7Jr7KKIBLR6vyV7/T7KKIDDUUUQH//Z";
        
        // [جديد] إذا كانت صورة Base64، أرجعها كما هي
        if (url.startsWith('data:')) return url;
        
        // إذا كان رابط خارجي كامل
        if (url.startsWith('http')) return url;
        
        // إذا كان مسار نسبي (uploads/...)
        const baseUrl = process.env.REACT_APP_API_URL || "http://localhost:8000"; 
        return `${baseUrl}/${url}`;
    };

    if (match.isPlaceholder) {
        return (
            <div className={`match-card placeholder ${match.isCancelled ? 'cancelled-slot' : ''}`}>
                <div className="placeholder-content">
                    <span>{match.isCancelled ? t('status.cancelled') : t('matchRoom.tbd')}</span>
                    <span className="vs-placeholder">{t('matchRoom.vs')}</span>
                    <span>{match.isCancelled ? t('status.cancelled') : t('matchRoom.tbd')}</span>
                </div>
            </div>
        );
    }

    const isP1Winner = match.winner && match.player1 && match.winner === match.player1._id;
    const isP2Winner = match.winner && match.player2 && match.winner === match.player2._id;

    const statusClass = `status-${match.status}`;

    const renderPlayer = (player, teamName, teamLogo, isWinner) => (
        <div className={`match-player ${isWinner ? 'winner' : ''}`}>
            <div className="player-info-enhanced">
                {/* عرض شعار الفريق (أو صورة افتراضية إذا لم يوجد) */}
                <img 
                    src={teamLogo ? getImg(teamLogo) : getImg(player?.avatarUrl)} 
                    className="player-avatar-main" 
                    alt="logo"
                    onError={(e) => e.target.src = "https://ui-avatars.com/api/?name=T&background=1e293b&color=fff"}
                />
                
                <div className="text-content">
                    {/* اسم الفريق */}
                    <span className="team-name-bold">
                         {teamName || (player ? "---" : t('matchRoom.tbd'))}
                    </span>
                    {/* اسم المستخدم */}
                    <span className="player-username">
                        {player ? player.fullName : ""}
                    </span>
                </div>
            </div>
            
            <span className="score-badge">
                {match.status === 'scheduled' ? '-' : (player && player._id === match.player1?._id ? match.scorePlayer1 : match.scorePlayer2)}
            </span>
        </div>
    );

    return (
        <div className="match-card" onClick={onClick}>
            <div className={`match-status-bar ${statusClass}`}></div>
            
            {renderPlayer(match.player1, match.player1Team, match.player1TeamLogo, isP1Winner)}
            <div className="match-divider"></div>
            {renderPlayer(match.player2, match.player2Team, match.player2TeamLogo, isP2Winner)}

            <div className="match-footer">
                <span className="match-id">#{match.matchIndex + 1}</span>
                <span className={`status-text ${match.status === 'ongoing' ? 'text-warning' : ''}`}>
                    {match.status === 'ongoing' ? t('matchRoom.status.ongoing') : t(`status.${match.status}`, match.status)}
                </span>
            </div>
        </div>
    );
};

export default TournamentBracket;