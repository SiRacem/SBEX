// src/pages/CreateTicketPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { Container, Row, Col, Card, Form, Button, Spinner, Alert, ListGroup, Badge } from 'react-bootstrap';
import { createTicketAction, resetCreateTicketStatus } from '../redux/actions/ticketAction';
import { toast } from 'react-toastify';
import { FaTicketAlt, FaTag, FaExclamationTriangle, FaInfoCircle, FaPaperclip, FaTimesCircle, FaFileUpload, FaFileAlt } from 'react-icons/fa';
import { FiType, FiMessageSquare } from "react-icons/fi";
import './CreateTicketPage.css'; // استيراد ملف CSS لتنسيق الصفحة

const TICKET_CATEGORIES = [
    { value: '', label: 'Select a category...' },
    { value: 'TechnicalIssue', label: 'Technical Issue' },
    { value: 'TransactionInquiry', label: 'Transaction Inquiry' },
    { value: 'AccountIssue', label: 'Account Issue' },
    { value: 'PaymentIssue', label: 'Payment Issue' },
    { value: 'MediationIssue', label: 'Mediation Issue' },
    { value: 'BugReport', label: 'Bug Report' },
    { value: 'FeatureRequest', label: 'Feature Request' },
    { value: 'GeneralInquiry', label: 'General Inquiry' },
    { value: 'Complaint', label: 'Complaint' },
    { value: 'Other', label: 'Other' }
];

const TICKET_PRIORITIES = [
    { value: 'Medium', label: 'Medium (Default)' },
    { value: 'Low', label: 'Low' },
    { value: 'High', label: 'High' },
    { value: 'Urgent', label: 'Urgent' }
];

const MAX_FILE_SIZE_MB = 5;
const MAX_FILES_COUNT = 5;
const ALLOWED_FILE_TYPES_FRONTEND = [ // قائمة للتحقق في الواجهة الأمامية (قد تكون أوسع قليلاً)
    'image/jpeg', 'image/png', 'image/gif', 'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain', 'application/zip', 'application/x-rar-compressed', 'application/vnd.rar',
    // بعض المتصفحات قد لا تتعرف على MIME type لـ .rar بشكل صحيح، لذا يمكن الاعتماد على الامتداد
];
const ALLOWED_EXTENSIONS_FRONTEND = /\.(jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|rar)$/i;


