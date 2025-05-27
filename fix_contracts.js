const db = require('./db/database');

async function fixContract1596() {
  // 1. 주식회사 미니멈스튜디오의 게임 ID 조회
  const gameId = await new Promise((resolve, reject) => {
    db.get('SELECT id FROM games WHERE company_name = ?', ['주식회사 미니멈스튜디오'], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.id : null);
    });
  });

  if (!gameId) {
    console.log('게임 ID를 찾을 수 없습니다.');
    return;
  }

  console.log(`게임 ID: ${gameId}`);

  // 2. 계약 1596의 assigned_game_id 업데이트
  const result = await new Promise((resolve, reject) => {
    db.run(
      'UPDATE contracts SET assigned_game_id = ? WHERE contract_id = ?',
      [gameId, '1596'],
      function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });

  console.log(`계약 1596의 assigned_game_id 업데이트: ${result}개 행 수정`);

  // 3. 수정 결과 확인
  const updated = await new Promise((resolve, reject) => {
    db.get(
      'SELECT contract_id, assigned_game_id, contract_amount FROM contracts WHERE contract_id = ?',
      ['1596'],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });

  console.log('수정된 계약 1596:', updated);

  // 4. 포인트 사용량 재계산
  const pointCalculator = require('./models/pointCalculator');
  const usage = await pointCalculator.getGamePointUsage(gameId);
  console.log('업데이트된 포인트 사용량:', usage);
}

async function main() {
  try {
    await fixContract1596();
    process.exit(0);
  } catch (error) {
    console.error('오류:', error);
    process.exit(1);
  }
}

// 데이터베이스 초기화 완료 후 실행
db.serialize(() => {
  setTimeout(main, 1000);
}); 