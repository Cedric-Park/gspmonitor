const db = require('../db/database');
const gameModel = require('./game');
const pointCalculator = require('./pointCalculator');

/**
 * 게임사별 포인트 사용률 통계 가져오기
 * @returns {Promise<Array>} 게임사별 포인트 사용 통계 배열
 */
async function getCompanyUsageStatistics() {
  try {
    // 모든 게임사의 포인트 현황 가져오기
    const companyPoints = await gameModel.getPointsByCompany();
    
    // 각 게임사별 포인트 사용량 계산
    const result = [];
    
    for (const company of companyPoints) {
      // 해당 게임사의 계약 정보 가져오기
      const contracts = await gameModel.getContractsByCompany(company.company_name);
      
      // 계약 금액 합산
      let totalContractAmount = 0;
      contracts.forEach(contract => {
        if (contract.contract_amount && contract.selected_vendor) {
          const amount = pointCalculator.parseContractAmount(contract.contract_amount);
          if (amount > 0) {
            totalContractAmount += amount;
          }
        }
      });
      
      // 사용률 계산
      const usageRate = company.total_points > 0 
        ? (totalContractAmount / company.total_points * 100)
        : 0;
      
      result.push({
        company_name: company.company_name,
        total_points: company.total_points,
        used_points: totalContractAmount,
        usage_rate: usageRate
      });
    }
    
    // 사용률 기준 내림차순 정렬
    result.sort((a, b) => b.usage_rate - a.usage_rate);
    
    return result;
  } catch (error) {
    console.error('게임사별 포인트 사용률 통계 조회 오류:', error);
    throw error;
  }
}

/**
 * 서비스 부문별 포인트 사용 통계 가져오기
 * @returns {Promise<Object>} 서비스 부문별 포인트 사용 통계 객체
 */
async function getServiceCategoryStatistics() {
  try {
    // 모든 게임의 포인트 사용량 가져오기 (서비스 부문별 데이터 포함)
    const allGamesWithCategories = await gameModel.getAllGamesWithPointUsageAndCategories();
    
    // 서비스 부문별 사용량 집계
    const categoryTotals = {
      '게임 서비스': 0,
      '마케팅': 0,
      '인프라': 0,
      '컨설팅': 0,
      '기타': 0
    };
    
    // 모든 게임의 각 서비스 부문별 사용량 합산
    allGamesWithCategories.forEach(game => {
      if (game.categoryUsage) {
        Object.keys(game.categoryUsage).forEach(category => {
          // 해당 카테고리가 초기화되어 있지 않으면 초기화
          if (!categoryTotals[category]) {
            categoryTotals[category] = 0;
          }
          
          // 사용량 합산
          let usedAmount = game.categoryUsage[category].totalUsed || 0;
          categoryTotals[category] += usedAmount;
        });
      }
    });
    
    // 총 사용량 계산
    const totalUsed = Object.values(categoryTotals).reduce((sum, amount) => sum + amount, 0);
    
    // 백분율 계산 및 결과 형식화
    const result = Object.entries(categoryTotals).map(([category, amount]) => {
      return {
        category,
        amount,
        percentage: totalUsed > 0 ? (amount / totalUsed * 100) : 0
      };
    });
    
    // 사용량 기준 내림차순 정렬
    result.sort((a, b) => b.amount - a.amount);
    
    return {
      categories: result,
      totalUsed
    };
  } catch (error) {
    console.error('서비스 부문별 포인트 사용 통계 조회 오류:', error);
    throw error;
  }
}

module.exports = {
  getCompanyUsageStatistics,
  getServiceCategoryStatistics
}; 