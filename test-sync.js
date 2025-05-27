// DB 동기화 테스트 스크립트
const gameModel = require('./models/game');

console.log('DB 동기화 테스트를 시작합니다...');

// 동기화 실행
gameModel.syncWithGoogleSheet()
  .then(result => {
    console.log('동기화 결과:', result);
    
    // 동기화 후 DB에서 모든 게임 데이터 가져오기
    return gameModel.getAllGames();
  })
  .then(games => {
    console.log(`DB에서 ${games.length}개의 게임 데이터를 가져왔습니다.`);
    console.log('첫 번째 게임 데이터:', games[0]);
    
    // 회사별 포인트 합계 가져오기
    return gameModel.getPointsByCompany();
  })
  .then(companyPoints => {
    console.log(`${companyPoints.length}개 회사의 포인트 합계를 가져왔습니다.`);
    console.log('회사별 포인트:', companyPoints);
  })
  .catch(error => {
    console.error('테스트 중 오류 발생:', error);
  }); 