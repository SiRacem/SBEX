import React, { useEffect } from "react";
import { Container, Row, Col, Alert, Spinner } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import OfflineProdCard from "../components/commun/OfflineProdCard";
import { getMyWishlist } from "../redux/actions/userAction";
import { FaHeartBroken } from "react-icons/fa";

const WishlistPage = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  
  const { myWishlist, loadingWishlistPage } = useSelector(state => state.userReducer);

  useEffect(() => {
    dispatch(getMyWishlist());
  }, [dispatch]);

  return (
    <Container className="py-5" style={{ minHeight: "80vh" }}>
      <h2 className="mb-4 text-primary fw-bold border-bottom pb-2">
         {t('home.myWishlist', 'My Wishlist')} {/* تأكد من إضافة الترجمة */}
      </h2>

      {loadingWishlistPage ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
        </div>
      ) : myWishlist && myWishlist.length > 0 ? (
        <Row className="g-4">
          {myWishlist.map((product) => (
            <Col key={product._id} xs={12} sm={6} md={4} lg={3}>
              <OfflineProdCard el={product} />
            </Col>
          ))}
        </Row>
      ) : (
        <div className="text-center py-5 text-muted">
          <FaHeartBroken size={50} className="mb-3 opacity-50" />
          <h4>{t('home.emptyWishlist', 'Your wishlist is empty')}</h4>
          <p>{t('home.emptyWishlistDesc', 'Start adding products you like!')}</p>
        </div>
      )}
    </Container>
  );
};

export default WishlistPage;