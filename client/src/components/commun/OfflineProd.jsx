// src/components/commun/OfflineProd.jsx

import React, { useEffect, useMemo, useState, useRef } from "react";
import { Spinner, Alert, Container, Row, Col, Form } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import OfflineHeader from "./OfflineHeader";
import OfflineProdCard from "./OfflineProdCard";
import { getProducts } from "../../redux/actions/productAction";
import "./OfflineProd.css";
import { useTranslation } from "react-i18next";
import { FaFilter, FaSortAmountDown, FaSearch } from "react-icons/fa";

const TND_TO_USD_RATE = 3.0;

const OfflineProd = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("");
  const [selectedSort, setSelectedSort] = useState("newest");
  const productsFetched = useRef(false);

  const linkTypeMap = useMemo(
    () => ({
      "k&m": t("comptes.linkTypes.k&m", "Konami ID ✅ Gmail ❌ Mail ✅"),
      k: t("comptes.linkTypes.k", "Konami ID ✅ Gmail ❌ Mail ❌"),
      "k&g&m": t("comptes.linkTypes.k&g&m", "Konami ID ✅ Gmail ✅ Mail ✅"),
      "k&g": t("comptes.linkTypes.k&g", "Konami ID ✅ Gmail ✅ Mail ❌"),
      "g&m": t("comptes.linkTypes.g&m", "Konami ID ❌ Gmail ✅ Mail ✅"),
      g: t("comptes.linkTypes.g", "Konami ID ❌ Gmail ✅ Mail ❌"),
    }),
    [t]
  );

  // [!!!] التأكد من وجود Products دائماً كمصفوفة [!!!]
  const productState = useSelector((state) => state.productReducer);
  const Products = productState?.Products || []; 
  const loading = productState?.loading || false;
  const errors = productState?.errors || null;

  useEffect(() => {
    // جلب المنتجات دائماً عند تحميل الصفحة لضمان التحديث
    if (!productsFetched.current || Products.length === 0) {
      dispatch(getProducts());
      productsFetched.current = true;
    }
  }, [dispatch, Products.length]);

  const handleSearch = (term) => setSearchTerm(term);

  const availableLinkTypes = useMemo(() => {
    if (!Array.isArray(Products)) return [];
    // [!!!] تصحيح: التحقق من الحالة بمرونة (Case Insensitive) [!!!]
    const types = Products.filter(
      (p) => p && p.linkType && (p.status?.toLowerCase() === "approved")
    ).map((p) => p.linkType);
    return [...new Set(types)].sort();
  }, [Products]);

  const filteredAndSortedProducts = useMemo(() => {
    if (!Array.isArray(Products)) return [];
    const upperSearchTerm = searchTerm?.toUpperCase().trim() || "";

    // [!!!] التصفية الأساسية [!!!]
    let filtered = Products.filter((product) => {
        // 1. التأكد من وجود المنتج وبياناته الأساسية
        if (!product || !product._id) return false;
        
        // 2. [هام] التحقق من الحالة بمرونة (تقبل approved أو Approved)
        const isApproved = product.status?.toLowerCase() === "approved";
        if (!isApproved) return false;

        return true;
    });

    // فلترة البحث
    if (upperSearchTerm) {
      filtered = filtered.filter((product) =>
        product.title?.toUpperCase().includes(upperSearchTerm)
      );
    }

    // فلترة النوع
    if (selectedFilter) {
      filtered = filtered.filter(
        (product) => product.linkType === selectedFilter
      );
    }

    const getPriceInTND = (product) => {
      if (!product || product.price == null) return 0;
      // التحقق من العملة بحذر
      if (product.currency === "USD") {
        return product.price * TND_TO_USD_RATE;
      }
      return product.price;
    };

    const sorted = [...filtered];
    switch (selectedSort) {
      case "price_asc":
        sorted.sort((a, b) => getPriceInTND(a) - getPriceInTND(b));
        break;
      case "price_desc":
        sorted.sort((a, b) => getPriceInTND(b) - getPriceInTND(a));
        break;
      case "newest":
      default:
        sorted.sort(
          (a, b) =>
            new Date(b.date_added || b.createdAt || 0) -
            new Date(a.date_added || a.createdAt || 0)
        );
        break;
    }
    return sorted;
  }, [Products, searchTerm, selectedFilter, selectedSort]);

  let content;
  if (loading && Products.length === 0) { // عرض التحميل فقط إذا لم تكن هناك منتجات سابقة
    content = (
      <Col xs={12} className="text-center mt-5 pt-5 loading-placeholder">
        <Spinner animation="border" variant="primary" style={{ width: "3rem", height: "3rem" }} />
        <p className="mt-3 text-muted fw-bold fs-5">{t("home.loading")}</p>
      </Col>
    );
  } else if (errors) {
    content = (
      <Col xs={12}>
        <Alert variant="danger" className="w-75 mt-4 mx-auto text-center shadow-sm rounded-3">
          <h4>{t("home.errorTitle")}</h4>
          <p>{t(errors.key, errors.params)}</p>
        </Alert>
      </Col>
    );
  } else if (filteredAndSortedProducts.length > 0) {
    content = filteredAndSortedProducts.map((product) => (
      <Col
        key={product._id}
        xs={12}
        sm={6}
        md={6}
        lg={4}
        xl={4}
        className="mb-4 d-flex align-items-stretch product-grid-item"
      >
        <OfflineProdCard product={product} /> {/* [!!!] تأكدنا من تمرير product كـ prop اسمه product */}
      </Col>
    ));
  } else {
    content = (
      <Col xs={12}>
        <div className="text-center py-5 no-results-alert">
          <FaSearch size={50} className="text-muted mb-3" opacity={0.3} />
          <h5 className="text-dark">
            {searchTerm || selectedFilter
              ? t("home.noProductsMatch", { criteria: searchTerm || selectedFilter })
              : t("home.noProducts")}
          </h5>
          <p className="text-muted">{t("home.tryDifferentSearch", "Try adjusting your search or filters")}</p>
        </div>
      </Col>
    );
  }

  return (
    <div className="offline-page">
      <OfflineHeader onSearch={handleSearch} />
      
      {/* Hero Section */}
      <section className="hero-section text-center">
        <Container>
          <h1 className="display-4 mb-3 hero-title">
            {t("home.heroTitle")}
          </h1>
          <p className="lead col-lg-8 mx-auto mb-4 hero-subtitle">
            {t("home.heroSubtitle")}
          </p>
        </Container>
      </section>

      {/* Main Content with Floating Filter Bar */}
      <Container fluid="xl" className="filter-sort-container">
        <Row className="justify-content-center">
          <Col xs={12} lg={10}>
            <div className="filter-sort-row d-flex flex-wrap align-items-center justify-content-between">
              
              {/* Filter */}
              <div className="d-flex align-items-center mb-3 mb-md-0 flex-grow-1">
                <FaFilter className="text-primary me-3" size={20} />
                <div className="flex-grow-1">
                    <Form.Select
                    aria-label={t("home.filterByType")}
                    value={selectedFilter}
                    onChange={(e) => setSelectedFilter(e.target.value)}
                    className="filter-select w-100"
                    >
                    <option value="">{t("home.allLinkTypes")}</option>
                    {availableLinkTypes.map((type) => (
                        <option key={type} value={type}>
                        {linkTypeMap[type] || type}
                        </option>
                    ))}
                    </Form.Select>
                </div>
              </div>

              {/* Sort */}
              <div className="d-flex align-items-center ms-md-4">
                <FaSortAmountDown className="text-primary me-3" size={20} />
                <div className="flex-grow-1">
                    <Form.Select
                    aria-label={t("home.sortByAria")}
                    value={selectedSort}
                    onChange={(e) => setSelectedSort(e.target.value)}
                    className="sort-select"
                    >
                    <option value="newest">{t("home.sort.newest")}</option>
                    <option value="price_asc">{t("home.sort.priceAsc")}</option>
                    <option value="price_desc">{t("home.sort.priceDesc")}</option>
                    </Form.Select>
                </div>
              </div>

            </div>
          </Col>
        </Row>
      </Container>

      {/* Products Grid */}
      <Container fluid="xl" className="products-section">
        <Row className="g-4 justify-content-center">
          {content}
        </Row>
      </Container>
    </div>
  );
};

export default OfflineProd;