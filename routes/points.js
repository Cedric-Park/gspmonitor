const express = require('express');
const router = express.Router();
const db = require('../db/database');
const pointCalculator = require('../models/pointCalculator');

// 인증 미들웨어
const requireAuth = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
};

// 권한 검사 미들웨어
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }
    
    if (roles.includes(req.session.user.role)) {
      return next();
    }
    
    res.status(403).json({ success: false, message: '권한이 없습니다.' });
  };
};

// 계약별 자부담 포인트 사용 토글
router.post('/toggle/:contractId', requireAuth, requireRole(['어드민', '매니저']), async (req, res) => {
  try {
    const { contractId } = req.params;
    const { usePoints } = req.body;

    // 계약 정보 조회
    const contract = await new Promise((resolve, reject) => {
      db.get(`
        SELECT c.*, g.id as game_id, g.game_name, g.company_name as game_company
        FROM contracts c
        LEFT JOIN games g ON g.company_name = c.company_name
        WHERE c.contract_id = ?
      `, [contractId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!contract) {
      return res.status(404).json({ success: false, message: '계약을 찾을 수 없습니다.' });
    }

    if (!contract.contract_amount || !contract.selected_vendor) {
      return res.status(400).json({ 
        success: false, 
        message: '계약 금액과 선정 협력사가 확정된 계약만 포인트 사용이 가능합니다.' 
      });
    }

    if (!contract.game_id) {
      return res.status(400).json({ 
        success: false, 
        message: '해당 게임사의 게임 정보를 찾을 수 없습니다.' 
      });
    }

    // 자부담 포인트 우선 사용 설정 토글
    const result = await pointCalculator.toggleSelfPointsUsage(contractId, usePoints);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({ 
      success: true, 
      message: usePoints ? '자부담 포인트 우선 사용이 설정되었습니다.' : '자부담 포인트 우선 사용이 해제되었습니다.'
    });

  } catch (error) {
    console.error('포인트 토글 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '포인트 설정 중 오류가 발생했습니다.' 
    });
  }
});

// 게임별 포인트 사용량 조회
router.get('/usage/:gameId', requireAuth, async (req, res) => {
  try {
    const { gameId } = req.params;
    const usage = await pointCalculator.getGamePointUsage(gameId);
    res.json({ success: true, usage });
  } catch (error) {
    console.error('포인트 사용량 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '포인트 사용량 조회 중 오류가 발생했습니다.' 
    });
  }
});

// 우수게임사 토글
router.post('/excellent/:gameId/:phase', requireAuth, requireRole(['어드민']), async (req, res) => {
  try {
    const { gameId, phase } = req.params;
    const { isExcellent } = req.body;

    // phase 유효성 검증
    if (!['1st', '2nd', '3rd'].includes(phase)) {
      return res.status(400).json({ 
        success: false, 
        message: '유효하지 않은 차수입니다. 1st, 2nd, 3rd 중 하나여야 합니다.' 
      });
    }

    // 우수게임사 토글
    const result = await pointCalculator.toggleExcellentCompany(gameId, phase, isExcellent);

    if (!result.success) {
      return res.status(400).json(result);
    }

    const phaseNames = {
      '1st': '1차',
      '2nd': '2차', 
      '3rd': '3차'
    };

    res.json({ 
      success: true, 
      message: isExcellent 
        ? `${phaseNames[phase]} 우수게임사로 지정되었습니다. (1억 포인트 추가)` 
        : `${phaseNames[phase]} 우수게임사 지정이 해제되었습니다.`,
      data: result
    });

  } catch (error) {
    console.error('우수게임사 토글 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '우수게임사 설정 중 오류가 발생했습니다.' 
    });
  }
});

// 우수게임사 상태 조회
router.get('/excellent/:gameId', requireAuth, async (req, res) => {
  try {
    const { gameId } = req.params;
    const status = await pointCalculator.getExcellentCompanyStatus(gameId);
    res.json({ success: true, status });
  } catch (error) {
    console.error('우수게임사 상태 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '우수게임사 상태 조회 중 오류가 발생했습니다.' 
    });
  }
});

module.exports = router; 