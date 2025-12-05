// src/components/commun/OfflineProdCard.jsx

import React, { useState, useEffect, useMemo } from "react";
import {
  Button,
  Card,
  Modal,
  Image,
  Badge,
  Spinner,
  Form,
  InputGroup,
  OverlayTrigger,
  Tooltip,
  ListGroup,
  Alert,
} from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, Link } from "react-router-dom";
import {
  FaHeart,
  FaRegHeart,
  FaGavel,
  FaInfoCircle,
  FaExclamationTriangle,
  FaWallet,
  FaUserCircle,
  FaUsers,
} from "react-icons/fa";
import { BsCartPlus, BsImage, BsX, BsBookmark, BsBookmarkFill } from "react-icons/bs";
import Carousel from "react-bootstrap/Carousel";
import {
  toggleLikeProduct,
  placeBid,
  clearProductError,
} from "../../redux/actions/productAction";
import { getProfile, toggleWishlist } from "../../redux/actions/userAction";
import { toast } from "react-toastify";
import "./OfflineProdCard.css";
import { useTranslation } from "react-i18next";

const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const MINIMUM_BALANCE_TO_PARTICIPATE_BID = 6.0;
const TND_USD_RATE = 3.0; // 1 USD = 3 TND

const fallbackImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23e9ecef"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%236c757d">Error</text></svg>';
const noImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23f8f9fa"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%23adb5bd">No Image</text></svg>';

