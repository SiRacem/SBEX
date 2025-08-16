import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Form, Button, ButtonGroup, Spinner, Alert } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { FaThumbsUp, FaThumbsDown } from "react-icons/fa";
import { toast } from "react-toastify";
import {
  submitRatingAction,
  resetSubmitRatingStatus,
} from "../../redux/actions/ratingAction";

const RatingForm = ({
  mediationRequestId,
  ratedUserId,
  ratedUserFullName,
  onRatingSubmitted,
}) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [ratingType, setRatingType] = useState(null); // 'like' or 'dislike'
  const [comment, setComment] = useState("");

  const loadingSubmitState = useSelector(
    (state) => state.ratingReducer.loadingSubmit
  );
  const errorSubmit = useSelector((state) => state.ratingReducer.errorSubmit);

  const isLoading = loadingSubmitState[`${mediationRequestId}_${ratedUserId}`];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!ratingType) {
      toast.warn(t("ratingForm.selectRating"));
      return;
    }
    dispatch(
      submitRatingAction({
        mediationRequestId,
        ratedUserId,
        ratingType,
        comment,
      })
    ).then(() => {
      if (typeof onRatingSubmitted === "function") {
        onRatingSubmitted(ratedUserId);
      }
      dispatch(resetSubmitRatingStatus());
    });
  };

  return (
    <Form onSubmit={handleSubmit} className="my-3 p-3 border rounded bg-light">
      <h6 className="mb-3">
        {t("ratingForm.title", {
          name: ratedUserFullName || t("ratingForm.thisUser"),
        })}
      </h6>

      {errorSubmit && (
        <Alert variant="danger" className="small">
          {t(errorSubmit.key, {
            ...errorSubmit.params,
            defaultValue: errorSubmit.fallback,
          })}
        </Alert>
      )}

      <Form.Group className="mb-3 text-center">
        <ButtonGroup>
          <Button
            variant={ratingType === "like" ? "success" : "outline-success"}
            onClick={() => setRatingType("like")}
            disabled={isLoading}
          >
            <FaThumbsUp /> {t("ratingForm.like")}
          </Button>
          <Button
            variant={ratingType === "dislike" ? "danger" : "outline-danger"}
            onClick={() => setRatingType("dislike")}
            disabled={isLoading}
          >
            <FaThumbsDown /> {t("ratingForm.dislike")}
          </Button>
        </ButtonGroup>
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label className="small">
          {t("ratingForm.commentLabel")}
        </Form.Label>
        <Form.Control
          as="textarea"
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t("ratingForm.commentPlaceholder")}
          disabled={isLoading}
        />
      </Form.Group>
      <Button
        type="submit"
        variant="primary"
        disabled={!ratingType || isLoading}
        className="w-100"
      >
        {isLoading ? (
          <Spinner as="span" animation="border" size="sm" />
        ) : (
          t("ratingForm.submitButton")
        )}
      </Button>
    </Form>
  );
};

export default RatingForm;