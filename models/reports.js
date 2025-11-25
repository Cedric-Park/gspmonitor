const db = require('../db/database');
const gameModel = require('./game');
const statisticsModel = require('./statistics');
const pointCalculator = require('./pointCalculator');

/**
 * 2025년 연간 성과 보고서 데이터 조회
 * @param {number} year - 조회할 연도 (기본: 2025)
 * @returns {Promise<Object>} 연간 성과 보고서 데이터
 */
async function getAnnualPerformanceReport(year = 2025) {
  try {
    console.log(`[보고서 모델] ${year}년 연간 성과 보고서 데이터 조회 시작`);
    
    // 1. 사업 개요 데이터
    const overview = await getBusinessOverview(year);
    
    // 2. 포인트 지원 현황
    const pointSupport = await getPointSupportStatus(year);
    
    // 3. 게임사 성과 분석
    const performance = await getCompanyPerformanceAnalysis(year);
    
    // 4. 포인트 효율성 분석
    const efficiency = await getPointEfficiencyAnalysis(year);
    
    // 5. 주요 인사이트
    const insights = await generateKeyInsights(year, pointSupport, performance, efficiency);
    
    // 6. 월별 추이 데이터
    const monthlyTrends = await getMonthlyTrends(year);
    
    return {
      year,
      overview,
      pointSupport,
      performance,
      efficiency,
      insights,
      monthlyTrends,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('[보고서 모델] 연간 성과 보고서 조회 오류:', error);
    throw error;
  }
}

/**
 * 사업 개요 데이터
 */
async function getBusinessOverview(year) {
  try {
    // 참여 게임사 수
    const companies = await gameModel.getAllCompanies();
    const companyCount = companies.length;
    
    // 총 게임 수
    const games = await gameModel.getAllGames();
    const gameCount = games.length;
    
    // 총 지원 포인트 (기본 + 자부담 + 우수)
    let totalBasePoints = 0;
    let totalSelfPoints = 0;
    let totalExcellentPoints = 0;
    
    games.forEach(game => {
      totalBasePoints += game.base_points || 0;
      totalSelfPoints += game.self_points || 0;
      totalExcellentPoints += (game.excellent_1st_points || 0) + 
                             (game.excellent_2nd_points || 0) + 
                             (game.excellent_3rd_points || 0);
    });
    
    const totalPoints = totalBasePoints + totalSelfPoints + totalExcellentPoints;
    
    // 총 계약 건수 및 금액 (모든 등록된 계약)
    const contracts = await gameModel.getAllContracts();
    
    // 사업 개요: 모든 계약 포함
    let allContractAmount = 0;
    let allContractCount = 0;
    
    contracts.forEach(contract => {
      if (contract.contract_amount) {
        const amount = pointCalculator.parseContractAmount(contract.contract_amount);
        if (amount > 0) {
          allContractAmount += amount;
          allContractCount++;
        }
      }
    });
    
    // 확정된 계약 건수 (최종계약체결, 계약종료(정산))
    const confirmedContracts = contracts.filter(c => 
      (c.status === '최종계약체결' || c.status === '계약종료(정산)') &&
      c.contract_amount && c.selected_vendor
    );
    
    // 포인트 사용액 계산 (통계 페이지와 동일한 방식)
    // 게임사별로 계약 금액을 합산
    const companyPoints = await gameModel.getPointsByCompany();
    let totalPointsUsed = 0;
    
    for (const company of companyPoints) {
      const companyContracts = await gameModel.getContractsByCompany(company.company_name);
      
      companyContracts.forEach(contract => {
        if (contract.contract_amount && contract.selected_vendor && 
            (contract.status === '최종계약체결' || contract.status === '계약종료(정산)')) {
          const amount = pointCalculator.parseContractAmount(contract.contract_amount);
          if (amount > 0) {
            totalPointsUsed += amount;
          }
        }
      });
    }
    
    // 우수게임사 수
    const excellentCompanies = games.filter(g => 
      g.is_excellent_1st || g.is_excellent_2nd || g.is_excellent_3rd
    );
    const excellentCompanyNames = [...new Set(excellentCompanies.map(g => g.company_name))];
    
    return {
      companyCount,
      gameCount,
      totalPoints,
      totalBasePoints,
      totalSelfPoints,
      totalExcellentPoints,
      contractCount: allContractCount, // 모든 계약 건수
      totalContractAmount: allContractAmount, // 모든 계약 금액
      confirmedContractCount: confirmedContracts.length, // 확정된 계약 건수
      totalPointsUsed, // 확정된 계약 금액 = 포인트 사용액
      excellentCompanyCount: excellentCompanyNames.length,
      pointExecutionRate: totalPoints > 0 ? (totalPointsUsed / totalPoints * 100) : 0 // 집행률 = 확정 계약 금액 / 총 지원 포인트
    };
  } catch (error) {
    console.error('[보고서 모델] 사업 개요 조회 오류:', error);
    throw error;
  }
}

/**
 * 포인트 지원 현황
 */
async function getPointSupportStatus(year) {
  try {
    // 게임사별 포인트 배분 (총 포인트만 가져오기)
    const companyPoints = await gameModel.getPointsByCompany();
    const games = await gameModel.getAllGames();
    
    const companyPointDistribution = {};
    
    // 각 게임사의 총 포인트 계산 (우수포인트 포함)
    companyPoints.forEach(company => {
      const companyGames = games.filter(game => game.company_name === company.company_name);
      
      // 우수포인트 합계 계산
      const totalExcellentPoints = companyGames.reduce((sum, game) => {
        return sum + (game.excellent_1st_points || 0) + 
                    (game.excellent_2nd_points || 0) + 
                    (game.excellent_3rd_points || 0);
      }, 0);
      
      const actualTotalPoints = company.total_points + totalExcellentPoints;
      
      companyPointDistribution[company.company_name] = {
        companyName: company.company_name,
        totalPoints: actualTotalPoints,
        basePoints: company.total_base_points || 0,
        selfPoints: company.total_self_points || 0,
        excellentPoints: totalExcellentPoints,
        usedPoints: 0,
        remainingPoints: actualTotalPoints,
        usageRate: 0
      };
    });
    
    // 각 게임사의 실제 계약 금액 합산
    for (const companyName in companyPointDistribution) {
      const companyContracts = await gameModel.getContractsByCompany(companyName);
      
      let totalContractAmount = 0;
      companyContracts.forEach(contract => {
        if (contract.contract_amount && contract.selected_vendor && 
            (contract.status === '최종계약체결' || contract.status === '계약종료(정산)')) {
          const amount = pointCalculator.parseContractAmount(contract.contract_amount);
          if (amount > 0) {
            totalContractAmount += amount;
          }
        }
      });
      
      const company = companyPointDistribution[companyName];
      company.usedPoints = totalContractAmount;
      company.remainingPoints = company.totalPoints - totalContractAmount;
      company.usageRate = company.totalPoints > 0 
        ? (totalContractAmount / company.totalPoints * 100) 
        : 0;
    }
    
    // 배열로 변환 및 사용률 기준 정렬
    const companyList = Object.values(companyPointDistribution)
      .sort((a, b) => b.usageRate - a.usageRate);
    
    // 서비스 부문별 포인트 사용
    const serviceCategoryStats = await statisticsModel.getServiceCategoryStatistics();
    
    return {
      companyPointDistribution: companyList,
      serviceCategoryStats
    };
  } catch (error) {
    console.error('[보고서 모델] 포인트 지원 현황 조회 오류:', error);
    throw error;
  }
}

/**
 * 게임사 성과 분석
 */
async function getCompanyPerformanceAnalysis(year) {
  try {
    // 게임사별 누적 매출
    const revenueStats = await statisticsModel.getCompanyRevenueStatistics();
    
    // 게임사별 성과 데이터 조회
    const companies = await gameModel.getAllCompanies();
    const performanceData = [];
    
    for (const companyName of companies) {
      // 해당 게임사의 글로벌 성과 데이터만 조회
      const companyPerformance = await new Promise((resolve, reject) => {
        const query = `
          SELECT 
            SUM(downloads_global) as total_downloads_global,
            SUM(downloads_target) as total_downloads_target,
            SUM(revenue_global) as total_revenue_global,
            SUM(revenue_target) as total_revenue_target,
            AVG(dau_global) as avg_dau_global,
            AVG(dau_target) as avg_dau_target,
            SUM(wishlist_global) as total_wishlist_global,
            SUM(wishlist_target) as total_wishlist_target
          FROM game_performance
          WHERE company_name = ?
        `;
        
        db.get(query, [companyName], (err, row) => {
          if (err) reject(err);
          else resolve(row || {});
        });
      });
      
      // 목표 달성률 계산 (글로벌만)
      const downloadAchievementRate = companyPerformance.total_downloads_target > 0
        ? (companyPerformance.total_downloads_global / companyPerformance.total_downloads_target * 100)
        : 0;
      
      const revenueAchievementRate = companyPerformance.total_revenue_target > 0
        ? (companyPerformance.total_revenue_global / companyPerformance.total_revenue_target * 100)
        : 0;
      
      const dauAchievementRate = companyPerformance.avg_dau_target > 0
        ? (companyPerformance.avg_dau_global / companyPerformance.avg_dau_target * 100)
        : 0;
      
      performanceData.push({
        companyName,
        downloads: {
          global: companyPerformance.total_downloads_global || 0,
          target: companyPerformance.total_downloads_target || 0,
          achievementRate: downloadAchievementRate
        },
        revenue: {
          global: companyPerformance.total_revenue_global || 0,
          target: companyPerformance.total_revenue_target || 0,
          achievementRate: revenueAchievementRate
        },
        dau: {
          global: Math.round(companyPerformance.avg_dau_global || 0),
          target: Math.round(companyPerformance.avg_dau_target || 0),
          achievementRate: dauAchievementRate
        },
        wishlist: {
          global: companyPerformance.total_wishlist_global || 0,
          target: companyPerformance.total_wishlist_target || 0
        }
      });
    }
    
    // 글로벌 매출 기준 정렬
    performanceData.sort((a, b) => b.revenue.global - a.revenue.global);
    
    // 전체 합계 (글로벌만)
    const totalPerformance = performanceData.reduce((acc, company) => {
      acc.downloads += company.downloads.global;
      acc.revenue += company.revenue.global;
      acc.dau += company.dau.global;
      acc.wishlist += company.wishlist.global;
      return acc;
    }, { downloads: 0, revenue: 0, dau: 0, wishlist: 0 });
    
    // 매출 비중 계산
    performanceData.forEach(company => {
      company.revenue.shareRate = totalPerformance.revenue > 0
        ? (company.revenue.global / totalPerformance.revenue * 100)
        : 0;
    });
    
    return {
      companyPerformance: performanceData,
      totalPerformance
    };
  } catch (error) {
    console.error('[보고서 모델] 게임사 성과 분석 조회 오류:', error);
    throw error;
  }
}

/**
 * 포인트 효율성 분석 (ROI)
 */
async function getPointEfficiencyAnalysis(year) {
  try {
    const gamesWithUsage = await gameModel.getAllGamesWithPointUsageAndCategories();
    const companies = await gameModel.getAllCompanies();
    
    // 2.2에서 계산한 게임사별 총 포인트 (우수포인트 포함)
    const companyPoints = await gameModel.getPointsByCompany();
    const games = await gameModel.getAllGames();
    
    const companyTotalPoints = {};
    companyPoints.forEach(company => {
      const companyGames = games.filter(game => game.company_name === company.company_name);
      
      // 우수포인트 합계 계산
      const totalExcellentPoints = companyGames.reduce((sum, game) => {
        return sum + (game.excellent_1st_points || 0) + 
                    (game.excellent_2nd_points || 0) + 
                    (game.excellent_3rd_points || 0);
      }, 0);
      
      const actualTotalPoints = company.total_points + totalExcellentPoints;
      companyTotalPoints[company.company_name] = actualTotalPoints;
    });
    
    const efficiencyData = [];
    
    for (const companyName of companies) {
      // 해당 게임사의 투입 포인트 (기본 + 자부담 + 우수)
      const totalPointsAllocated = companyTotalPoints[companyName] || 0;
      
      // 해당 게임사의 성과 데이터 (글로벌만)
      const performanceData = await new Promise((resolve, reject) => {
        const query = `
          SELECT 
            SUM(revenue_global) as total_revenue,
            SUM(downloads_global) as total_downloads
          FROM game_performance
          WHERE company_name = ?
        `;
        
        db.get(query, [companyName], (err, row) => {
          if (err) reject(err);
          else resolve(row || { total_revenue: 0, total_downloads: 0 });
        });
      });
      
      // ROI 계산 (매출 / 투입 포인트)
      const roi = totalPointsAllocated > 0 
        ? (performanceData.total_revenue / totalPointsAllocated) 
        : 0;
      
      // 포인트당 다운로드 수
      const downloadsPerPoint = totalPointsAllocated > 0
        ? (performanceData.total_downloads / (totalPointsAllocated / 100000000)) // 1억원당
        : 0;
      
      // 우수게임사 여부 확인
      const companyGames = gamesWithUsage.filter(g => g.companyName === companyName);
      const isExcellent = companyGames.some(g => 
        g.isExcellent1st || g.isExcellent2nd || g.isExcellent3rd
      );
      
      efficiencyData.push({
        companyName,
        totalPointsAllocated,
        totalRevenue: performanceData.total_revenue,
        totalDownloads: performanceData.total_downloads,
        roi,
        downloadsPerPoint,
        isExcellent
      });
    }
    
    // ROI 기준 정렬
    efficiencyData.sort((a, b) => b.roi - a.roi);
    
    // 우수게임사 vs 일반게임사 비교
    const excellentCompanies = efficiencyData.filter(c => c.isExcellent);
    const regularCompanies = efficiencyData.filter(c => !c.isExcellent);
    
    const avgExcellentROI = excellentCompanies.length > 0
      ? excellentCompanies.reduce((sum, c) => sum + c.roi, 0) / excellentCompanies.length
      : 0;
    
    const avgRegularROI = regularCompanies.length > 0
      ? regularCompanies.reduce((sum, c) => sum + c.roi, 0) / regularCompanies.length
      : 0;
    
    // 전체 평균
    const overallROI = efficiencyData.length > 0
      ? efficiencyData.reduce((sum, c) => sum + c.roi, 0) / efficiencyData.length
      : 0;
    
    return {
      companyEfficiency: efficiencyData,
      comparison: {
        excellentAvgROI: avgExcellentROI,
        regularAvgROI: avgRegularROI,
        overallROI
      }
    };
  } catch (error) {
    console.error('[보고서 모델] 포인트 효율성 분석 오류:', error);
    throw error;
  }
}

/**
 * 주요 인사이트 자동 생성
 */
async function generateKeyInsights(year, pointSupport, performance, efficiency) {
  const insights = [];
  
  try {
    // 인사이트 1: 최고 ROI 게임사
    if (efficiency.companyEfficiency.length > 0) {
      const topROI = efficiency.companyEfficiency[0];
      insights.push({
        title: '최고 투자 효율성 달성',
        description: `${topROI.companyName}이(가) ROI ${topROI.roi.toFixed(2)}배로 가장 높은 투자 효율성을 기록했습니다.`,
        type: 'success',
        metric: `ROI ${topROI.roi.toFixed(2)}x`
      });
    }
    
    // 인사이트 2: 우수게임사 효과
    if (efficiency.comparison.excellentAvgROI > efficiency.comparison.regularAvgROI) {
      const difference = ((efficiency.comparison.excellentAvgROI / efficiency.comparison.regularAvgROI - 1) * 100).toFixed(1);
      insights.push({
        title: '우수게임사 프로그램의 효과성 입증',
        description: `우수게임사의 평균 ROI가 일반 게임사 대비 ${difference}% 높게 나타나, 우수게임사 선정 및 추가 지원의 효과가 입증되었습니다.`,
        type: 'success',
        metric: `+${difference}%`
      });
    }
    
    // 인사이트 3: 최고 성과 게임사 (글로벌 매출 기준)
    if (performance.companyPerformance.length > 0) {
      const topPerformer = performance.companyPerformance[0];
      const globalRevenue = topPerformer.revenue.global || 0;
      insights.push({
        title: '최고 매출 성과 달성',
        description: `${topPerformer.companyName}이(가) 글로벌 매출 ${Math.round(globalRevenue).toLocaleString('ko-KR')}원을 기록하며 최고 성과를 달성했습니다.`,
        type: 'success',
        metric: `${Math.round(globalRevenue).toLocaleString('ko-KR')}원`
      });
    }
    
    // 인사이트 4: 포인트 집행률
    const executionRate = pointSupport.companyPointDistribution.reduce((sum, c) => sum + c.usageRate, 0) / 
                         pointSupport.companyPointDistribution.length;
    if (executionRate >= 80) {
      insights.push({
        title: '높은 포인트 집행률 달성',
        description: `평균 ${executionRate.toFixed(1)}%의 포인트 집행률을 기록하여, 지원 포인트가 효과적으로 활용되었습니다.`,
        type: 'success',
        metric: `${executionRate.toFixed(1)}%`
      });
    } else if (executionRate < 60) {
      insights.push({
        title: '포인트 집행률 개선 필요',
        description: `평균 ${executionRate.toFixed(1)}%의 포인트 집행률로, 게임사의 포인트 활용을 촉진하기 위한 방안이 필요합니다.`,
        type: 'warning',
        metric: `${executionRate.toFixed(1)}%`
      });
    }
    
    // 인사이트 5: 서비스 부문별 효과
    if (pointSupport.serviceCategoryStats && pointSupport.serviceCategoryStats.categories.length > 0) {
      const topCategory = pointSupport.serviceCategoryStats.categories[0];
      
      // 카테고리별 맞춤 설명
      let categoryDescription = '';
      switch(topCategory.category) {
        case '마케팅':
          categoryDescription = '해외 시장 진출 및 프로모션에 집중했습니다';
          break;
        case '기술개발':
          categoryDescription = '게임 품질 및 기술 향상에 집중했습니다';
          break;
        case '번역/현지화':
          categoryDescription = '글로벌 시장 공략을 위한 현지화에 집중했습니다';
          break;
        case '플랫폼 수수료':
          categoryDescription = '다양한 플랫폼 진출에 집중했습니다';
          break;
        default:
          categoryDescription = `${topCategory.category} 분야를 중심으로 지원했습니다`;
      }
      
      insights.push({
        title: '주요 투자 분야',
        description: `${topCategory.category} 분야에 가장 많은 포인트(${topCategory.percentage.toFixed(1)}%)가 투입되어, ${categoryDescription}.`,
        type: 'info',
        metric: `${topCategory.percentage.toFixed(1)}%`
      });
    }
    
    // 인사이트 6: 목표 달성률 (전체 글로벌 매출 기준)
    const totalRevenue = performance.totalPerformance.revenue; // 전체 글로벌 매출
    const targetRevenue = 15000000000; // 목표 매출 150억원
    const revenueAchievement = (totalRevenue / targetRevenue * 100);
    
    if (revenueAchievement >= 100) {
      insights.push({
        title: '매출 목표 초과 달성',
        description: `목표 매출 150억원 대비 ${revenueAchievement.toFixed(1)}%를 달성하며, 사업 목표를 성공적으로 달성했습니다.`,
        type: 'success',
        metric: `${revenueAchievement.toFixed(1)}%`
      });
    } else if (revenueAchievement >= 80) {
      insights.push({
        title: '매출 목표 근접 달성',
        description: `목표 매출 150억원 대비 ${revenueAchievement.toFixed(1)}%를 달성했습니다.`,
        type: 'info',
        metric: `${revenueAchievement.toFixed(1)}%`
      });
    } else {
      insights.push({
        title: '매출 목표 달성 진행 중',
        description: `목표 매출 150억원 대비 ${revenueAchievement.toFixed(1)}%를 달성했습니다. 추가 성과 창출이 필요합니다.`,
        type: 'warning',
        metric: `${revenueAchievement.toFixed(1)}%`
      });
    }
    
    return insights;
  } catch (error) {
    console.error('[보고서 모델] 인사이트 생성 오류:', error);
    return insights;
  }
}

/**
 * 월별 추이 데이터
 */
async function getMonthlyTrends(year) {
  try {
    const months = [];
    
    for (let month = 1; month <= 12; month++) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = month === 12 
        ? `${year}-12-31` 
        : `${year}-${String(month + 1).padStart(2, '0')}-01`;
      
      // 해당 월의 매출 및 다운로드
      const monthData = await new Promise((resolve, reject) => {
        const query = `
          SELECT 
            SUM(revenue_domestic + revenue_global) as total_revenue,
            SUM(downloads_domestic + downloads_global) as total_downloads
          FROM game_performance
          WHERE date >= ? AND date < ?
        `;
        
        db.get(query, [startDate, endDate], (err, row) => {
          if (err) reject(err);
          else resolve(row || { total_revenue: 0, total_downloads: 0 });
        });
      });
      
      months.push({
        month,
        monthName: `${month}월`,
        revenue: monthData.total_revenue || 0,
        downloads: monthData.total_downloads || 0
      });
    }
    
    return months;
  } catch (error) {
    console.error('[보고서 모델] 월별 추이 조회 오류:', error);
    throw error;
  }
}

