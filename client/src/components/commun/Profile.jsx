import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Container,
  Row,
  Col,
  Card,
  Spinner,
  Image,
  Badge,
} from "react-bootstrap"; // Import Image and Badge
import { getProfile } from "../../redux/actions/userAction"; // Adjust path
import CurrencySwitcher from "./CurrencySwitcher"; // <-- استيراد المكون
import useCurrencyDisplay from "../../hooks/useCurrencyDisplay"; // <-- استيراد الهوك
import "./ProfileRedesigned.css";

// أيقونات اختيارية
import {
  FaMapMarkerAlt,
  FaCheckCircle,
  FaTimesCircle,
  FaDollarSign,
  FaPiggyBank,
  FaUniversity,
  FaBalanceScale,
  FaHourglassHalf,
} from "react-icons/fa";

const Profile = () => {
  const dispatch = useDispatch();
  const { user, loading, isAuth } = useSelector((state) => state.userReducer);

  // --- استخدام الهوك لكل رصيد ---
  const principalBalanceDisplay = useCurrencyDisplay(user?.balance);
  const depositBalanceDisplay = useCurrencyDisplay(user?.depositBalance);
  const withdrawalBalanceDisplay = useCurrencyDisplay(user?.withdrawalBalance);
  const sellerAvailableBalanceDisplay = useCurrencyDisplay(
    user?.sellerAvailableBalance
  );
  const sellerPendingBalanceDisplay = useCurrencyDisplay(
    user?.sellerPendingBalance
  );

  useEffect(() => {
    if (isAuth && !user) {
      dispatch(getProfile());
    }
  }, [dispatch, isAuth, user]);

  if (loading || !user) {
    return (
      <Container
        className="d-flex justify-content-center align-items-center"
        style={{ minHeight: "80vh" }}
      >
        <Spinner animation="border" variant="primary" />{" "}
      </Container>
    );
  }

  return (
    <Container fluid className="profile-page-redesigned py-4">
      <Row className="justify-content-center">
        <Col xl={10}>
          <Card className="shadow-sm profile-card-main">
            <Card.Header className="profile-header bg-light p-4">
              <Row className="align-items-center">
                <Col xs={12} md={2}>
                  <Image
                    src={
                      user.avatarUrl ||
                      "https://bootdey.com/img/Content/avatar/avatar7.png"
                    } // Placeholder
                    roundedCircle
                    width={100}
                    height={100}
                    className="profile-avatar"
                  />
                </Col>
                <Col xs={12} md={10}>
                  <h2 className="profile-name mb-1">{user.fullName}</h2>
                  <p className="text-muted mb-1">{user.email}</p>
                  <p className="text-muted mb-2">
                    <FaMapMarkerAlt size={14} className="me-1 opacity-75" />
                    {user.address || "Address not set"}
                  </p>
                  <Badge
                    pill
                    bg={user.blocked ? "danger" : "success"}
                    className="profile-status"
                  >
                    {user.blocked ? (
                      <FaTimesCircle className="me-1" />
                    ) : (
                      <FaCheckCircle className="me-1" />
                    )}
                    {user.blocked ? "Blocked" : "Active"}
                  </Badge>
                </Col>
              </Row>
            </Card.Header>

            <Card.Body className="p-4">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h4 className="section-title mb-0">Account Balances</h4>
                <CurrencySwitcher size="sm" /> {/* <-- إضافة مبدل العملات */}
              </div>
              <Row className="g-3 text-center">
                {/* --- استخدام قيم الهوك للعرض --- */}
                <Col sm={6} lg={4}>
                  <div className="balance-info-box">
                    <FaPiggyBank size={28} className="text-primary mb-2 icon" />
                    <span className="label">Principal</span>
                    <span className="value">
                      {principalBalanceDisplay.displayValue}
                    </span>
                    <span className="approx-value">
                      {principalBalanceDisplay.approxValue}
                    </span>{" "}
                    {/* <-- القيمة التقريبية */}
                  </div>
                </Col>
                <Col sm={6} lg={4}>
                  <div className="balance-info-box">
                    <FaUniversity size={28} className="text-info mb-2 icon" />
                    <span className="label">Deposit</span>
                    <span className="value">
                      {depositBalanceDisplay.displayValue}
                    </span>
                    <span className="approx-value">
                      {depositBalanceDisplay.approxValue}
                    </span>
                  </div>
                </Col>
                <Col sm={6} lg={4}>
                  <div className="balance-info-box">
                    <FaDollarSign size={28} className="text-danger mb-2 icon" />
                    <span className="label">Withdrawal</span>
                    <span className="value">
                      {withdrawalBalanceDisplay.displayValue}
                    </span>
                    <span className="approx-value">
                      {sellerAvailableBalanceDisplay.approxValue}
                    </span>
                  </div>
                </Col>
                {/* Seller Balances */}
                {(user.userRole === "Vendor" || user.userRole === "Admin") && (
                  <>
                    <Col sm={6} lg={6}>
                      <div className="balance-info-box seller">
                        <FaBalanceScale
                          size={28}
                          className="text-success mb-2 icon"
                        />
                        <span className="label">Seller Available</span>
                        <span className="value">
                          {sellerAvailableBalanceDisplay.displayValue}
                        </span>
                        <span className="approx-value">
                          {sellerAvailableBalanceDisplay.approxValue}
                        </span>
                      </div>
                    </Col>
                    <Col sm={6} lg={6}>
                      <div className="balance-info-box seller">
                        <FaHourglassHalf
                          size={28}
                          className="text-warning mb-2 icon"
                        />
                        <span className="label">Seller On Hold</span>
                        <span className="value">
                          {sellerPendingBalanceDisplay.displayValue}
                        </span>
                        <span className="approx-value">
                          {sellerPendingBalanceDisplay.approxValue}
                        </span>
                      </div>
                    </Col>
                  </>
                )}
                {/* --- نهاية استخدام قيم الهوك --- */}
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Profile;
