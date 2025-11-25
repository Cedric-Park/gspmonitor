const express = require('express');
const router = express.Router();
const reportsModel = require('../models/reports');
const managerModel = require('../models/manager');

/**
 * 연간 성과 보고서 페이지
 */
router.get('/annual-performance', async (req, res) => {
  try {
    const year = parseInt(req.query.year) || 2025;
    
    console.log(`[보고서 라우트] ${year}년 연간 성과 보고서 요청`);
    
    // 연간 성과 보고서 데이터 조회
    const reportData = await reportsModel.getAnnualPerformanceReport(year);
    
    res.render('reports/annual-performance', {
      title: `${year}년 게임더하기 사업 성과 보고서`,
      user: req.session.user,
      reportData,
      year
    });
  } catch (error) {
    console.error('[보고서 라우트] 연간 성과 보고서 조회 오류:', error);
    res.status(500).render('error', {
      title: '오류',
      user: req.session.user,
      message: '연간 성과 보고서를 불러오는 중 오류가 발생했습니다.',
      error: error
    });
  }
});

/**
 * 보고서 데이터 API (JSON)
 */
router.get('/api/annual-performance', async (req, res) => {
  try {
    const year = parseInt(req.query.year) || 2025;
    const reportData = await reportsModel.getAnnualPerformanceReport(year);
    
    res.json({
      success: true,
      data: reportData
    });
  } catch (error) {
    console.error('[보고서 API] 연간 성과 보고서 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '연간 성과 보고서를 불러오는 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 게임사별 개별 성과 보고서 페이지
 */
router.get('/company/:companyName', async (req, res) => {
  try {
    const companyName = decodeURIComponent(req.params.companyName);
    const year = parseInt(req.query.year) || 2025;
    
    console.log(`[보고서 라우트] ${companyName} 개별 보고서 요청`);
    
    // 담당자 권한 체크
    if (req.session.user.role === '담당자') {
      const userCompanies = await managerModel.getCompaniesByManager(req.session.user.id);
      if (!userCompanies.includes(companyName)) {
        return res.status(403).render('error', {
          title: '접근 권한 없음',
          user: req.session.user,
          message: '해당 게임사의 보고서에 접근할 권한이 없습니다.',
          error: { status: 403 }
        });
      }
    }
    
    // 게임사별 보고서 데이터 조회
    const reportData = await reportsModel.getCompanyReport(companyName, year);
    
    res.render('reports/company-performance', {
      title: `${companyName} 성과 보고서`,
      user: req.session.user,
      reportData,
      year
    });
  } catch (error) {
    console.error('[보고서 라우트] 게임사별 보고서 조회 오류:', error);
    
    if (error.message.includes('찾을 수 없습니다')) {
      return res.status(404).render('error', {
        title: '게임사를 찾을 수 없음',
        user: req.session.user,
        message: error.message,
        error: { status: 404 }
      });
    }
    
    res.status(500).render('error', {
      title: '오류',
      user: req.session.user,
      message: '게임사별 보고서를 불러오는 중 오류가 발생했습니다.',
      error: error
    });
  }
});

module.exports = router;

