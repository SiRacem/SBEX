import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Form, Button, ButtonGroup, Spinner, Alert } from 'react-bootstrap';
import { FaThumbsUp, FaThumbsDown } from 'react-icons/fa';
import { submitRatingAction, resetSubmitRatingStatus } from '../../redux/actions/ratingAction'; // تأكد من المسار

const RatingForm = ({ mediationRequestId, ratedUserId, ratedUserFullName, onRatingSubmitted }) => {
    const dispatch = useDispatch();
    const [ratingType, setRatingType] = useState(null); // 'like' or 'dislike'
    const [comment, setComment] = useState('');

    const loadingSubmitState = useSelector(state => state.ratingReducer.loadingSubmit);
    const errorSubmit = useSelector(state => state.ratingReducer.errorSubmit);
    // لا نحتاج successSubmit هنا لأننا سنعتمد على onRatingSubmitted

    const isLoading = loadingSubmitState[`${mediationRequestId}_${ratedUserId}`];

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!ratingType) {
            alert("Please select Like or Dislike.");
            return;
        }
        dispatch(submitRatingAction({
            mediationRequestId,
            ratedUserId,
            ratingType,
            comment
        })).then(() => {
            // تحقق من أن الـ action لا يعيد خطأ قبل استدعاء onRatingSubmitted
            // (يمكن تحسين هذا بالتحقق من حالة النجاح في Redux)
            if (typeof onRatingSubmitted === 'function') {
                onRatingSubmitted(ratedUserId); // إعلام المكون الأب بأن التقييم تم
            }
            dispatch(resetSubmitRatingStatus()); // لإعادة تعيين الحالة للتقييمات المستقبلية
        }).catch(err => {
            // الخطأ تم التعامل معه بواسطة toast في الـ action
        });
    };

    return (
        <Form onSubmit={handleSubmit} className="my-3 p-3 border rounded bg-light">
            <h6 className="mb-3">Rate {ratedUserFullName || 'this user'}:</h6>
            {errorSubmit && <Alert variant="danger" className="small">{errorSubmit}</Alert>}
            <Form.Group className="mb-3 text-center">
                <ButtonGroup>
                    <Button
                        variant={ratingType === 'like' ? 'success' : 'outline-success'}
                        onClick={() => setRatingType('like')}
                        disabled={isLoading}
                    >
                        <FaThumbsUp /> Like
                    </Button>
                    <Button
                        variant={ratingType === 'dislike' ? 'danger' : 'outline-danger'}
                        onClick={() => setRatingType('dislike')}
                        disabled={isLoading}
                    >
                        <FaThumbsDown /> Dislike
                    </Button>
                </ButtonGroup>
            </Form.Group>
            <Form.Group className="mb-3">
                <Form.Label className="small">Comment (Optional):</Form.Label>
                <Form.Control
                    as="textarea"
                    rows={2}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share your experience..."
                    disabled={isLoading}
                />
            </Form.Group>
            <Button type="submit" variant="primary" disabled={!ratingType || isLoading} className="w-100">
                {isLoading ? <Spinner as="span" animation="border" size="sm" /> : 'Submit Rating'}
            </Button>
        </Form>
    );
};

export default RatingForm;