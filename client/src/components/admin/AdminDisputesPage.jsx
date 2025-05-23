// client/src/components/admin/AdminDisputesPage.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Container, Row, Col, Card, Button, Spinner, Alert, Pagination, Badge } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { adminGetDisputedMediationsAction } from "../../redux/actions/mediationAction";
import { FaEye, FaCommentDots, FaExclamationTriangle } from "react-icons/fa";
// يمكنك استيراد ViewMediationDetailsModal إذا أردت استخدامه
// import ViewMediationDetailsModal from "../../pages/ViewMediationDetailsModal"; // اضبط المسار

const formatCurrency = (amount, currencyCode = "TND") => {
    if (amount === undefined || amount === null) return "N/A";
    const options = {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    };
    return new Intl.NumberFormat('en-US', options).format(amount);
};

const AdminDisputesPage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const {
        adminDisputedMediations,
        loadingAdminDisputed,
        errorAdminDisputed
    } = useSelector(state => state.mediationReducer);

    const disputedList = adminDisputedMediations?.list || [];
    const totalPages = adminDisputedMediations?.totalPages || 1;
    const currentPageFromState = adminDisputedMediations?.currentPage || 1;
    const totalCount = adminDisputedMediations?.totalCount || 0;

    const [currentPageLocal, setCurrentPageLocal] = useState(1);
    // const [showDetailsModal, setShowDetailsModal] = useState(false);
    // const [selectedRequestForDetails, setSelectedRequestForDetails] = useState(null);


    useEffect(() => {
        dispatch(adminGetDisputedMediationsAction(currentPageLocal));
    }, [dispatch, currentPageLocal]);

    const handlePageChange = (pageNumber) => {
        setCurrentPageLocal(pageNumber);
    };

    // const handleOpenDetailsModal = (request) => {
    //     setSelectedRequestForDetails(request);
    //     setShowDetailsModal(true);
    // };

    const renderDisputeCard = (request) => {
        if (!request) return null;
        return (
            <Card key={request._id} className="mb-3 shadow-sm">
                <Card.Header className="d-flex justify-content-between align-items-center">
                    <span>Product: {request.product?.title || "N/A"} <Badge bg="danger">Disputed</Badge></span>
                    {/* 
                    <Button variant="outline-secondary" size="sm" onClick={() => handleOpenDetailsModal(request)}>
                        <FaEye /> Details
                    </Button>
                    */}
                </Card.Header>
                <Card.Body>
                    <p><small className="text-muted">Mediation ID:</small> {request._id}</p>
                    <p><small className="text-muted">Seller:</small> {request.seller?.fullName || "N/A"}</p>
                    <p><small className="text-muted">Buyer:</small> {request.buyer?.fullName || "N/A"}</p>
                    <p><small className="text-muted">Mediator:</small> {request.mediator?.fullName || "N/A"}</p>
                    <p><small className="text-muted">Agreed Price:</small> {formatCurrency(request.bidAmount, request.bidCurrency)}</p>
                    <p><small className="text-muted">Last Update:</small> {new Date(request.updatedAt).toLocaleString()}</p>
                    <div className="text-end">
                        <Button 
                            variant="warning" 
                            size="sm" 
                            onClick={() => navigate(`/dashboard/mediation-chat/${request._id}`)}
                        >
                            <FaCommentDots className="me-1" /> Join/View Dispute Chat
                        </Button>
                        {/* لاحقًا: أزرار "Resolve Dispute", "Request Info", etc. */}
                    </div>
                </Card.Body>
            </Card>
        );
    };


    if (loadingAdminDisputed && disputedList.length === 0) {
        return <Container className="text-center py-5"><Spinner animation="border" /><p>Loading disputed cases...</p></Container>;
    }
    if (errorAdminDisputed && disputedList.length === 0) {
        return <Container className="py-5"><Alert variant="danger">Error: {errorAdminDisputed}</Alert></Container>;
    }

    return (
        <Container fluid className="py-4 px-md-4">
            <Row className="mb-3">
                <Col>
                    <h2 className="d-flex align-items-center">
                        <FaExclamationTriangle className="me-2 text-danger"/> Disputed Mediations 
                        <Badge pill bg="danger" className="ms-2 fs-6">{totalCount}</Badge>
                    </h2>
                    <p className="text-muted">Review and manage ongoing disputes.</p>
                </Col>
            </Row>

            {loadingAdminDisputed && <div className="text-center mb-2"><Spinner size="sm"/></div>}

            {disputedList.length > 0 ? (
                disputedList.map(renderDisputeCard)
            ) : (
                !loadingAdminDisputed && <Alert variant="info">No disputed mediations found at the moment.</Alert>
            )}

            {totalPages > 1 && (
                <Pagination className="justify-content-center mt-4">
                    {[...Array(totalPages).keys()].map(num => (
                        <Pagination.Item 
                            key={num + 1} 
                            active={num + 1 === currentPageLocal} 
                            onClick={() => handlePageChange(num + 1)}
                            disabled={loadingAdminDisputed}
                        >
                            {num + 1}
                        </Pagination.Item>
                    ))}
                </Pagination>
            )}

            {/* {selectedRequestForDetails && (
                <ViewMediationDetailsModal
                    show={showDetailsModal}
                    onHide={() => { setShowDetailsModal(false); setSelectedRequestForDetails(null); }}
                    request={selectedRequestForDetails}
                    currentUserId={currentUser?._id} // تمرير currentUserId إذا كان المودال يحتاجه
                />
            )} */}
        </Container>
    );
};

export default AdminDisputesPage;