/**
 * 게임사별 개별 성과 보고서
 */
async function getCompanyReport(companyName, year = new Date().getFullYear()) {
  try {
    // 1. 기본 정보
    const games = await gameModel.getAllGames();
    const companyGames = games.filter(g => g.company_name === companyName);
    
    if (companyGames.length === 0) {
      throw new Error(`게임사 '${companyName}'를 찾을 수 없습니다.`);
    }
    
    // 담당 매니저 조회
    const managerModel = require('./manager');
    const managers = await managerModel.getManagersByCompany(companyName);
    
    // 우수게임사 여부
    const isExcellent1st = companyGames.some(g => g.excellent_1st_points > 0);
    const isExcellent2nd = companyGames.some(g => g.is_excellent_2nd);
    const isExcellent3rd = companyGames.some(g => g.is_excellent_3rd);
    
    // 2. 포인트 지원 현황
    const companyPoints = await gameModel.getPointsByCompany();
    const pointInfo = companyPoints.find(c => c.company_name === companyName);
    
    // 우수포인트 합계
    const excellentPoints = {
      first: companyGames.reduce((sum, g) => sum + (g.excellent_1st_points || 0), 0),
      second: companyGames.reduce((sum, g) => sum + (g.excellent_2nd_points || 0), 0),
      third: companyGames.reduce((sum, g) => sum + (g.excellent_3rd_points || 0), 0)
    };
    excellentPoints.total = excellentPoints.first + excellentPoints.second + excellentPoints.third;
    
    const totalPoints = (pointInfo?.total_points || 0) + excellentPoints.total;
    
    // 사용 포인트 계산
    const contracts = await gameModel.getContractsByCompany(companyName);
    
    // 확정 계약 필터링
    const confirmedContracts = contracts.filter(c => 
      c.status === '최종계약체결' || c.status === '계약종료(정산)'
    );
    
    let usedPoints = 0;
    confirmedContracts.forEach(contract => {
      if (contract.contract_amount && contract.selected_vendor) {
        const amount = pointCalculator.parseContractAmount(contract.contract_amount);
        if (amount > 0) {
          usedPoints += amount;
        }
      }
    });
    
    // 3. 서비스 부문별 포인트 사용 (기본포인트 vs 우수포인트 구분)
    const categoryUsage = {};
    const categoryUsageDetailed = {}; // 기본/우수 구분
    
    // 해당 게임사의 확정 계약에서 서비스 부문별 금액 집계
    for (const contract of confirmedContracts) {
      if (contract.service_category && contract.contract_amount) {
        const amount = pointCalculator.parseContractAmount(contract.contract_amount);
        if (amount > 0) {
          const category = contract.service_category;
          
          // 전체 금액
          categoryUsage[category] = (categoryUsage[category] || 0) + amount;
          
          // 상세 구분 초기화
          if (!categoryUsageDetailed[category]) {
            categoryUsageDetailed[category] = {
              base: 0,
              excellent: 0,
              total: 0
            };
          }
          
          // 게임의 우수포인트 정보 확인
          let isExcellentContract = false;
          if (contract.assigned_game_id) {
            const game = companyGames.find(g => g.id === contract.assigned_game_id);
            if (game) {
              const hasExcellentPoints = (game.excellent_1st_points || 0) > 0 || 
                                         game.is_excellent_2nd || 
                                         game.is_excellent_3rd;
              
              // 우수게임사이고 기본포인트를 초과하는 경우 우수포인트로 간주
              if (hasExcellentPoints) {
                const gameBasePoints = (game.base_points || 0) + (game.self_points || 0);
                const gameTotalPoints = game.total_points || 0;
                const gameExcellentPoints = gameTotalPoints - gameBasePoints;
                
                // 기본포인트 사용량 확인
                const basePointsUsed = contract.base_points_used || 0;
                const excellentPointsUsed = amount - basePointsUsed;
                
                if (excellentPointsUsed > 0) {
                  isExcellentContract = true;
                  categoryUsageDetailed[category].base += basePointsUsed;
                  categoryUsageDetailed[category].excellent += excellentPointsUsed;
                }
              }
            }
          }
          
          // 우수포인트 계약이 아니면 전체를 기본포인트로 처리
          if (!isExcellentContract) {
            categoryUsageDetailed[category].base += amount;
          }
          
          categoryUsageDetailed[category].total += amount;
        }
      }
    }
    
    // 5. 성과 지표 (글로벌)
    const performanceQuery = `
      SELECT 
        SUM(revenue_global) as total_revenue,
        SUM(downloads_global) as total_downloads,
        AVG(dau_global) as avg_dau,
        SUM(wishlist_global) as total_wishlist
      FROM game_performance
      WHERE company_name = ?
    `;
    
    const performance = await new Promise((resolve, reject) => {
      db.get(performanceQuery, [companyName], (err, row) => {
        if (err) reject(err);
        else resolve(row || {});
      });
    });
    
    // 전체 대비 비중 계산
    const allPerformance = await getCompanyPerformanceAnalysis(year);
    const totalRevenue = allPerformance.totalPerformance.revenue;
    const revenueShare = totalRevenue > 0 ? (performance.total_revenue / totalRevenue * 100) : 0;
    
    // 플랫폼 타입 확인 (모바일 vs PC/VR/콘솔)
    const isMobilePlatform = companyGames.some(g => g.platform === '모바일');
    const isNonMobilePlatform = companyGames.some(g => ['PC', 'VR', '콘솔'].includes(g.platform));
    
    // 6. 게임별 상세 성과
    const gamePerformances = [];
    for (const game of companyGames) {
      const gameQuery = `
        SELECT 
          SUM(revenue_global) as total_revenue,
          SUM(downloads_global) as total_downloads,
          AVG(dau_global) as avg_dau,
          SUM(wishlist_global) as total_wishlist
        FROM game_performance
        WHERE company_name = ? AND game_name = ?
      `;
      
      const gamePerf = await new Promise((resolve, reject) => {
        db.get(gameQuery, [companyName, game.game_name], (err, row) => {
          if (err) reject(err);
          else resolve(row || {});
        });
      });
      
      gamePerformances.push({
        gameName: game.game_name,
        platform: game.platform,
        revenue: gamePerf.total_revenue || 0,
        downloads: gamePerf.total_downloads || 0,
        dau: Math.round(gamePerf.avg_dau || 0),
        wishlist: gamePerf.total_wishlist || 0
      });
    }
    
    // 매출 기준 정렬
    gamePerformances.sort((a, b) => b.revenue - a.revenue);
    
    // 7. 투자 효율성
    const roi = totalPoints > 0 ? (performance.total_revenue / totalPoints) : 0;
    const downloadsPerHundredMillion = totalPoints > 0 
      ? (performance.total_downloads / (totalPoints / 100000000))
      : 0;
    
    // 전체 평균과 비교
    const efficiencyData = await getPointEfficiencyAnalysis(year);
    const avgROI = efficiencyData.comparison.overallROI;
    const excellentAvgROI = efficiencyData.comparison.excellentAvgROI;
    
    // 8. 순위
    const companyPerformanceData = allPerformance.companyPerformance;
    const revenueRank = companyPerformanceData.findIndex(c => c.companyName === companyName) + 1;
    
    const companyEfficiency = efficiencyData.companyEfficiency;
    const roiRank = companyEfficiency.findIndex(c => c.companyName === companyName) + 1;
    
    // 9. 월별 추이
    const monthlyData = [];
    for (let month = 5; month <= 11; month++) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
      
      const monthQuery = `
        SELECT 
          SUM(revenue_global) as revenue,
          SUM(downloads_global) as downloads
        FROM game_performance
        WHERE company_name = ? AND date >= ? AND date < ?
      `;
      
      const monthResult = await new Promise((resolve, reject) => {
        db.get(monthQuery, [companyName, startDate, endDate], (err, row) => {
          if (err) reject(err);
          else resolve(row || {});
        });
      });
      
      monthlyData.push({
        month,
        monthName: `${month}월`,
        revenue: monthResult.revenue || 0,
        downloads: monthResult.downloads || 0
      });
    }
    
    // 10. 종합 평가
    let grade = 'C';
    if (roi >= excellentAvgROI && revenueRank <= 5) grade = 'S';
    else if (roi >= avgROI && revenueRank <= 10) grade = 'A';
    else if (roi >= avgROI * 0.7) grade = 'B';
    
    return {
      companyName,
      basicInfo: {
        managers: managers.map(m => m.name).join(', ') || '미배정',
        gameCount: companyGames.length,
        games: companyGames.map(g => ({ name: g.game_name, platform: g.platform })),
        isExcellent: isExcellent1st || isExcellent2nd || isExcellent3rd,
        excellentLevel: isExcellent1st ? '1차' : isExcellent2nd ? '2차' : isExcellent3rd ? '3차' : null
      },
      pointInfo: {
        basePoints: pointInfo?.total_base_points || 0,
        selfPoints: pointInfo?.total_self_points || 0,
        excellentPoints,
        totalPoints,
        usedPoints,
        remainingPoints: totalPoints - usedPoints,
        usageRate: totalPoints > 0 ? (usedPoints / totalPoints * 100) : 0
      },
      categoryUsage,
      categoryUsageDetailed,
      contracts: {
        total: contracts.length,
        confirmed: confirmedContracts.length,
        totalAmount: usedPoints,
        details: confirmedContracts
      },
      performance: {
        revenue: performance.total_revenue || 0,
        downloads: performance.total_downloads || 0,
        dau: Math.round(performance.avg_dau || 0),
        wishlist: performance.total_wishlist || 0,
        revenueShare,
        isMobilePlatform,
        isNonMobilePlatform
      },
      gamePerformances,
      efficiency: {
        roi,
        downloadsPerHundredMillion,
        avgROI,
        excellentAvgROI,
        vsAverage: avgROI > 0 ? ((roi / avgROI - 1) * 100) : 0
      },
      ranking: {
        revenue: revenueRank,
        roi: roiRank,
        totalCompanies: companyPerformanceData.length
      },
      monthlyData,
      evaluation: {
        grade,
        strengths: [],
        weaknesses: [],
        recommendations: []
      }
    };
  } catch (error) {
    console.error('[보고서 모델] 게임사별 보고서 생성 오류:', error);
    throw error;
  }
}

module.exports = {
  getAnnualPerformanceReport,
  getBusinessOverview,
  getPointSupportStatus,
  getCompanyPerformanceAnalysis,
  getPointEfficiencyAnalysis,
  generateKeyInsights,
  getMonthlyTrends,
  getCompanyReport
};