const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024; const dm = 2; const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const CreateTicketPage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [priority, setPriority] = useState('Medium');
    const [attachments, setAttachments] = useState([]); // Array of {file: File, id: string}
    const [formErrors, setFormErrors] = useState({});

    const { loadingCreate, successCreate, errorCreate, createdTicket } = useSelector(state => state.ticketReducer);
    const { user, isAuth, loading: userLoading } = useSelector(state => state.userReducer);

    useEffect(() => {
        dispatch(resetCreateTicketStatus());
        // لا تقم بإعادة تعيين الحقول هنا مباشرة عند تحميل المكون
        // بل عند نجاح الإرسال أو إذا كان المستخدم سيعيد فتح الصفحة
    }, [dispatch]); // إزالة user من هنا لمنع إعادة التعيين عند كل تغيير في بيانات المستخدم

    // إعادة تعيين النموذج عند نجاح الإنشاء أو عند تحميل الصفحة إذا لم يكن هناك خطأ سابق
    useEffect(() => {
        if (successCreate || (!loadingCreate && !errorCreate && !createdTicket)) {
            setTitle(''); setDescription(''); setCategory(''); setPriority('Medium'); setAttachments([]); setFormErrors({});
        }
    }, [successCreate, loadingCreate, errorCreate, createdTicket]);


    useEffect(() => {
        if (!userLoading && !isAuth) {
            toast.error("Please login to create a support ticket.");
            navigate('/login', { replace: true });
        }
    }, [isAuth, userLoading, navigate]);

    useEffect(() => {
        if (successCreate && createdTicket) {
            toast.success("Support ticket created successfully!");
            const ticketIdentifier = createdTicket.ticketId || createdTicket._id;
            if(ticketIdentifier) navigate(`/dashboard/support/tickets/${ticketIdentifier}`);
            else navigate('/dashboard/support/tickets');
            // إعادة التعيين تتم الآن في useEffect آخر
        }
        // خطأ الإنشاء يتم عرضه بواسطة الـ action أو يمكن عرضه في Alert
        if (errorCreate) {
            setFormErrors(prev => ({ ...prev, submit: errorCreate }));
        }
    }, [successCreate, errorCreate, createdTicket, navigate, dispatch]);

    const validateForm = () => {
        const errors = {};
        if (!title.trim()) errors.title = "Title is required.";
        else if (title.trim().length < 5) errors.title = "Title must be at least 5 characters.";
        else if (title.trim().length > 150) errors.title = "Title cannot exceed 150 characters.";
        
        if (!description.trim()) errors.description = "Description is required.";
        else if (description.trim().length < 20) errors.description = "Description must be at least 20 characters.";
        else if (description.trim().length > 5000) errors.description = "Description cannot exceed 5000 characters.";
        
        if (!category) errors.category = "Please select a category.";

        let attachmentErrorMessages = [];
        attachments.forEach(att => {
            if (att.file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
                attachmentErrorMessages.push(`File "${att.file.name}" exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
            }
            const fileExtension = "." + att.file.name.split('.').pop().toLowerCase();
            const isTypeAllowed = ALLOWED_FILE_TYPES_FRONTEND.includes(att.file.type);
            const isExtensionAllowed = ALLOWED_EXTENSIONS_FRONTEND.test(fileExtension);

            if (!isTypeAllowed && !isExtensionAllowed && att.file.type !== '') { // type can be empty string
                 attachmentErrorMessages.push(`File type of "${att.file.name}" is not allowed.`);
            }
        });
        if (attachments.length > MAX_FILES_COUNT) {
            attachmentErrorMessages.push(`You can upload a maximum of ${MAX_FILES_COUNT} files.`);
        }
        if(attachmentErrorMessages.length > 0) errors.attachments = attachmentErrorMessages.join(' ');

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleFileChange = (e) => {
        const newFilesArray = Array.from(e.target.files);
        let currentAttachmentObjects = [...attachments];
        let localFileErrors = [];

        for (let i = 0; i < newFilesArray.length; i++) {
            const file = newFilesArray[i];
            if (currentAttachmentObjects.length < MAX_FILES_COUNT) {
                const fileExtension = "." + file.name.split('.').pop().toLowerCase();
                const isTypeAllowed = ALLOWED_FILE_TYPES_FRONTEND.includes(file.type);
                const isExtensionAllowed = ALLOWED_EXTENSIONS_FRONTEND.test(fileExtension);

                if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
                    localFileErrors.push(`"${file.name}" is too large (max ${MAX_FILE_SIZE_MB}MB).`);
                } else if (!isTypeAllowed && !isExtensionAllowed && file.type !== '') {
                    localFileErrors.push(`File type of "${file.name}" is not permitted.`);
                } else if (!currentAttachmentObjects.some(att => att.file.name === file.name && att.file.size === file.size)) {
                    currentAttachmentObjects.push({ file, id: `${file.name}-${file.lastModified}-${file.size}-${Math.random()}` });
                } else {
                    localFileErrors.push(`File "${file.name}" is already selected.`);
                }
            } else {
                localFileErrors.push(`Max ${MAX_FILES_COUNT} files allowed.`);
                break;
            }
        }
        
        setAttachments(currentAttachmentObjects.slice(0, MAX_FILES_COUNT));

        if (localFileErrors.length > 0) {
            setFormErrors(prev => ({ ...prev, attachments: localFileErrors.join(' ') }));
            toast.error(localFileErrors.join('\n'), { autoClose: 5000 });
        } else if (formErrors.attachments && newFilesArray.length > 0) { // مسح خطأ المرفقات إذا تم اختيار ملفات صالحة
            setFormErrors(prev => ({ ...prev, attachments: null }));
        }
        if(fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeAttachment = (fileIdToRemove) => {
        setAttachments(prev => prev.filter(att => att.id !== fileIdToRemove));
        // إذا كان الخطأ السابق بسبب تجاوز العدد الأقصى، قم بإزالته عند حذف ملف
        if (attachments.length - 1 < MAX_FILES_COUNT && formErrors.attachments?.includes("maximum")) {
            setFormErrors(prev => ({ ...prev, attachments: null }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormErrors({}); 
        if (!validateForm()) { toast.error("Please correct the errors in the form before submitting."); return; }
        
        const ticketData = { title, description, category, priority };
        const filesToUpload = attachments.map(att => att.file);
        
        // مسح أي خطأ إرسال سابق
        setFormErrors(prev => ({ ...prev, submit: null }));

        try {
            // dispatch(createTicketAction) الآن يعيد promise.
            // إذا كان يرمي خطأ، سيتم التقاطه هنا.
            // حالة النجاح والخطأ تُدار بواسطة useEffect الذي يراقب successCreate و errorCreate.
            await dispatch(createTicketAction(ticketData, filesToUpload));
        } catch (submitError) {
            // هذا الـ catch سيلتقط الأخطاء إذا قام createTicketAction بـ throw error
            // أو إذا فشل الـ dispatch نفسه (نادر)
            console.error("Submission error caught in component handleSubmit:", submitError);
            setFormErrors(prev => ({ ...prev, submit: submitError.message || "An unexpected error occurred." }));
            // الـ Toast للخطأ يتم عرضه بواسطة الـ action نفسه
        }
    };
    
    if (userLoading) return (<Container className="py-5 text-center"><Spinner animation="border" variant="primary" /><p className="mt-2">Loading user data...</p></Container>);
    if (!isAuth) return (<Container className="py-5 text-center"><Alert variant="warning">You must be logged in to create a support ticket.</Alert><Button as={Link} to="/login" variant="primary">Go to Login</Button></Container>);

    return (
        <Container className="create-ticket-page py-lg-5 py-4">
            <Row className="justify-content-center">
                <Col md={10} lg={8} xl={7}>
                    <Card className="shadow-lg border-0 ticket-form-card">
                        <Card.Header className="bg-gradient-primary text-white ticket-form-header">
                            <h3 className="mb-0 d-flex align-items-center"><FaTicketAlt className="me-2" /> Open a New Support Ticket</h3>
                            <p className="mb-0 small">We're here to help. Please fill out the form below.</p>
                        </Card.Header>
                        <Card.Body className="p-4 p-md-5">
                            <Form onSubmit={handleSubmit} noValidate>
                                <Row>
                                    <Col md={12}>
                                        <Form.Group className="mb-4 position-relative" controlId="ticketTitle">
                                            <Form.Label className="fw-semibold d-flex align-items-center"><FiType className="me-2 form-icon" /> Title <span className="text-danger ms-1">*</span></Form.Label>
                                            <Form.Control type="text" placeholder="e.g., Issue with my last order payment" value={title} onChange={(e) => setTitle(e.target.value)} isInvalid={!!formErrors.title} maxLength={150} required size="lg"/>
                                            <Form.Control.Feedback type="invalid" className="d-block">{formErrors.title}</Form.Control.Feedback>
                                        </Form.Group>
                                    </Col>
                                </Row>
                                <Row>
                                    <Col md={6}>
                                        <Form.Group className="mb-4 position-relative" controlId="ticketCategoryControl">
                                            <Form.Label className="fw-semibold d-flex align-items-center"><FaTag className="me-2 form-icon" /> Category <span className="text-danger ms-1">*</span></Form.Label>
                                            <Form.Select value={category} onChange={(e) => setCategory(e.target.value)} isInvalid={!!formErrors.category} required size="lg">
                                                {TICKET_CATEGORIES.map(cat => (<option key={cat.value} value={cat.value} disabled={cat.value === ''}>{cat.label}</option>))}
                                            </Form.Select>
                                            <Form.Control.Feedback type="invalid" className="d-block">{formErrors.category}</Form.Control.Feedback>
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group className="mb-4" controlId="ticketPriorityControl">
                                            <Form.Label className="fw-semibold d-flex align-items-center"><FaExclamationTriangle className="me-2 form-icon" /> Priority</Form.Label>
                                            <Form.Select value={priority} onChange={(e) => setPriority(e.target.value)} size="lg">
                                                {TICKET_PRIORITIES.map(prio => (<option key={prio.value} value={prio.value}>{prio.label}</option>))}
                                            </Form.Select>
                                        </Form.Group>
                                    </Col>
                                </Row>
                                <Form.Group className="mb-4 position-relative" controlId="ticketDescription">
                                    <Form.Label className="fw-semibold d-flex align-items-center"><FiMessageSquare className="me-2 form-icon" /> Description <span className="text-danger ms-1">*</span></Form.Label>
                                    <Form.Control as="textarea" rows={7} placeholder="Please provide as much detail as possible..." value={description} onChange={(e) => setDescription(e.target.value)} isInvalid={!!formErrors.description} maxLength={5000} required size="lg"/>
                                    <Form.Control.Feedback type="invalid" className="d-block">{formErrors.description}</Form.Control.Feedback>
                                </Form.Group>
                                <Form.Group controlId="ticketAttachmentsGroup" className="mb-4">
                                    <Form.Label className="fw-semibold d-flex align-items-center"><FaPaperclip className="me-2 form-icon" /> Attachments</Form.Label>
                                    <div className={`custom-file-upload p-3 border rounded text-center ${formErrors.attachments ? 'is-invalid' : ''}`} onClick={() => fileInputRef.current && fileInputRef.current.click()} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleFileChange({ target: { files: e.dataTransfer.files } });}} onDragOver={(e) => {e.preventDefault(); e.stopPropagation();}} role="button" tabIndex={0}>
                                        <FaFileUpload size={30} className="text-muted mb-2" />
                                        <p className="mb-1 small text-muted">Drag & drop files here, or click to browse</p>
                                        <p className="mb-2 x-small text-muted">(Max {MAX_FILES_COUNT} files, up to {MAX_FILE_SIZE_MB}MB each)</p>
                                        <Form.Control ref={fileInputRef} type="file" multiple onChange={handleFileChange} accept={ALLOWED_FILE_TYPES_FRONTEND.join(',')} className="d-none"/>
                                    </div>
                                    {attachments.length > 0 && (
                                        <ListGroup variant="flush" className="mt-3 attachment-list">
                                            {attachments.map((att) => (
                                                <ListGroup.Item key={att.id} className="d-flex justify-content-between align-items-center px-0 py-2">
                                                    <div className="d-flex align-items-center"><FaFileAlt className="me-2 text-muted flex-shrink-0" /><span className="file-name me-2">{att.file.name}</span><Badge bg="light" text="dark" pill className="flex-shrink-0">{formatFileSize(att.file.size)}</Badge></div>
                                                    <Button variant="link" className="text-danger p-0 remove-attachment-btn" onClick={() => removeAttachment(att.id)} title="Remove file"><FaTimesCircle size={18} /></Button>
                                                </ListGroup.Item>
                                            ))}
                                        </ListGroup>
                                    )}
                                    {formErrors.attachments && <Form.Text className="text-danger small mt-1 d-block">{formErrors.attachments}</Form.Text>}
                                </Form.Group>
                                
                                {formErrors.submit && <Alert variant="danger" className="mt-3 py-2">{formErrors.submit}</Alert>}
                                {errorCreate && !formErrors.submit && <Alert variant="danger" className="mt-3 py-2">{errorCreate}</Alert> /* عرض خطأ عام من Redux إذا لم يكن هناك خطأ محدد */}

                                <Button variant="primary" type="submit" disabled={loadingCreate} className="w-100 mt-3 py-2 fs-5 ticket-submit-btn">
                                    {loadingCreate ? (<><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />Submitting...</>) : "Create Ticket"}
                                </Button>
                            </Form>
                        </Card.Body>
                        <Card.Footer className="text-center py-3 bg-light">
                            <p className="mb-0 small text-muted"><FaInfoCircle className="me-1" /> We typically respond within 24-48 hours.</p>
                        </Card.Footer>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};
export default CreateTicketPage;