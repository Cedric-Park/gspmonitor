const express = require('express');
const router = express.Router();
const gameModel = require('../models/game');
const managerModel = require('../models/manager');

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
    
    // 총 사용량 데이터 구조화
    const totalUsageData = {
      total: totalUsedPoints,
      self: totalUsedSelfPoints,
      base: totalUsedBasePoints
    };
    
    // 해당 회사의 계약 정보 가져오기 (전체 사용률 계산용)
    let contracts = [];
    let totalContractAmount = 0;
    
    try {
      contracts = await gameModel.getContractsByCompany(companyName) || [];
      
      // 전체 계약 금액 합산 (자부담/기본 구분 없이)
      if (contracts && contracts.length > 0) {
        contracts.forEach(contract => {
          if (contract.contract_amount && contract.selected_vendor) {
            // pointCalculator의 parseContractAmount 함수를 사용하기 위해 모듈 임포트 필요
            const pointCalculator = require('../models/pointCalculator');
            const amount = pointCalculator.parseContractAmount(contract.contract_amount);
            if (amount > 0) {
              totalContractAmount += amount;
            }
          }
        });
      }
    } catch (err) {
      console.error('계약 정보 조회 오류:', err);
      contracts = [];
    }
    
    // 서비스 부문별 사용량 데이터 계산
    const serviceCategoryUsage = {};
    const serviceCategories = ['게임 서비스', '마케팅', '인프라', '컨설팅'];
    
    // 카테고리 초기화
    serviceCategories.forEach(category => {
      serviceCategoryUsage[category] = {
        totalUsed: 0,
        contractCount: 0
      };
    });
    
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
      userRole: req.session.user.role
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

module.exports = router; 