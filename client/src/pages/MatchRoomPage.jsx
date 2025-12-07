// src/pages/MatchRoomPage.jsx
import React from 'react';
import { useParams } from 'react-router-dom';
import { Container } from 'react-bootstrap';

const MatchRoomPage = () => {
    const { id } = useParams();

    return (
        <Container className="text-center mt-5 text-white">
            <h1>Match Room</h1>
            <p>Match ID: {id}</p>
            <div className="alert alert-info">
                This feature is under construction. The Match Room will be available soon!
            </div>
        </Container>
    );
};

export default MatchRoomPage;