const OfflineProdCard = ({ product }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // --- 1. Hooks ---
  const isAuth = useSelector((state) => state.userReducer?.isAuth ?? false);
  const loggedInUser = useSelector((state) => state.userReducer?.user);
  const userWishlist = useSelector(state => state.userReducer.user?.wishlist || []);
  
  const isInWishlist = useMemo(() => product && userWishlist.includes(product._id), [userWishlist, product]);

  const cartLoading = useSelector((state) => state.cartReducer?.cartLoading ?? false);
  const isLiking = useSelector((state) => state.productReducer?.productLiking?.[product?._id] ?? false);
  const isLoadingOther = useSelector((state) => state.productReducer?.productLoading?.[product?._id] ?? false);
  const error = useSelector((state) => state.productReducer?.productErrors?.[product?._id] ?? null);

  const [showImageModal, setShowImageModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showBidModal, setShowBidModal] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [bidAmountError, setBidAmountError] = useState(null);
  const [isEditingBid, setIsEditingBid] = useState(false);

  const initialLikedState = useMemo(
    () => product?.likes?.some((id) => String(id) === loggedInUser?._id) ?? false,
    [product?.likes, loggedInUser?._id]
  );
  const initialLikeCount = useMemo(
    () => product?.likes?.length ?? 0,
    [product?.likes]
  );
  const [isLiked, setIsLiked] = useState(initialLikedState);
  const [likeCount, setLikeCount] = useState(initialLikeCount);

  useEffect(() => {
    const likedFromRedux = product?.likes?.some((id) => String(id) === loggedInUser?._id) ?? false;
    const countFromRedux = product?.likes?.length ?? 0;
    setIsLiked(likedFromRedux);
    setLikeCount(countFromRedux);
  }, [product?.likes, loggedInUser?._id]);

  useEffect(() => {
    if (error && !isLoadingOther && !isLiking && product) {
      toast.error(t(error.key, error.params || {}));
      const timer = setTimeout(() => dispatch(clearProductError(product._id)), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, isLoadingOther, isLiking, dispatch, product, t]);

  const displayedBalanceData = useMemo(() => {
    if (!loggedInUser || !product) {
      return { amount: 0, currency: product?.currency || "TND" };
    }
    if (product.currency === "USD") {
      const balanceInUSD = loggedInUser.balance / TND_USD_RATE;
      return { amount: balanceInUSD, currency: "USD" };
    }
    return { amount: loggedInUser.balance, currency: "TND" };
  }, [loggedInUser, product]);

  const currentUserBid = useMemo(() => {
    if (!loggedInUser || !product?.bids) return null;
    return product.bids.find(
      (bid) => String(bid.user?._id || bid.user) === loggedInUser._id
    );
  }, [product?.bids, loggedInUser?._id]);

  // --- 2. Early Return ---
  if (!product || !product._id) {
    return (
      <Card className="product-card-v3 border-danger shadow-sm h-100 w-100 p-3 text-center d-flex flex-column justify-content-center align-items-center">
        <FaExclamationTriangle className="text-danger mb-2" size={30} />
        <small className="text-danger">
          {t("home.productDataUnavailable")}
        </small>
      </Card>
    );
  }

  // --- 3. Logic ---
  const sellerId = product?.user?._id || product?.user;
  const isOwner = isAuth && loggedInUser?._id === sellerId;
  const isOutOfStock = product?.quantity <= 0;
  const images = Array.isArray(product?.imageUrls) && product.imageUrls.length > 0 ? product.imageUrls : [noImageUrl];
  const highestBid = product?.bids?.reduce((max, bid) => (bid.amount > max.amount ? bid : max), { amount: 0 }) || null;

  const handleShowImageModal = (index = 0) => {
    setCurrentImageIndex(index);
    setShowImageModal(true);
  };
  const handleCloseImageModal = () => setShowImageModal(false);

  const handleShowBidModal = (e) => {
    e.stopPropagation();
    if (!isAuth) {
      toast.info(t("home.pleaseLoginToBid"));
      navigate("/login", { state: { from: window.location.pathname } });
      return;
    }
    if (!loggedInUser || loggedInUser.balance < MINIMUM_BALANCE_TO_PARTICIPATE_BID) {
      toast.error(t("home.bidModal.balanceTooLowToOpenError", { amount: MINIMUM_BALANCE_TO_PARTICIPATE_BID }));
      return;
    }
    setIsEditingBid(!!currentUserBid);
    setBidAmount(currentUserBid ? currentUserBid.amount.toString() : "");
    setBidAmountError(null);
    setShowBidModal(true);
  };

  const handleCloseBidModal = () => setShowBidModal(false);

  const handleLikeToggle = (e) => {
    e.stopPropagation();
    if (!isAuth) {
      toast.info(t("home.pleaseLoginToLike"));
      navigate("/login", { state: { from: window.location.pathname } });
      return;
    }
    if (isLiking) return;

    const previousIsLiked = isLiked;
    const previousLikeCount = likeCount;
    const newState = !previousIsLiked;
    const newCount = newState ? previousLikeCount + 1 : Math.max(0, previousLikeCount - 1);
    
    setIsLiked(newState);
    setLikeCount(newCount);

    dispatch(toggleLikeProduct(product._id)).catch(() => {
      toast.error(t("home.likeUpdateFailed"));
      setIsLiked(previousIsLiked);
      setLikeCount(previousLikeCount);
    });
  };

  const handleToggleWishlist = (e) => {
    e.stopPropagation();
    if (!isAuth) {
        toast.info(t("home.pleaseLoginToWishlist"));
        return;
    }
    dispatch(toggleWishlist(product._id));
  };

  const formatCurrency = (amount, currencyCode = "TND") => {
      const num = Number(amount);
      if (isNaN(num)) return "N/A";
      let options = { style: "currency", currency: currencyCode, minimumFractionDigits: 2 };
      let locale = i18n.language;
      if (currencyCode === "USD") {
        locale = "en-US";
        options.currencyDisplay = "symbol";
      }
      return new Intl.NumberFormat(locale, options).format(num);
  };

  const formatCurrencyWithName = (amount, currencyCode = "TND") => {
      const lang = i18n.language;
      if (["ar", "tn"].includes(lang) && currencyCode === "TND") {
        const num = Number(amount).toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `${num} ${t("dashboard.currencies.TND")}`;
      }
      return formatCurrency(amount, currencyCode);
  };

  const handleConfirmBid = async () => {
    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= 0) {
      setBidAmountError(t("home.bidModal.invalidAmountError"));
      return;
    }
    let bidInTND = amount;
    if (product.currency === "USD") {
      bidInTND = amount * TND_USD_RATE;
    }
    if (bidInTND > loggedInUser.balance) {
      setBidAmountError(t("home.bidModal.insufficientBalanceError", {
          requiredTND: formatCurrencyWithName(bidInTND, "TND"),
          requiredOriginal: formatCurrency(amount, product.currency),
          available: formatCurrencyWithName(loggedInUser.balance, "TND"),
        }));
      return;
    }
    setBidAmountError(null);
    try {
      await dispatch(placeBid(product._id, amount, isEditingBid));
      dispatch(getProfile());
      toast.success(t(isEditingBid ? "home.bidUpdatedSuccess" : "home.bidPlacedSuccess"));
      handleCloseBidModal();
    } catch (error) {
      console.error("Failed to place bid:", error);
      const errorMessageKey = error?.error?.key || "apiErrors.unknownError";
      setBidAmountError(t(errorMessageKey));
    }
  };

  const handleAddToCart = () => {
    toast.info("Add to cart feature coming soon!");
  };

  const bidAmountLabel = isEditingBid
    ? t("home.bidModal.bidAmountLabel_new", { currency: product.currency })
    : t("home.bidModal.bidAmountLabel_your", { currency: product.currency });

  return (
    <>
      <Card className="product-card-v3 border-0 shadow-sm h-100 w-100 overflow-hidden d-flex flex-column">
        <div className="product-img-wrapper position-relative">
          <Carousel interval={null} indicators={images.length > 1} controls={images.length > 1} fade={false}>
            {images.map((imgUrl, index) => (
              <Carousel.Item key={index} className="product-carousel-item">
                <Image src={imgUrl || noImageUrl} className="product-img" alt={t("home.productImageAlt", { title: product.title, index: index + 1 })} fluid />
              </Carousel.Item>
            ))}
          </Carousel>
          <Button variant="dark" onClick={() => handleShowImageModal(0)} className="view-gallery-btn">
            <BsImage /> {t("home.viewGallery")}
          </Button>
          {isOutOfStock && <Badge bg="dark" text="light" className="stock-badge">{t("home.outOfStock")}</Badge>}
        </div>

        <Card.Body className="p-3 d-flex flex-column flex-grow-1">
          <Card.Title className="product-title mb-1" title={product.title}>{product.title}</Card.Title>
          <Card.Text className="product-seller small mb-2">
            {t("home.seller")}:
            {sellerId ? (
              <Link to={`/profile/${sellerId}`} onClick={(e) => e.stopPropagation()} className="text-decoration-none fw-medium seller-link">
                {product.user?.fullName || t("home.seller")}
              </Link>
            ) : (
              <span className="text-muted">{t("home.unknownSeller")}</span>
            )}
          </Card.Text>

          <div className="product-price-section mb-3">
            <div className="price-current fw-bold">
              {formatCurrency(product.price, product.currency)}
              {highestBid?.amount > 0 && (
                <span className="text-success ms-2 highest-bid-info" title={t("home.highestBidTooltip", { amount: formatCurrency(highestBid.amount, product.currency) })}>
                  (<FaGavel size={12} /> {formatCurrency(highestBid.amount, product.currency)})
                </span>
              )}
            </div>
          </div>

          <div className="mt-auto d-flex justify-content-between align-items-center actions-row">
            <div className="d-flex align-items-center">
              <OverlayTrigger placement="top" overlay={<Tooltip>{isLiked ? t("home.unlike") : t("home.like")}</Tooltip>}>
                {/* [!!!] WRAPPER DIV for Ref [!!!] */}
                <div className="d-inline-block">
                  <Button variant="link" className={`action-btn like-btn ${isLiked ? "liked" : ""}`} onClick={handleLikeToggle} disabled={isLiking}>
                    {isLiking ? <Spinner animation="border" size="sm" variant={isLiked ? "danger" : "secondary"} /> : isLiked ? <FaHeart /> : <FaRegHeart />}
                    <span className="action-count ms-1">{likeCount}</span>
                  </Button>
                </div>
              </OverlayTrigger>

              <OverlayTrigger placement="top" overlay={<Tooltip>{isInWishlist ? t("home.removeFromWishlist") : t("home.addToWishlist")}</Tooltip>}>
                 {/* [!!!] WRAPPER DIV for Ref [!!!] */}
                <div className="d-inline-block">
                  <Button variant="link" className={`action-btn wishlist-btn ${isInWishlist ? "active" : ""}`} onClick={handleToggleWishlist} style={{ color: isInWishlist ? '#ffc107' : '#6c757d' }}>
                      {isInWishlist ? <BsBookmarkFill /> : <BsBookmark />}
                  </Button>
                </div>
              </OverlayTrigger>

              <OverlayTrigger placement="top" overlay={<Tooltip>{t("home.bidders")}</Tooltip>}>
                 {/* [!!!] WRAPPER DIV for Ref [!!!] */}
                <div className="d-inline-block ms-2">
                  <span className="action-btn text-muted">
                    <FaUsers /> <span className="action-count"> {product.bids?.length ?? 0} </span>
                  </span>
                </div>
              </OverlayTrigger>
            </div>
            
            <div className="d-flex">
              <OverlayTrigger placement="top" overlay={<Tooltip>{isOwner ? t("home.yourItem") : isOutOfStock ? t("home.outOfStock") : currentUserBid ? t("home.updateBid") : t("home.placeBid")}</Tooltip>}>
                 {/* [!!!] WRAPPER DIV for Ref [!!!] */}
                <div className="d-inline-block me-2">
                  <Button variant={currentUserBid ? "outline-warning" : "outline-success"} size="sm" onClick={handleShowBidModal} disabled={isLoadingOther || isOwner || isOutOfStock} className="action-btn bid-btn">
                    <FaGavel /> {currentUserBid ? t("home.updateBid") : t("home.placeBid")}
                  </Button>
                </div>
              </OverlayTrigger>
              
              <OverlayTrigger placement="top" overlay={<Tooltip>{isOwner ? t("home.yourItem") : isOutOfStock ? t("home.outOfStock") : t("home.addToCart")}</Tooltip>}>
                 {/* [!!!] WRAPPER DIV for Ref [!!!] */}
                <div className="d-inline-block">
                  <Button variant="primary" size="sm" onClick={(e) => { e.stopPropagation(); handleAddToCart(); }} disabled={cartLoading || isOutOfStock || isOwner} className="action-btn cart-btn">
                    {cartLoading ? <Spinner animation="border" size="sm" /> : <BsCartPlus size={18} />}
                  </Button>
                </div>
              </OverlayTrigger>
            </div>
          </div>
        </Card.Body>

        {product.bids && product.bids.length > 0 && (
          <Card.Footer className="bg-light p-2 bids-footer">
            <div className="d-flex align-items-center justify-content-between">
              <small className="text-muted">{t("home.bidModal.bids")}</small>
              <ListGroup horizontal className="bids-list-horizontal ms-auto">
                {product.bids.slice(0, 4).map((bid, index) => {
                  const isUserPopulated = typeof bid.user === "object" && bid.user !== null;
                  const bidderId = isUserPopulated ? bid.user._id : bid.user;
                  const bidderFullName = isUserPopulated ? bid.user.fullName : t("home.bidder");
                  const bidderAvatarUrl = isUserPopulated ? bid.user.avatarUrl : null;
                  const uniqueBidKey = `${bidderId || "unknown"}-${bid.amount}-${index}`;

                  return (
                    <ListGroup.Item key={uniqueBidKey} className="bid-item p-0 border-0 bg-transparent">
                      {bidderId ? (
                        <OverlayTrigger placement="top" overlay={<Tooltip>{bidderFullName} - {formatCurrency(bid.amount, bid.currency)}</Tooltip>}>
                           {/* [!!!] WRAPPER DIV for Ref - Critical Fix for Link [!!!] */}
                          <div className="d-inline-block">
                            <Link to={`/profile/${bidderId}`} onClick={(e) => e.stopPropagation()} className="text-decoration-none">
                              <span className="bidder-avatar" title={bidderFullName}>
                                {bidderAvatarUrl ? (
                                  <Image src={bidderAvatarUrl && bidderAvatarUrl.startsWith("http") ? bidderAvatarUrl : `${BACKEND_URL}/${bidderAvatarUrl}`} className="bidder-avatar-img" alt={bidderFullName} onError={(e) => { e.target.style.display = "none"; }} />
                                ) : (
                                  bidderFullName?.split(" ").map((n) => n[0]).join("").toUpperCase() || <FaUserCircle />
                                )}
                              </span>
                            </Link>
                          </div>
                        </OverlayTrigger>
                      ) : (
                        <OverlayTrigger placement="top" overlay={<Tooltip>{t("home.unknownBidder")} - {formatCurrency(bid.amount, bid.currency)}</Tooltip>}>
                           {/* [!!!] WRAPPER DIV for Ref [!!!] */}
                          <div className="d-inline-block">
                            <span className="bidder-avatar unknown-bidder" title={t("home.unknownBidder")}>?</span>
                          </div>
                        </OverlayTrigger>
                      )}
                    </ListGroup.Item>
                  );
                })}
                {product.bids.length > 4 && (
                  <ListGroup.Item className="bid-item p-0 border-0 bg-transparent text-muted small align-self-center more-bids">
                    +{product.bids.length - 4}
                  </ListGroup.Item>
                )}
              </ListGroup>
            </div>
          </Card.Footer>
        )}
      </Card>

      {/* Modals (Bid & Image) remain the same */}
      <Modal show={showBidModal} onHide={handleCloseBidModal} centered backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title><FaGavel className="me-2" />{isEditingBid ? t("home.bidModal.updateTitle") : t("home.bidModal.placeTitle")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="secondary" className="d-flex align-items-center small p-2 mb-3">
            <FaInfoCircle className="me-2 flex-shrink-0" size={20} />
            <div>
              <strong>{product.title}</strong><br />
              <span className="text-muted">{t("home.bidModal.basePrice")}:</span> {formatCurrency(product.price, product.currency)}
              {highestBid?.amount > 0 && <><span className="text-muted ms-2">{t("home.bidModal.highestBid")}:</span> {formatCurrency(highestBid.amount, product.currency)}</>}
            </div>
          </Alert>
          <Form onSubmit={(e) => { e.preventDefault(); handleConfirmBid(); }}>
            <Form.Group controlId="bidAmountInput">
              <Form.Label>{bidAmountLabel}</Form.Label>
              <InputGroup>
                {i18n.dir() === "rtl" && <InputGroup.Text>{product.currency}</InputGroup.Text>}
                <Form.Control type="number" placeholder="0.00" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} required min="0.01" step="0.01" isInvalid={!!bidAmountError} autoFocus />
                {i18n.dir() !== "rtl" && <InputGroup.Text>{product.currency}</InputGroup.Text>}
              </InputGroup>
              {bidAmountError && <Form.Text className="text-danger">{bidAmountError}</Form.Text>}
            </Form.Group>
            <Alert variant="light" className="small p-2 mt-3 border d-flex align-items-center">
              <FaWallet className="me-2 text-primary flex-shrink-0" />
              <div>
                {t("home.bidModal.currentBalance")}: <strong>{formatCurrencyWithName(displayedBalanceData.amount, displayedBalanceData.currency)}</strong>.
                <span className="d-block text-muted">({t("home.bidModal.minBalanceRequired", { amount: formatCurrencyWithName(MINIMUM_BALANCE_TO_PARTICIPATE_BID, "TND") })})</span>
              </div>
            </Alert>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseBidModal} disabled={isLoadingOther || isLiking}>{t("common.cancel")}</Button>
          <Button variant="success" onClick={handleConfirmBid} disabled={isLoadingOther || isLiking || !bidAmount || parseFloat(bidAmount) <= 0}>
            {isLoadingOther ? <><Spinner size="sm" animation="border" as="span" role="status" aria-hidden="true" /> {t("common.processing")}</> : isEditingBid ? t("home.updateBid") : t("common.confirmBid")}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showImageModal} onHide={handleCloseImageModal} centered size="lg" dialogClassName="lightbox-modal">
        <Modal.Body className="p-0 text-center bg-dark position-relative">
          {images.length > 0 && images[0] !== noImageUrl ? (
            <Carousel activeIndex={currentImageIndex} onSelect={(selectedIndex) => setCurrentImageIndex(selectedIndex)} interval={null} indicators={images.length > 1}>
              {images.map((imgUrl, index) => (
                <Carousel.Item key={index}>
                  <Image src={imgUrl || fallbackImageUrl} fluid className="lightbox-image" alt={t("home.productImageAlt", { title: product.title, index: index + 1 })} />
                </Carousel.Item>
              ))}
            </Carousel>
          ) : (
            <Alert variant="dark" className="m-5">{t("home.imageNotAvailable")}</Alert>
          )}
          <Button variant="light" onClick={handleCloseImageModal} className="position-absolute top-0 end-0 m-2 close-lightbox-btn" aria-label={t("common.close")}><BsX size={24} /></Button>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default OfflineProdCard;