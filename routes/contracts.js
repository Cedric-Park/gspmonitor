const express = require('express');
const router = express.Router();
const gameModel = require('../models/game');

// 권한 체크 미들웨어
function checkAdminManagerRole(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  
  if (req.session.user.role === '어드민' || req.session.user.role === '매니저' || req.session.user.role === '담당자') {
    next();
  } else {
    res.status(403).render('error', {
      title: '접근 제한',
      message: '이 페이지에 접근할 수 있는 권한이 없습니다.',
      error: { status: 403 }
    });
  }
}

// 전체 계약 목록 페이지
router.get('/', checkAdminManagerRole, async (req, res) => {
  try {
    // 쿼리 파라미터로 필터링 옵션 받기
    const filters = {
      companyName: req.query.company || '',
      status: req.query.status || '',
      workStatus: req.query.work_status || '',
      serviceCategory: req.query.service_category || '',
      selectedVendor: req.query.vendor || '',
      dateFrom: req.query.date_from || '',
      dateTo: req.query.date_to || '',
      managerId: req.query.manager_id || ''
    };
    
    // 정렬 옵션
    const sortBy = req.query.sort_by || 'work_end_date';
    const sortOrder = req.query.sort_order || 'DESC';
    
    // 전체 계약 정보 가져오기 (필터링 및 정렬 적용)
    const contracts = await gameModel.getAllContracts(filters, sortBy, sortOrder);
    
    // 게임사 목록 가져오기 (필터 드롭다운용)
    const companies = await gameModel.getAllCompanyNames();
    
    // 담당자 목록 가져오기
    const managers = await gameModel.getAllManagers();
    
    // 상태 목록 (중복 제거)
    const statuses = [...new Set(contracts.map(c => c.status))].filter(s => s);
    
    // 업무 상태 목록 (중복 제거)
    const workStatuses = [...new Set(contracts.map(c => c.work_status))].filter(s => s);
    
    // 서비스 카테고리 목록 (중복 제거)
    const serviceCategories = [...new Set(contracts.map(c => c.service_category))].filter(s => s);
    
    // 선정 협력사 목록 (중복 제거)
    const vendors = [...new Set(contracts.map(c => c.selected_vendor))].filter(v => v);
    
    // 통계 계산
    const stats = {
      total: contracts.length,
      ongoing: contracts.filter(c => c.work_status === '진행 중').length,
      completed: contracts.filter(c => c.work_status === '업무 종료').length,
      contracted: contracts.filter(c => c.status === '최종계약체결' || c.status === '계약종료(정산)').length,
      totalAmount: contracts.reduce((sum, c) => {
        if (c.contract_amount && c.selected_vendor) {
          const amount = parseContractAmount(c.contract_amount);
          return sum + amount;
        }
        return sum;
      }, 0)
    };
    
    res.render('contracts/index', {
      title: '계약 관리',
      contracts,
      companies,
      managers,
      statuses,
      workStatuses,
      serviceCategories,
      vendors,
      filters,
      sortBy,
      sortOrder,
      stats,
      req
    });
  } catch (error) {
    console.error('계약 목록 페이지 에러:', error);
    res.status(500).render('error', {
      title: '오류 발생',
      message: '계약 정보를 가져오는 중 오류가 발생했습니다.',
      error
    });
  }
});

// 계약 메모 수정 API
router.post('/update-memo', async (req, res) => {
  try {
    const { contractId, memo } = req.body;
    
    if (!contractId) {
      return res.status(400).json({
        success: false,
        message: '계약 ID가 필요합니다.'
      });
    }
    
    // DB 업데이트
    const db = require('../db/database');
    db.run(
      'UPDATE contracts SET memo = ? WHERE id = ?',
      [memo || null, contractId],
      function(err) {
        if (err) {
          console.error('메모 업데이트 오류:', err);
          return res.status(500).json({
            success: false,
            message: '메모 저장 중 오류가 발생했습니다.'
          });
        }
        
        res.json({
          success: true,
          message: '메모가 저장되었습니다.',
          memo: memo || ''
        });
      }
    );
  } catch (error) {
    console.error('메모 업데이트 에러:', error);
    res.status(500).json({
      success: false,
      message: '메모 저장 중 오류가 발생했습니다.'
    });
  }
});

// 계약 금액 파싱 함수 (pointCalculator와 동일)
function parseContractAmount(amountStr) {
  if (!amountStr) return 0;
  
  // "원" 제거하고 쉼표 제거
  const cleanAmount = amountStr.replace(/[,원\s]/g, '');
  
  // 숫자로 변환
  const amount = parseInt(cleanAmount);
  
  return isNaN(amount) ? 0 : amount;
}

// 계약 포인트 배분 업데이트 API
router.post('/:contractId/update-points', checkAdminManagerRole, async (req, res) => {
  try {
    const contractId = req.params.contractId;
    const { base_points_used } = req.body;
    
    const db = require('../db/database').getDatabase();
    
    const query = `UPDATE contracts SET base_points_used = ? WHERE id = ?`;
    
    db.run(query, [base_points_used, contractId], function(err) {
      if (err) {
        console.error('포인트 배분 업데이트 오류:', err);
        return res.json({ success: false, message: err.message });
      }
      
      res.json({ success: true, message: '포인트 배분이 업데이트되었습니다.' });
    });
  } catch (error) {
    console.error('포인트 배분 업데이트 오류:', error);
    res.json({ success: false, message: error.message });
  }
});

module.exports = router;

