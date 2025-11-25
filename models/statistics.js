const db = require('../db/database');
const gameModel = require('./game');
const pointCalculator = require('./pointCalculator');
const googleSheets = require('./googleSheets');

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
        if (contract.contract_amount && contract.selected_vendor && 
            (contract.status === '최종계약체결' || contract.status === '계약종료(정산)')) {
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
      
      // 우수포인트 계산을 위해 해당 게임사의 게임들 조회
      const games = await gameModel.getAllGames();
      const companyGames = games.filter(game => game.company_name === company.company_name);
      
      // 우수포인트 합계 계산
      const totalExcellentPoints = companyGames.reduce((sum, game) => {
        return sum + (game.excellent_1st_points || 0) + 
                    (game.excellent_2nd_points || 0) + 
                    (game.excellent_3rd_points || 0);
      }, 0);
      
      // 실제 총 포인트 = 기존 total_points + 우수포인트
      const actualTotalPoints = company.total_points + totalExcellentPoints;
      const actualUsageRate = actualTotalPoints > 0 
        ? (totalContractAmount / actualTotalPoints * 100)
        : 0;

      result.push({
        company_name: company.company_name,
        total_points: actualTotalPoints,
        base_points: company.total_base_points || 0,
        self_points: company.total_self_points || 0,
        excellent_points: totalExcellentPoints,
        used_points: totalContractAmount,
        usage_rate: actualUsageRate
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

/**
 * 게임사 성과 현황 데이터 테이블 생성
 * @returns {Promise<void>}
 */
async function createGamePerformanceTable() {
  return new Promise((resolve, reject) => {
    const query = `
      CREATE TABLE IF NOT EXISTS game_performance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        company_name TEXT NOT NULL,
        game_name TEXT NOT NULL,
        downloads_domestic INTEGER DEFAULT 0,
        downloads_global INTEGER DEFAULT 0,
        downloads_target INTEGER DEFAULT 0,
        revenue_domestic REAL DEFAULT 0,
        revenue_global REAL DEFAULT 0,
        revenue_target REAL DEFAULT 0,
        dau_domestic INTEGER DEFAULT 0,
        dau_global INTEGER DEFAULT 0,
        dau_target INTEGER DEFAULT 0,
        wishlist_domestic INTEGER DEFAULT 0,
        wishlist_global INTEGER DEFAULT 0,
        wishlist_target INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date, company_name, game_name)
      )
    `;
    
    db.run(query, [], (err) => {
      if (err) {
        console.error('게임사 성과 현황 테이블 생성 오류:', err);
        reject(err);
        return;
      }
      
      console.log('게임사 성과 현황 테이블이 생성되었습니다.');
      resolve();
    });
  });
}

/**
 * 구글 스프레드시트에서 게임사 성과 현황 데이터 가져오기
 * @returns {Promise<Array>} 게임사 성과 현황 데이터 배열
 */
async function fetchGamePerformanceData() {
  try {
    // 스프레드시트 ID와 범위
    const sheetId = '1nZHNr1Glpyotp64u4ndelCPvEagxkGF-SIArY19xs8c';
    const gid = '0'; // 첫 번째 시트
    
    console.log('성과 현황 스프레드시트 요청 시작');
    
    // CSV 형식으로 내보내기 URL 형식 사용
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    
    // axios 가져오기
    const axios = require('axios');
    
    // 요청 시 타임아웃 설정 및 에러 처리 강화
    const response = await axios.get(exportUrl, {
      timeout: 10000, // 10초 타임아웃
      validateStatus: false // 모든 HTTP 상태 코드를 허용하고 reject하지 않음
    });
    
    // HTTP 상태 코드 확인
    if (response.status !== 200) {
      console.error('성과 현황 스프레드시트 요청 실패:', response.status, response.statusText);
      throw new Error(`성과 현황 스프레드시트 요청 실패: ${response.status} ${response.statusText}`);
    }
    
    // 데이터가 없는 경우 확인
    if (!response.data || response.data.trim() === '') {
      console.error('성과 현황 스프레드시트 데이터가 비어 있습니다.');
      throw new Error('성과 현황 스프레드시트 데이터가 비어 있습니다.');
    }
    
    console.log('성과 현황 스프레드시트 데이터 수신 성공');
    
    // CSV 데이터 파싱
    const rows = response.data.split('\n').filter(row => row.trim() !== '');
    
    if (rows.length < 2) {
      console.error('파싱 가능한 데이터가 충분하지 않습니다:', rows);
      throw new Error('파싱 가능한 데이터가 충분하지 않습니다.');
    }
    
    // 헤더 파싱 (A1:P2)
    const headers = googleSheets.parseCSVLine(rows[0]);
    console.log('헤더:', headers);
    
    const performanceData = [];
    
    // 데이터 행 파싱 (A3부터)
    for (let i = 2; i < rows.length; i++) {
      if (!rows[i] || rows[i].trim() === '') continue; // 빈 행 건너뛰기
      
      // 큰따옴표가 포함된 CSV 필드 처리를 위한 파싱
      const values = googleSheets.parseCSVLine(rows[i]);
      
      if (values.length < 16) {
        console.warn(`행 ${i+1}에 열이 부족합니다. 건너뜁니다:`, rows[i]);
        continue;
      }
      
      // 필요한 데이터 추출 (매출은 소숫점 포함)
      const data = {
        date: values[0]?.trim() || '',
        category: values[1]?.trim() || '',
        company_name: values[2]?.trim() || '',
        game_name: values[3]?.trim() || '',
        downloads_domestic: parseInt((values[4] || '0').replace(/,/g, '')),
        downloads_global: parseInt((values[5] || '0').replace(/,/g, '')),
        downloads_target: parseInt((values[6] || '0').replace(/,/g, '')),
        revenue_domestic: parseFloat((values[7] || '0').replace(/,/g, '')) || 0,
        revenue_global: parseFloat((values[8] || '0').replace(/,/g, '')) || 0,
        revenue_target: parseFloat((values[9] || '0').replace(/,/g, '')) || 0,
        dau_domestic: parseInt((values[10] || '0').replace(/,/g, '')),
        dau_global: parseInt((values[11] || '0').replace(/,/g, '')),
        dau_target: parseInt((values[12] || '0').replace(/,/g, '')),
        wishlist_domestic: parseInt((values[13] || '0').replace(/,/g, '')),
        wishlist_global: parseInt((values[14] || '0').replace(/,/g, '')),
        wishlist_target: parseInt((values[15] || '0').replace(/,/g, ''))
      };
      
      // 데이터 유효성 검사
      if (!data.date || !data.company_name || !data.game_name) {
        console.warn(`행 ${i+1}에 필수 데이터(날짜, 회사명, 게임명)가 없습니다. 건너뜁니다:`, rows[i]);
        continue;
      }
      
      performanceData.push(data);
    }
    
    console.log(`총 ${performanceData.length}개의 성과 현황 데이터를 가져왔습니다.`);
    
    return performanceData;
  } catch (error) {
    console.error('성과 현황 데이터 가져오기 오류:', error);
    throw error;
  }
}

/**
 * 게임사 성과 현황 데이터 저장
 * @param {Array} performanceData 게임사 성과 현황 데이터 배열
 * @returns {Promise<Object>} 저장 결과
 */
async function saveGamePerformanceData(performanceData) {
  return new Promise(async (resolve, reject) => {
    try {
      // 테이블이 없으면 생성
      await createGamePerformanceTable();
      
      // 트랜잭션 시작
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        const insertQuery = `
          INSERT OR REPLACE INTO game_performance (
            date, company_name, game_name, 
            downloads_domestic, downloads_global, downloads_target,
            revenue_domestic, revenue_global, revenue_target,
            dau_domestic, dau_global, dau_target,
            wishlist_domestic, wishlist_global, wishlist_target,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        
        const stmt = db.prepare(insertQuery);
        let insertCount = 0;
        
        performanceData.forEach(data => {
          stmt.run(
            data.date,
            data.company_name,
            data.game_name,
            data.downloads_domestic,
            data.downloads_global,
            data.downloads_target,
            data.revenue_domestic,
            data.revenue_global,
            data.revenue_target,
            data.dau_domestic,
            data.dau_global,
            data.dau_target,
            data.wishlist_domestic,
            data.wishlist_global,
            data.wishlist_target,
            (err) => {
              if (err) {
                console.error('데이터 삽입 오류:', err);
              } else {
                insertCount++;
              }
            }
          );
        });
        
        stmt.finalize();
        
        db.run('COMMIT', (err) => {
          if (err) {
            console.error('트랜잭션 커밋 오류:', err);
            reject(err);
          } else {
            console.log(`${insertCount}개의 성과 현황 데이터가 저장되었습니다.`);
            resolve({
              success: true,
              insertCount,
              message: `${insertCount}개의 성과 현황 데이터가 저장되었습니다.`
            });
          }
        });
      });
    } catch (error) {
      console.error('성과 현황 데이터 저장 오류:', error);
      db.run('ROLLBACK');
      reject(error);
    }
  });
}

/**
 * 특정 게임사의 성과 현황 데이터 가져오기
 * @param {string} companyName 게임사 이름
 * @param {string} gameName 게임 이름 (선택 사항)
 * @param {string} startDate 시작 날짜 (선택 사항)
 * @param {string} endDate 종료 날짜 (선택 사항)
 * @returns {Promise<Array>} 게임사 성과 현황 데이터 배열
 */
async function getGamePerformanceData(companyName, gameName = null, startDate = null, endDate = null) {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM game_performance WHERE company_name = ?';
    const params = [companyName];
    
    if (gameName) {
      query += ' AND game_name = ?';
      params.push(gameName);
    }
    
    if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }
    
    query += ' ORDER BY date ASC';
    
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('성과 현황 데이터 조회 오류:', err);
        reject(err);
        return;
      }
      
      resolve(rows);
    });
  });
}

/**
 * 게임사 성과 현황 데이터 동기화 (구글 스프레드시트에서 가져와 DB에 저장)
 * @returns {Promise<Object>} 동기화 결과
 */
async function syncGamePerformanceData() {
  try {
    console.log('게임사 성과 현황 데이터 동기화 시작');
    
    // 구글 스프레드시트에서 데이터 가져오기
    const performanceData = await fetchGamePerformanceData();
    
    // DB에 데이터 저장
    const result = await saveGamePerformanceData(performanceData);
    
    console.log('게임사 성과 현황 데이터 동기화 완료');
    
    return {
      success: true,
      message: '게임사 성과 현황 데이터 동기화가 완료되었습니다.',
      ...result
    };
  } catch (error) {
    console.error('게임사 성과 현황 데이터 동기화 오류:', error);
    return {
      success: false,
      message: `게임사 성과 현황 데이터 동기화 오류: ${error.message}`
    };
  }
}

/**
 * 특정 게임사의 성과 현황 데이터를 일/주/월 단위로 집계
 * @param {string} companyName 게임사 이름
 * @param {string} gameName 게임 이름 (선택 사항)
 * @param {string} period 기간 ('daily', 'weekly', 'monthly')
 * @param {string} metric 지표 ('revenue', 'downloads', 'dau', 'wishlist')
 * @param {string} region 지역 ('domestic', 'global', 'target')
 * @returns {Promise<Array>} 집계된 성과 현황 데이터 배열
 */
async function getAggregatedPerformanceData(companyName, gameName = null, period = 'daily', metric = 'revenue', region = 'global') {
  console.log(`[통계 모델] 성과 현황 데이터 조회: ${companyName}, ${gameName || '모든 게임'}, ${period}, ${metric}, ${region}`);
  
  try {
    let query = `
      SELECT date, SUM(${metric}_${region}) as value
      FROM game_performance
      WHERE 1=1
    `;
    
    const params = [];
    
    if (companyName) {
      query += ` AND company_name = ?`;
      params.push(companyName);
    }
    
    if (gameName) {
      query += ` AND game_name = ?`;
      params.push(gameName);
    }
    
    // 날짜 그룹화 설정
    let groupByFormat;
    if (period === 'daily') {
      groupByFormat = '%Y-%m-%d';
    } else if (period === 'weekly') {
      groupByFormat = '%Y-%W';  // 연도-주차
    } else if (period === 'monthly') {
      groupByFormat = '%Y-%m';  // 연도-월
    }
    
    query += ` GROUP BY strftime('${groupByFormat}', date)
               ORDER BY date ASC`;
    
    console.log(`[통계 모델] 실행 쿼리: ${query}`);
    console.log(`[통계 모델] 쿼리 파라미터:`, params);
    
    const rows = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) {
          console.error(`[통계 모델] 쿼리 실행 오류:`, err);
          reject(err);
        } else {
          console.log(`[통계 모델] 쿼리 결과: ${rows.length}개 항목`);
          resolve(rows);
        }
      });
    });
    
    return rows;
  } catch (error) {
    console.error(`[통계 모델] 성과 현황 데이터 조회 중 오류 발생:`, error);
    throw error;
  }
}

/**
 * 게임사별 누적 매출 통계 가져오기
 * @param {string} startDate 시작 날짜 (선택 사항, YYYY-MM-DD 형식)
 * @param {string} endDate 종료 날짜 (선택 사항, YYYY-MM-DD 형식)
 * @returns {Promise<Array>} 게임사별 누적 매출 통계 배열
 */
async function getCompanyRevenueStatistics(startDate = null, endDate = null) {
  try {
    console.log(`[통계 모델] 게임사별 누적 매출 통계 조회 - 기간: ${startDate || '전체'} ~ ${endDate || '전체'}`);
    
    // 모든 게임사 목록 가져오기
    const query = `
      SELECT DISTINCT company_name
      FROM game_performance
      ORDER BY company_name
    `;
    
    const companies = await new Promise((resolve, reject) => {
      db.all(query, [], (err, rows) => {
        if (err) {
          console.error('게임사 목록 조회 오류:', err);
          reject(err);
        } else {
          resolve(rows.map(row => row.company_name));
        }
      });
    });
    
    // 각 게임사별 누적 매출 계산
    const result = [];
    
    for (const companyName of companies) {
      // 해당 게임사의 모든 게임 성과 데이터 가져오기
      let revenueQuery = `
        SELECT SUM(revenue_global) as total_global_revenue,
               SUM(revenue_domestic) as total_domestic_revenue
        FROM game_performance
        WHERE company_name = ?
      `;
      
      const params = [companyName];
      
      // 날짜 필터 추가
      if (startDate) {
        revenueQuery += ` AND date >= ?`;
        params.push(startDate);
      }
      
      if (endDate) {
        revenueQuery += ` AND date <= ?`;
        params.push(endDate);
      }
      
      const revenueData = await new Promise((resolve, reject) => {
        db.get(revenueQuery, params, (err, row) => {
          if (err) {
            console.error(`${companyName} 매출 데이터 조회 오류:`, err);
            reject(err);
          } else {
            resolve(row);
          }
        });
      });
      
      // 전역 매출과 국내 매출 합산
      const totalRevenue = (revenueData.total_global_revenue || 0) + (revenueData.total_domestic_revenue || 0);
      
      result.push({
        company_name: companyName,
        global_revenue: revenueData.total_global_revenue || 0,
        domestic_revenue: revenueData.total_domestic_revenue || 0,
        total_revenue: totalRevenue
      });
    }
    
    // 총 매출 기준 내림차순 정렬
    result.sort((a, b) => b.total_revenue - a.total_revenue);
    
    return result;
  } catch (error) {
    console.error('게임사별 누적 매출 통계 조회 오류:', error);
    throw error;
  }
}

module.exports = {
  getCompanyUsageStatistics,
  getServiceCategoryStatistics,
  createGamePerformanceTable,
  fetchGamePerformanceData,
  saveGamePerformanceData,
  getGamePerformanceData,
  syncGamePerformanceData,
  getAggregatedPerformanceData,
  getCompanyRevenueStatistics
}; 