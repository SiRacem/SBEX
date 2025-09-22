// src/components/admin/ImageGalleryModal.jsx
import React from "react";
import { Modal, Carousel, Image, Button } from "react-bootstrap";
import { useTranslation } from "react-i18next";

const fallbackImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23cccccc"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%23ffffff">Error</text></svg>';
const noImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23eeeeee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%23aaaaaa">?</text></svg>';

const ImageGalleryModal = ({ show, onHide, images, productName }) => {
  const { t } = useTranslation();

  if (!images || images.length === 0) {
    return (
      <Modal show={show} onHide={onHide} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {t("imageGalleryModal.title", {
              productName: productName || t("imageGalleryModal.product"),
            })}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          <Image
            src={noImageUrl}
            fluid
            rounded
            style={{ maxHeight: "80vh", maxWidth: "100%" }}
          />
          <p className="mt-3">{t("imageGalleryModal.noImages")}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            {t("common.close")}
          </Button>
        </Modal.Footer>
      </Modal>
    );
  }

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="lg"
      centered
      dialogClassName="image-gallery-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title>
          {t("imageGalleryModal.title", {
            productName: productName || t("imageGalleryModal.product"),
          })}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Carousel
          interval={null}
          indicators={images.length > 1}
          controls={images.length > 1}
        >
          {images.map((url, index) => (
            <Carousel.Item key={`gallery-img-${index}`}>
              <Image
                src={url || noImageUrl}
                alt={t("imageGalleryModal.imageAlt", { index: index + 1 })}
                fluid
                style={{
                  maxHeight: "80vh",
                  width: "100%",
                  objectFit: "contain",
                }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = fallbackImageUrl;
                }}
              />
            </Carousel.Item>
          ))}
        </Carousel>
      </Modal.Body>
    </Modal>
  );
};

export default ImageGalleryModal;