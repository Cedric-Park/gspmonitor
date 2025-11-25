const express = require('express');
const router = express.Router();
const gameModel = require('../models/game');
const managerModel = require('../models/manager');
const statisticsModel = require('../models/statistics');

// 게임 ID로 게임 정보 조회 API (JSON)
router.get('/api/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const db = require('../db/database').getDatabase();
    
    const query = `SELECT * FROM games WHERE id = ?`;
    
    db.get(query, [gameId], (err, game) => {
      if (err) {
        console.error('게임 조회 오류:', err);
        return res.json({ success: false, message: err.message });
      }
      
      if (!game) {
        return res.json({ success: false, message: '게임을 찾을 수 없습니다.' });
      }
      
      res.json({ success: true, game });
    });
  } catch (error) {
    console.error('게임 조회 오류:', error);
    res.json({ success: false, message: error.message });
  }
});

// 게임사별 게임 목록 가져오기
router.get('/company/:companyName', async (req, res) => {
  try {
    const { companyName } = req.params;
    
    // 사용자 권한 확인
    if (req.session.user.role === '담당자') {
      // 담당자인 경우 해당 게임사가 본인 담당인지 확인
      const managerId = req.session.user.id;
      const userCompanies = await managerModel.getCompaniesByManager(managerId);
      
      if (!userCompanies.includes(companyName)) {
        return res.status(403).render('error', {
          title: '접근 권한 없음',
          message: '해당 게임사에 대한 접근 권한이 없습니다.',
          error: { status: 403 }
        });
      }
    }
    
    const games = await gameModel.getAllGames();
    
    // 특정 회사의 게임만 필터링
    const companyGames = games.filter(game => game.company_name === companyName);
    
    // 포인트 사용량을 포함한 게임 목록 (카테고리별 사용량 포함)
    const gamesWithUsage = await gameModel.getAllGamesWithPointUsageAndCategories();
    const companyGamesWithUsage = gamesWithUsage.filter(game => game.companyName === companyName);
    
    // 총 포인트 계산
    const totalBasePoints = companyGames.reduce((sum, game) => sum + game.base_points, 0);
    const totalSelfPoints = companyGames.reduce((sum, game) => sum + game.self_points, 0);
    const totalPoints = totalBasePoints + totalSelfPoints;
    
    // 사용된 포인트 총계 계산
    const totalUsedPoints = companyGamesWithUsage.reduce((sum, game) => sum + game.pointsUsed.total, 0);
    const totalUsedSelfPoints = companyGamesWithUsage.reduce((sum, game) => sum + game.pointsUsed.self, 0);
    const totalUsedBasePoints = companyGamesWithUsage.reduce((sum, game) => sum + game.pointsUsed.base, 0);
    
    // 총 사용량 데이터
    const totalUsageData = {
      total: totalUsedPoints,
      self: totalUsedSelfPoints,
      base: totalUsedBasePoints
    };
    
    // 해당 게임사의 계약 정보 가져오기
    const contracts = await gameModel.getContractsByCompany(companyName);
    
    // 전체 계약 금액 합산
    let totalContractAmount = 0;
    contracts.forEach(contract => {
      if (contract.contract_amount && contract.selected_vendor && 
          (contract.status === '최종계약체결' || contract.status === '계약종료(정산)')) {
        const amount = parseContractAmount(contract.contract_amount);
        if (amount > 0) {
          totalContractAmount += amount;
        }
      }
    });
    
    // 서비스 부문별 사용량
    const serviceCategoryUsage = {};
    
    // 각 게임의 카테고리별 사용량 합산
    companyGamesWithUsage.forEach(game => {
      if (game.categoryUsage) {
        Object.keys(game.categoryUsage).forEach(category => {
          if (!serviceCategoryUsage[category]) {
            serviceCategoryUsage[category] = {
              totalUsed: 0,
              contractCount: 0
            };
          }
          
          serviceCategoryUsage[category].totalUsed += game.categoryUsage[category].totalUsed;
          serviceCategoryUsage[category].contractCount += game.categoryUsage[category].contractCount || 0;
        });
      }
    });
    
    // 계약 상태 목록 (필터링용)
    const contractStatusList = ['견적요청', '견적서 제출', '선정완료', '계약완료'];
    
    // 성과 현황 데이터 가져오기
    const gamePerformanceData = {};
    
    // 디버그 로그 추가
    console.log(`${companyName} 게임사의 성과 현황 데이터 조회 시작`);

    // 각 지표별로 데이터 가져오기
    const metrics = ['revenue', 'downloads', 'dau', 'wishlist'];
    const regions = ['global', 'target'];
    const periods = ['daily', 'weekly', 'monthly'];

    try {
      for (const metric of metrics) {
        gamePerformanceData[metric] = {};
        
        for (const region of regions) {
          gamePerformanceData[metric][region] = {};
          
          for (const period of periods) {
            console.log(`${companyName} - ${metric} - ${region} - ${period} 데이터 조회 중...`);
            const data = await statisticsModel.getAggregatedPerformanceData(
              companyName, 
              null, // 모든 게임 포함
              period,
              metric,
              region
            );
            
            gamePerformanceData[metric][region][period] = data;
            console.log(`${companyName} - ${metric} - ${region} - ${period} 데이터 조회 완료:`, 
              data ? `${data.length}개 항목` : '데이터 없음');
            
            // 첫 번째 데이터 항목 출력 (샘플)
            if (data && data.length > 0) {
              console.log(`${companyName} - ${metric} - ${region} - ${period} 샘플 데이터:`, data[0]);
            }
          }
        }
      }
      
      console.log(`${companyName} 게임사의 성과 현황 데이터 조회 완료`);
      console.log('전체 gamePerformanceData 구조:', JSON.stringify(gamePerformanceData));
    } catch (error) {
      console.error(`${companyName} 게임사의 성과 현황 데이터 조회 오류:`, error);
      // 오류가 발생해도 빈 객체로 계속 진행
    }
    
    res.render('company', { 
      title: `${companyName} 게임 목록`,
      companyName,
      games: companyGames,
      gamesWithUsage: companyGamesWithUsage,
      contracts,
      contractStatusList,
      totalBasePoints,
      totalSelfPoints,
      totalPoints,
      totalUsageData,
      totalContractAmount,
      serviceCategoryUsage,
      userRole: req.session.user.role,
      gamePerformanceData, // 성과 현황 데이터 추가
      defaultMetric: 'revenue', // 기본 지표 설정
      defaultRegion: 'global', // 기본 지역 설정
      defaultPeriod: 'daily' // 기본 기간 설정
    });
  } catch (error) {
    console.error('회사별 게임 목록 에러:', error);
    res.status(500).render('error', { 
      title: '오류 발생',
      message: '회사별 게임 데이터를 가져오는 중 오류가 발생했습니다.',
      error
    });
  }
});

// 계약금액에서 숫자만 추출하는 함수
function parseContractAmount(contractAmountStr) {
  if (!contractAmountStr || contractAmountStr.trim() === '') {
    return 0;
  }
  
  // "3,986,400 원" 형태에서 숫자만 추출
  const numberStr = contractAmountStr.replace(/[^0-9,]/g, '').replace(/,/g, '');
  const amount = parseInt(numberStr);
  return isNaN(amount) ? 0 : amount;
}

module.exports = router; 