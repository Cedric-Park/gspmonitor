const express = require('express');
const router = express.Router();
const gameModel = require('../models/game');
const managerModel = require('../models/manager');
const statisticsModel = require('../models/statistics');

// 권한 체크 미들웨어
function checkAdminManagerRole(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  
  if (req.session.user.role === '어드민' || req.session.user.role === '매니저') {
    next();
  } else {
    res.status(403).render('error', {
      title: '접근 제한',
      message: '이 페이지에 접근할 수 있는 권한이 없습니다.',
      error: { status: 403 }
    });
  }
}

// 홈 페이지
router.get('/', async (req, res) => {
  try {
    let companyPoints;
    let gamesWithCategoryUsage;
    
    // 현재 사용자의 역할에 따라 데이터 필터링
    if (req.session.user.role === '담당자') {
      // 담당자의 경우 본인이 담당하는 게임사 데이터만 표시
      const managerId = req.session.user.id;
      const userCompanies = await managerModel.getCompaniesByManager(managerId);
      
      if (userCompanies && userCompanies.length > 0) {
        companyPoints = await gameModel.getPointsByCompanies(userCompanies);
        
        // 서비스 부문별 포인트 사용량을 포함한 게임 데이터
        const allGamesWithCategories = await gameModel.getAllGamesWithPointUsageAndCategories();
        gamesWithCategoryUsage = allGamesWithCategories.filter(game => 
          userCompanies.includes(game.companyName)
        );
      } else {
        companyPoints = [];
        gamesWithCategoryUsage = [];
      }
    } else {
      // 어드민과 매니저는 모든 게임사 데이터 표시
      companyPoints = await gameModel.getPointsByCompany();
      gamesWithCategoryUsage = await gameModel.getAllGamesWithPointUsageAndCategories();
    }
    
    // 사용률 기준으로 내림차순 정렬 (사용률이 높은 순으로)
    if (gamesWithCategoryUsage && gamesWithCategoryUsage.length > 0) {
      gamesWithCategoryUsage.sort((a, b) => {
        const usageRateA = a.totalPoints > 0 ? (a.pointsUsed.total / a.totalPoints * 100) : 0;
        const usageRateB = b.totalPoints > 0 ? (b.pointsUsed.total / b.totalPoints * 100) : 0;
        return usageRateB - usageRateA; // 내림차순 정렬
      });
    }
    
    // 각 게임사의 계약 정보 존재 여부 확인
    const companyContractStatus = await gameModel.getCompanyContractStatus();
    
    // 마지막 동기화 시간과 다음 동기화까지 남은 시간 정보 가져오기
    const syncInfo = await gameModel.getNextSyncInfo();
    
    res.render('index', { 
      title: '대시보드',
      companyPoints,
      gamesWithCategoryUsage,
      companyContractStatus,
      syncInfo: {
        lastSync: syncInfo.lastSync ? syncInfo.lastSync.toLocaleString('ko-KR') : '정보 없음',
        nextSync: syncInfo.nextSync ? syncInfo.nextSync.toLocaleString('ko-KR') : '정보 없음',
        remainingMinutes: syncInfo.remainingMinutes || 0
      }
    });
  } catch (error) {
    console.error('홈 페이지 에러:', error);
    res.status(500).render('error', { 
      title: '오류 발생',
      message: '데이터를 가져오는 중 오류가 발생했습니다.',
      error
    });
  }
});

// 통계 페이지 (어드민과 매니저만 접근 가능)
router.get('/statistics', checkAdminManagerRole, async (req, res) => {
  try {
    // 날짜 필터링 파라미터 가져오기 (옵션)
    let startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    let endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    
    // 날짜가 지정되지 않은 경우 기본값 설정 (최근 3개월)
    if (!startDate) {
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3);
    }
    
    if (!endDate) {
      endDate = new Date();
    }
    
    // 게임사별 포인트 사용률 통계 가져오기
    const companyUsageStats = await statisticsModel.getCompanyUsageStatistics(startDate, endDate);
    
    // 서비스 부문별 포인트 사용 통계 가져오기
    const serviceCategoryStats = await statisticsModel.getServiceCategoryStatistics(startDate, endDate);
    
    // 마지막 동기화 시간과 다음 동기화까지 남은 시간 정보 가져오기
    const syncInfo = await gameModel.getNextSyncInfo();
    
    res.render('statistics', {
      title: '포인트 통계',
      companyUsageStats,
      serviceCategoryStats,
      currentFilters: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      },
      syncInfo: {
        lastSync: syncInfo.lastSync ? syncInfo.lastSync.toLocaleString('ko-KR') : '정보 없음',
        nextSync: syncInfo.nextSync ? syncInfo.nextSync.toLocaleString('ko-KR') : '정보 없음',
        remainingMinutes: syncInfo.remainingMinutes || 0
      }
    });
  } catch (error) {
    console.error('통계 페이지 에러:', error);
    res.status(500).render('error', {
      title: '오류 발생',
      message: '통계 데이터를 가져오는 중 오류가 발생했습니다.',
      error
    });
  }
});

// 데이터 동기화 기능
router.get('/sync', async (req, res) => {
  try {
    // 권한 체크가 이미 미들웨어에서 처리됨
    const result = await gameModel.syncWithGoogleSheet();
    res.redirect('/?sync=success');
  } catch (error) {
    console.error('동기화 에러:', error);
    res.status(500).render('error', {
      title: '동기화 오류',
      message: '구글 스프레드시트와 동기화 중 오류가 발생했습니다.',
      error
    });
  }
});

module.exports = router; 