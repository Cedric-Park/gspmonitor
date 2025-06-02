const db = require('../db/database');
const gameModel = require('./game');
const pointCalculator = require('./pointCalculator');

/**
 * 게임사별 포인트 사용률 통계 가져오기
 * @param {Date} startDate 시작 날짜 (옵션)
 * @param {Date} endDate 종료 날짜 (옵션)
 * @returns {Promise<Array>} 게임사별 포인트 사용 통계 배열
 */
async function getCompanyUsageStatistics(startDate, endDate) {
  try {
    // 모든 게임사의 포인트 현황 가져오기
    const companyPoints = await gameModel.getPointsByCompany();
    
    // 각 게임사별 포인트 사용량 계산
    const result = [];
    
    for (const company of companyPoints) {
      // 해당 게임사의 계약 정보 가져오기
      const contracts = await gameModel.getContractsByCompany(company.company_name);
      
      // 필터링: 날짜 범위가 지정된 경우
      let filteredContracts = contracts;
      if (startDate && endDate) {
        filteredContracts = contracts.filter(contract => {
          if (!contract.updated_at) return false;
          
          const contractDate = new Date(contract.updated_at);
          return contractDate >= startDate && contractDate <= endDate;
        });
      }
      
      // 계약 금액 합산
      let totalContractAmount = 0;
      filteredContracts.forEach(contract => {
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
 * @param {Date} startDate 시작 날짜 (옵션)
 * @param {Date} endDate 종료 날짜 (옵션)
 * @returns {Promise<Object>} 서비스 부문별 포인트 사용 통계 객체
 */
async function getServiceCategoryStatistics(startDate, endDate) {
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
          
          // 계약들 필터링 (날짜 범위가 지정된 경우)
          let usedAmount = game.categoryUsage[category].totalUsed || 0;
          
          // 날짜 필터링은 모델 레벨에서 적용하기 어려워 
          // 서버 사이드에서 적용하지 않고, 클라이언트 측에서 처리함
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