// src/components/commun/OfflineProd.jsx

import React, { useEffect, useMemo, useState, useRef } from "react";
import { Spinner, Alert, Container, Row, Col, Form } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import OfflineHeader from "./OfflineHeader";
import OfflineProdCard from "./OfflineProdCard";
import { getProducts } from "../../redux/actions/productAction";
import "./OfflineProd.css";
import { useTranslation } from "react-i18next";

const TND_TO_USD_RATE = 3.0;

const OfflineProd = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("");
  const [selectedSort, setSelectedSort] = useState("newest");
  const productsFetched = useRef(false);

  // [!!!] START: إضافة خريطة الترجمة هنا
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
  // [!!!] END: نهاية الإضافة

  const Products = useSelector((state) => state.productReducer?.Products ?? []);
  const loading = useSelector(
    (state) => state.productReducer?.loading ?? false
  );
  const errors = useSelector((state) => state.productReducer?.errors ?? null);

  useEffect(() => {
    if (!productsFetched.current) {
      dispatch(getProducts());
      productsFetched.current = true;
    }
  }, [dispatch]);

  const handleSearch = (term) => setSearchTerm(term);

  const availableLinkTypes = useMemo(() => {
    if (!Array.isArray(Products)) return [];
    const types = Products.filter(
      (p) => p?.status === "approved" && p.linkType
    ).map((p) => p.linkType);
    return [...new Set(types)].sort();
  }, [Products]);

  const filteredAndSortedProducts = useMemo(() => {
    if (!Array.isArray(Products)) return [];
    const upperSearchTerm = searchTerm?.toUpperCase().trim() || "";

    let filtered = Products.filter(
      (product) =>
        product &&
        product._id &&
        product.title &&
        product.price != null &&
        product.user?._id &&
        product.currency
    ).filter((product) => product.status === "approved");

    if (upperSearchTerm) {
      filtered = filtered.filter((product) =>
        product.title?.toUpperCase().includes(upperSearchTerm)
      );
    }

    if (selectedFilter) {
      filtered = filtered.filter(
        (product) => product.linkType === selectedFilter
      );
    }

    const getPriceInTND = (product) => {
      if (!product || product.price == null || !product.currency) return 0;
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
  if (loading && !productsFetched.current) {
    content = (
      <Col xs={12} className="text-center mt-5 pt-5 loading-placeholder">
        <Spinner animation="border" variant="primary" />
        <p className="mt-2 text-muted">{t("home.loading")}</p>
      </Col>
    );
  } else if (errors) {
    content = (
      <Col xs={12}>
        <Alert
          variant="danger"
          className="w-75 mt-4 mx-auto text-center shadow-sm"
        >
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
        <OfflineProdCard el={product} />
      </Col>
    ));
  } else if (productsFetched.current && !loading) {
    content = (
      <Col xs={12}>
        <Alert
          variant="secondary"
          className="mt-4 text-center no-results-alert"
        >
          {searchTerm || selectedFilter
            ? t("home.noProductsMatch", {
                criteria: searchTerm || selectedFilter,
              })
            : t("home.noProducts")}
        </Alert>
      </Col>
    );
  } else {
    content = null;
  }

  return (
    <div className="offline-page">
      <OfflineHeader onSearch={handleSearch} />
      <section className="hero-section text-center text-white py-5">
        <Container>
          <h1 className="display-4 fw-bold mb-3 hero-title">
            {t("home.heroTitle")}
          </h1>
          <p className="lead col-lg-8 mx-auto mb-4 hero-subtitle">
            {t("home.heroSubtitle")}
          </p>
        </Container>
      </section>
      <Container fluid="xl" className="py-4 py-md-5 products-section">
        <Row className="mb-4 align-items-center filter-sort-row">
          <Col md={6} lg={4} className="mb-3 mb-md-0">
            <Form.Group controlId="filterLinkType">
              <Form.Label className="visually-hidden">
                {t("home.filterByType")}
              </Form.Label>
              <Form.Select
                aria-label={t("home.filterByType")}
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value)}
                size="sm"
                className="filter-select"
              >
                <option value="">{t("home.allLinkTypes")}</option>
                {/* [!!!] START: التعديل هنا لعرض النص الكامل */}
                {availableLinkTypes.map((type) => (
                  <option key={type} value={type}>
                    {linkTypeMap[type] || type}
                  </option>
                ))}
                {/* [!!!] END: نهاية التعديل */}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col
            md={6}
            lg={{ span: 4, offset: 4 }}
            className="d-flex justify-content-md-end"
          >
            <Form.Group
              controlId="sortProducts"
              className="d-flex align-items-center"
            >
              <Form.Label className="me-2 mb-0 text-muted small text-nowrap">
                {t("home.sortBy")}:
              </Form.Label>
              <Form.Select
                aria-label={t("home.sortByAria")}
                value={selectedSort}
                onChange={(e) => setSelectedSort(e.target.value)}
                size="sm"
                className="sort-select"
              >
                <option value="newest">{t("home.sort.newest")}</option>
                <option value="price_asc">{t("home.sort.priceAsc")}</option>
                <option value="price_desc">{t("home.sort.priceDesc")}</option>
              </Form.Select>
            </Form.Group>
          </Col>
        </Row>
        <Row className="g-4">{content}</Row>
      </Container>
    </div>
  );
};

export default OfflineProd;