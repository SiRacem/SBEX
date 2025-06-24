// src/pages/admin/AdminFAQManagement.jsx
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Container, Table, Button, Modal, Form, Spinner, Alert, Badge, Row, Col,
} from 'react-bootstrap';
import {
  adminGetAllFAQs, adminCreateFAQ, adminUpdateFAQ, adminDeleteFAQ,
  resetCreateFaqStatus, resetUpdateFaqStatus
} from '../../redux/actions/faqAction';
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa';

// Define your categories. You can move this to a shared constants file if needed.
const FAQ_CATEGORIES = [
    'General',
    'Account & Profile',
    'Mediation & Disputes',
    'Payments & Billing',
    'Selling & Buying',
    'Technical Issues'
];

const AdminFAQManagement = () => {
    const dispatch = useDispatch();
    const { adminFaqList, loadingAdmin, errorAdmin, loadingCUD, successCreate, successUpdate } = useSelector(state => state.faqReducer);

    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentFaq, setCurrentFaq] = useState(null);
    const [formData, setFormData] = useState({
        question: '', answer: '', category: 'General', isActive: true, displayOrder: 0,
    });

    useEffect(() => {
        dispatch(adminGetAllFAQs());
    }, [dispatch]);

    useEffect(() => {
        if (successCreate || successUpdate) {
            handleCloseModal();
            if (successCreate) dispatch(resetCreateFaqStatus());
            if (successUpdate) dispatch(resetUpdateFaqStatus());
        }
    }, [successCreate, successUpdate, dispatch]);

    const handleCloseModal = () => {
        setShowModal(false);
        setIsEditing(false);
        setCurrentFaq(null);
        setFormData({ question: '', answer: '', category: 'General', isActive: true, displayOrder: 0 });
    };

    const handleShowCreateModal = () => {
        setIsEditing(false);
        setFormData({ question: '', answer: '', category: 'General', isActive: true, displayOrder: 0 });
        setShowModal(true);
    };

    const handleShowEditModal = (faq) => {
        setIsEditing(true);
        setCurrentFaq(faq);
        setFormData({
            question: faq.question,
            answer: faq.answer,
            category: faq.category,
            isActive: faq.isActive,
            displayOrder: faq.displayOrder || 0,
        });
        setShowModal(true);
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isEditing) {
            dispatch(adminUpdateFAQ(currentFaq._id, formData));
        } else {
            dispatch(adminCreateFAQ(formData));
        }
    };

    const handleDelete = (id) => {
        if (window.confirm('Are you sure you want to delete this FAQ? This action cannot be undone.')) {
            dispatch(adminDeleteFAQ(id));
        }
    };

    return (
        <Container className="py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h1>FAQ Management</h1>
                <Button variant="primary" onClick={handleShowCreateModal}>
                    <FaPlus className="me-2" /> Add New FAQ
                </Button>
            </div>

            {loadingAdmin ? <div className="text-center py-5"><Spinner animation="border" /></div> :
             errorAdmin ? <Alert variant="danger">{errorAdmin}</Alert> :
             adminFaqList.length > 0 ? (
                <Table striped bordered hover responsive>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Question</th>
                            <th>Category</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {adminFaqList.map((faq, index) => (
                            <tr key={faq._id}>
                                <td>{index + 1}</td>
                                <td>{faq.question.substring(0, 70)}{faq.question.length > 70 && '...'}</td>
                                <td>{faq.category}</td>
                                <td>
                                    <Badge bg={faq.isActive ? 'success' : 'secondary'}>
                                        {faq.isActive ? 'Active' : 'Hidden'}
                                    </Badge>
                                </td>
                                <td className="text-center">
                                    <Button variant="outline-info" size="sm" className="me-2" onClick={() => handleShowEditModal(faq)} title="Edit">
                                        <FaEdit />
                                    </Button>
                                    <Button variant="outline-danger" size="sm" onClick={() => handleDelete(faq._id)} title="Delete">
                                        <FaTrash />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
             ) : (
                <Alert variant="info">No FAQs have been created yet. Click "Add New FAQ" to get started.</Alert>
             )}

            <Modal show={showModal} onHide={handleCloseModal} size="lg" backdrop="static" keyboard={false}>
                <Modal.Header closeButton>
                    <Modal.Title>{isEditing ? 'Edit FAQ' : 'Create New FAQ'}</Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleSubmit}>
                    <Modal.Body>
                        <Form.Group className="mb-3" controlId="formQuestion">
                            <Form.Label>Question</Form.Label>
                            <Form.Control type="text" name="question" value={formData.question} onChange={handleChange} required placeholder="e.g., How do I reset my password?" />
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="formAnswer">
                            <Form.Label>Answer</Form.Label>
                            <Form.Control as="textarea" rows={6} name="answer" value={formData.answer} onChange={handleChange} required placeholder="Provide a clear and detailed answer." />
                        </Form.Group>
                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3" controlId="formCategory">
                                    <Form.Label>Category</Form.Label>
                                    <Form.Select name="category" value={formData.category} onChange={handleChange} required>
                                        {FAQ_CATEGORIES.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3" controlId="formDisplayOrder">
                                    <Form.Label>Display Order</Form.Label>
                                    <Form.Control type="number" name="displayOrder" value={formData.displayOrder} onChange={handleChange} />
                                    <Form.Text className="text-muted">Lower numbers appear first.</Form.Text>
                                </Form.Group>
                            </Col>
                        </Row>
                        <Form.Check
                            type="switch"
                            id="faq-is-active-switch"
                            label="Is Active (Visible to users)"
                            name="isActive"
                            checked={formData.isActive}
                            onChange={handleChange}
                        />
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={handleCloseModal} disabled={loadingCUD}>Cancel</Button>
                        <Button type="submit" variant="primary" disabled={loadingCUD}>
                            {loadingCUD ? <><Spinner as="span" size="sm" className="me-2" /> Saving...</> : 'Save Changes'}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>
        </Container>
    );
};

export default AdminFAQManagement;