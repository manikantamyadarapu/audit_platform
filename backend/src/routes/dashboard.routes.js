const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

const router = express.Router();

/**
 * @swagger
 * /api/v1/dashboard/widgets:
 *   get:
 *     summary: Get dashboard KPI widgets with period trends
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, year]
 *           default: week
 *         description: Time window for metrics (last 7 / 30 / 365 days vs previous period)
 *     responses:
 *       200:
 *         description: Dashboard widgets fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Dashboard widgets fetched successfully
 *                 data:
 *                   $ref: '#/components/schemas/DashboardWidgetsData'
 *       400:
 *         description: Invalid period filter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardErrorBody'
 *             example:
 *               success: false
 *               message: Invalid period filter
 *       401:
 *         description: Access token required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardErrorBody'
 *             example:
 *               success: false
 *               message: Access token required
 *       403:
 *         description: Invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardErrorBody'
 *             example:
 *               success: false
 *               message: Invalid or expired token
 *       404:
 *         description: Dashboard data not found
 *       500:
 *         description: Internal server error
 */
router.get('/widgets', authMiddleware, dashboardController.getDashboardWidgets);

/**
 * @swagger
 * /api/v1/dashboard/audit-trend:
 *   get:
 *     summary: Get audit activity trend chart data
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: daily
 *         description: daily = last 7 days, weekly = last 12 weeks, monthly = last 12 months
 *     responses:
 *       200:
 *         description: Audit trend fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Audit trend fetched successfully
 *                 data:
 *                   $ref: '#/components/schemas/DashboardAuditTrendData'
 *       400:
 *         description: Invalid period filter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardErrorBody'
 *             example:
 *               success: false
 *               message: Invalid period filter
 *       401:
 *         description: Access token required
 *       403:
 *         description: Invalid or expired token
 *       500:
 *         description: Internal server error
 */
router.get('/audit-trend', authMiddleware, dashboardController.getAuditTrend);

/**
 * @swagger
 * /api/v1/dashboard/issues-category:
 *   get:
 *     summary: Get issues grouped by dashboard category
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, year]
 *           default: week
 *         description: week = last 7 days, month = last 30 days, year = last 365 days
 *     responses:
 *       200:
 *         description: Issues by category fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Issues by category fetched successfully
 *                 data:
 *                   $ref: '#/components/schemas/DashboardIssuesCategoryData'
 *       400:
 *         description: Invalid period filter
 *       401:
 *         description: Access token required
 *       403:
 *         description: Invalid or expired token
 *       500:
 *         description: Internal server error
 */
router.get('/issues-category', authMiddleware, dashboardController.getIssuesByCategory);

module.exports = router;
