const db = require('./db/database');
const statisticsModel = require('./models/statistics');

async function createTable() {
  try {
    await statisticsModel.createGamePerformanceTable();
    console.log('게임사 성과 현황 테이블이 성공적으로 생성되었습니다.');
  } catch (err) {
    console.error('테이블 생성 오류:', err);
  } finally {
    process.exit();
  }
}

createTable(); 