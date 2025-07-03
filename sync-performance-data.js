const db = require('./db/database');
const statisticsModel = require('./models/statistics');

async function syncData() {
  try {
    console.log('게임사 성과 현황 데이터 동기화 시작...');
    const result = await statisticsModel.syncGamePerformanceData();
    console.log('동기화 결과:', result);
  } catch (err) {
    console.error('동기화 오류:', err);
  } finally {
    process.exit();
  }
}

syncData(); 