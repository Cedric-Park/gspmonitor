const db = require('./db/database');

async function testNewPointCalculation() {
  console.log('=== 새로운 포인트 계산 로직 테스트 ===');
  
  const pointCalculator = require('./models/pointCalculator');
  
  // 서비스 부문별 포인트 사용량을 포함한 모든 게임 정보 조회
  const gamesWithCategories = await pointCalculator.getAllGamesPointUsageWithCategories();
  
  // 포인트가 사용된 게임들만 필터링
  const gamesWithUsage = gamesWithCategories.filter(game => game.pointsUsed.total > 0);
  
  console.log(`\n총 게임 수: ${gamesWithCategories.length}개`);
  console.log(`포인트가 사용된 게임: ${gamesWithUsage.length}개\n`);
  
  // 각 게임별 상세 정보 출력
  gamesWithUsage.forEach((game, index) => {
    console.log(`${index + 1}. ${game.companyName} - ${game.gameName}`);
    console.log(`   총 포인트: ${game.totalPoints.toLocaleString()}원`);
    console.log(`   사용 포인트: ${game.pointsUsed.total.toLocaleString()}원`);
    console.log(`   잔여 포인트: ${game.remainingPoints.total.toLocaleString()}원`);
    console.log(`   사용률: ${(game.pointsUsed.total / game.totalPoints * 100).toFixed(1)}%`);
    
    if (game.categoryUsage) {
      console.log('   서비스 부문별 사용량:');
      Object.keys(game.categoryUsage).forEach(category => {
        if (game.categoryUsage[category].totalUsed > 0) {
          console.log(`     - ${category}: ${game.categoryUsage[category].totalUsed.toLocaleString()}원 (${game.categoryUsage[category].contractCount}건)`);
        }
      });
    }
    console.log('');
  });
  
  // 전체 통계 계산
  let totalAllocated = 0;
  let totalUsed = 0;
  let categoryTotals = {
    '게임 서비스': 0,
    '마케팅': 0,
    '인프라': 0,
    '컨설팅': 0,
    '기타': 0
  };
  
  gamesWithCategories.forEach(game => {
    totalAllocated += game.totalPoints;
    totalUsed += game.pointsUsed.total;
    
    if (game.categoryUsage) {
      Object.keys(game.categoryUsage).forEach(category => {
        if (['게임 서비스', '마케팅', '인프라', '컨설팅'].includes(category)) {
          categoryTotals[category] += game.categoryUsage[category].totalUsed;
        } else if (game.categoryUsage[category].totalUsed > 0) {
          categoryTotals['기타'] += game.categoryUsage[category].totalUsed;
        }
      });
    }
  });
  
  const totalRemaining = totalAllocated - totalUsed;
  const usageRate = totalAllocated > 0 ? (totalUsed / totalAllocated * 100) : 0;
  
  console.log('=== 전체 통계 ===');
  console.log(`총 배정 포인트: ${totalAllocated.toLocaleString()}원`);
  console.log(`총 사용 포인트: ${totalUsed.toLocaleString()}원`);
  console.log(`총 잔여 포인트: ${totalRemaining.toLocaleString()}원`);
  console.log(`전체 사용률: ${usageRate.toFixed(1)}%`);
  
  console.log('\n=== 서비스 부문별 사용량 ===');
  Object.keys(categoryTotals).forEach(category => {
    if (categoryTotals[category] > 0) {
      const percentage = totalUsed > 0 ? (categoryTotals[category] / totalUsed * 100) : 0;
      console.log(`${category}: ${categoryTotals[category].toLocaleString()}원 (${percentage.toFixed(1)}%)`);
    }
  });
}

async function main() {
  try {
    await testNewPointCalculation();
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