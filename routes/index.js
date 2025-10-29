const express = require('express');
const router = express.Router();
const gameModel = require('../models/game');
const managerModel = require('../models/manager');
const statisticsModel = require('../models/statistics');
const puppeteer = require('puppeteer');
const db = require('../db/database');
const pointCalculator = require('../models/pointCalculator');

// 권한 체크 미들웨어
function checkAdminManagerRole(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  
  if (req.session.user.role === '어드민' || req.session.user.role === '매니저') {
    next();
  } else {
    res.status(403).render('error', {
      title: '접근 제한',
      message: '이 페이지에 접근할 수 있는 권한이 없습니다.',
      error: { status: 403 }
    });
  }
}

// 홈 페이지
router.get('/', async (req, res) => {
  try {
    let companyPoints;
    let gamesWithCategoryUsage;
    
    // 현재 사용자의 역할에 따라 데이터 필터링
    if (req.session.user.role === '담당자') {
      // 담당자의 경우 본인이 담당하는 게임사 데이터만 표시
      const managerId = req.session.user.id;
      const userCompanies = await managerModel.getCompaniesByManager(managerId);
      
      if (userCompanies && userCompanies.length > 0) {
        companyPoints = await gameModel.getPointsByCompanies(userCompanies);
        
        // 서비스 부문별 포인트 사용량을 포함한 게임 데이터
        const allGamesWithCategories = await gameModel.getAllGamesWithPointUsageAndCategories();
        gamesWithCategoryUsage = allGamesWithCategories.filter(game => 
          userCompanies.includes(game.companyName)
        );
      } else {
        companyPoints = [];
        gamesWithCategoryUsage = [];
      }
    } else {
      // 어드민과 매니저는 모든 게임사 데이터 표시
      companyPoints = await gameModel.getPointsByCompany();
      gamesWithCategoryUsage = await gameModel.getAllGamesWithPointUsageAndCategories();
    }
    
    // 각 게임사별 계약 금액 합계 계산
    if (gamesWithCategoryUsage && gamesWithCategoryUsage.length > 0) {
      // 게임사별 계약 정보 조회
      const companyContractData = {};
      
      // 모든 게임사의 계약 정보 가져오기
      const allCompanies = [...new Set(gamesWithCategoryUsage.map(game => game.companyName))];
      
      for (const companyName of allCompanies) {
        const contracts = await gameModel.getContractsByCompany(companyName) || [];
        let totalContractAmount = 0;
        
        // 전체 계약 금액 합산
        if (contracts && contracts.length > 0) {
          contracts.forEach(contract => {
            // 계약완료 상태인 계약만 합산 (최종계약체결 또는 계약종료(정산))
            if (contract.contract_amount && contract.selected_vendor && 
                (contract.status === '최종계약체결' || contract.status === '계약종료(정산)')) {
              const amount = pointCalculator.parseContractAmount(contract.contract_amount);
              if (amount > 0) {
                totalContractAmount += amount;
              }
            }
          });
        }
        
        companyContractData[companyName] = {
          totalContractAmount,
          contracts
        };
      }
      
      // 게임 데이터에 계약 금액 정보 추가
      gamesWithCategoryUsage = gamesWithCategoryUsage.map(game => {
        const companyData = companyContractData[game.companyName] || { totalContractAmount: 0 };
        return {
          ...game,
          contractAmount: companyData.totalContractAmount
        };
      });
      
      // 사용률 기준으로 내림차순 정렬 (사용률이 높은 순으로)
      gamesWithCategoryUsage.sort((a, b) => {
        // 상세 페이지와 동일한 방식으로 사용률 계산
        const usageRateA = a.totalPoints > 0 ? (a.contractAmount / a.totalPoints * 100) : 0;
        const usageRateB = b.totalPoints > 0 ? (b.contractAmount / b.totalPoints * 100) : 0;
        return usageRateB - usageRateA; // 내림차순 정렬
      });
    }
    
    // 각 게임사의 계약 정보 존재 여부 확인
    const companyContractStatus = await gameModel.getCompanyContractStatus();
    
    // 마지막 동기화 시간과 다음 동기화까지 남은 시간 정보 가져오기
    const syncInfo = await gameModel.getNextSyncInfo();
    
    res.render('index', { 
      title: '대시보드',
      companyPoints,
      gamesWithCategoryUsage,
      companyContractStatus,
      syncInfo: {
        lastSync: syncInfo.lastSync ? syncInfo.lastSync.toLocaleString('ko-KR') : '정보 없음',
        nextSync: syncInfo.nextSync ? syncInfo.nextSync.toLocaleString('ko-KR') : '정보 없음',
        remainingMinutes: syncInfo.remainingMinutes || 0
      },
      req // 요청 객체를 템플릿에 전달
    });
  } catch (error) {
    console.error('홈 페이지 에러:', error);
    res.status(500).render('error', { 
      title: '오류 발생',
      message: '데이터를 가져오는 중 오류가 발생했습니다.',
      error
    });
  }
});

// 통계 페이지 (어드민과 매니저만 접근 가능)
router.get('/statistics', async (req, res, next) => {
  // PDF 내보내기 플래그가 있으면 인증 확인을 우회합니다
  const isExport = req.query.export === 'true';
  
  if (!isExport) {
    // 일반 접근일 경우 권한 체크
    return checkAdminManagerRole(req, res, next);
  }
  
  // PDF 내보내기용 페이지 렌더링 (권한 체크 우회)
  next();
}, async (req, res) => {
  try {
    // 날짜 범위 파라미터 처리
    const startDate = req.query.start_date || null;
    const endDate = req.query.end_date || null;
    
    // 날짜 범위 유효성 검사
    let dateRangeValid = true;
    let dateError = null;
    
    if (startDate && endDate) {
      // 날짜 형식 검증 (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        dateRangeValid = false;
        dateError = '날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 입력해주세요.';
      } else {
        // 시작일이 종료일보다 이후인지 검사
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);
        if (startDateObj > endDateObj) {
          dateRangeValid = false;
          dateError = '시작일은 종료일보다 이전이어야 합니다.';
        }
      }
    }
    
    // 게임사별 포인트 사용률 통계 가져오기
    const companyUsageStats = await statisticsModel.getCompanyUsageStatistics();
    
    // 서비스 부문별 포인트 사용 통계 가져오기
    const serviceCategoryStats = await statisticsModel.getServiceCategoryStatistics();
    
    // 게임사별 누적 매출 통계 가져오기 (날짜 범위 적용)
    const companyRevenueStats = dateRangeValid 
      ? await statisticsModel.getCompanyRevenueStatistics(startDate, endDate)
      : await statisticsModel.getCompanyRevenueStatistics();
    
    // 총 누적 매출 계산
    const totalRevenue = companyRevenueStats.reduce((sum, company) => sum + company.total_revenue, 0);
    
    // 마지막 동기화 시간과 다음 동기화까지 남은 시간 정보 가져오기
    const syncInfo = await gameModel.getNextSyncInfo();
    
    // PDF 내보내기를 위한 플래그 추가
    const exportToPdf = req.query.export === 'true';
    
    // 현재 날짜를 기본값으로 설정 (필터 초기값용)
    const today = new Date();
    const defaultEndDate = today.toISOString().split('T')[0];
    
    // 3개월 전 날짜를 기본 시작일로 설정
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(today.getMonth() - 3);
    const defaultStartDate = threeMonthsAgo.toISOString().split('T')[0];
    
    res.render('statistics', {
      title: '포인트 통계',
      companyUsageStats,
      serviceCategoryStats,
      companyRevenueStats,
      totalRevenue,
      exportToPdf, // PDF 내보내기 플래그 전달
      dateFilter: {
        startDate: startDate || defaultStartDate,
        endDate: endDate || defaultEndDate,
        isValid: dateRangeValid,
        error: dateError
      },
      syncInfo: {
        lastSync: syncInfo.lastSync ? syncInfo.lastSync.toLocaleString('ko-KR') : '정보 없음',
        nextSync: syncInfo.nextSync ? syncInfo.nextSync.toLocaleString('ko-KR') : '정보 없음',
        remainingMinutes: syncInfo.remainingMinutes || 0
      }
    });
  } catch (error) {
    console.error('통계 페이지 에러:', error);
    res.status(500).render('error', {
      title: '오류 발생',
      message: '통계 데이터를 가져오는 중 오류가 발생했습니다.',
      error
    });
  }
});

// 통계 페이지 PDF 내보내기 (어드민과 매니저만 접근 가능)
router.get('/statistics/export-pdf', checkAdminManagerRole, async (req, res) => {
  try {
    console.log('PDF 내보내기 시작');
    
    // 통계 데이터 직접 가져오기
    const companyUsageStats = await statisticsModel.getCompanyUsageStatistics();
    const serviceCategoryStats = await statisticsModel.getServiceCategoryStatistics();
    
    // 현재 날짜 및 시간 설정 (PDF 파일명에 사용)
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // 게임사별 데이터 준비
    const totalPoints = companyUsageStats.reduce((sum, company) => sum + company.total_points, 0);
    const usedPoints = companyUsageStats.reduce((sum, company) => sum + company.used_points, 0);
    const remainingPoints = totalPoints - usedPoints;
    const usageRate = (usedPoints / totalPoints * 100).toFixed(1);
    
    // 모든 회사명 배열 (사용률이 높은 순으로 정렬)
    const sortedCompanies = [...companyUsageStats]
      .sort((a, b) => {
        const usageRateA = (a.used_points / a.total_points) * 100;
        const usageRateB = (b.used_points / b.total_points) * 100;
        return usageRateB - usageRateA;
      });
    
    const companiesForChart = sortedCompanies.map(company => company.company_name);
    
    // 각 회사별 사용량 배열
    const usedPointsForChart = sortedCompanies.map(company => company.used_points);
    
    // 각 회사별 잔여량 배열
    const remainingPointsForChart = sortedCompanies.map(company => company.total_points - company.used_points);
    
    // 모든 값 중 최대값 찾기
    const maxPointValue = Math.max(
      ...usedPointsForChart,
      ...remainingPointsForChart
    );
    
    // 게임사별 차트 - 세로 문서에 맞게 최적화된 레이아웃
    const barWidth = 18;         // 막대 너비 축소
    const barGap = 8;            // 간격 축소
    const barChartWidth = 600;   // 차트 너비 축소 (세로 문서에 맞게)
    
    // 사용량이 0%인 회사 수 계산 (아래에서는 사용하지만, 이 값은 유지)
    const zeroUsageCount = sortedCompanies.filter(company => 
      (company.used_points / company.total_points * 100) === 0
    ).length;
    
    // 모든 회사 표시
    const companyCount = sortedCompanies.length;
    
    // 차트 높이 계산 (모든 회사 표시)
    const barChartHeight = Math.min(1100, (companyCount * (barWidth + barGap)) + 100);
    const maxBarHeight = 400;    // 최대 막대 높이 조정
    const barStartX = 150;       // 회사명 표시 공간
    const barStartY = 70;        // 시작 Y 위치 (범례 위한 공간 확보)
    
    // 막대 그래프 SVG 생성
    let barChartSvg = `<svg width="${barChartWidth}" height="${barChartHeight}" xmlns="http://www.w3.org/2000/svg">`;
    
    // 범례 - 상단 가운데 정렬
    barChartSvg += `
      <rect x="180" y="30" width="20" height="20" fill="#B85450" />
      <text x="205" y="45" font-family="Arial" font-size="14">사용량</text>
      <rect x="300" y="30" width="20" height="20" fill="#E6E6E6" />
      <text x="325" y="45" font-family="Arial" font-size="14">잔여량</text>
    `;
    
    // 각 회사별 막대 그리기 (모든 회사 포함)
    sortedCompanies.forEach((company, index) => {
      // 사용률 계산 (소수점 한 자리까지)
      const usageRate = ((company.used_points / company.total_points) * 100).toFixed(1);
      
      // 100% 기준으로 막대 길이 계산
      const usedWidth = (parseFloat(usageRate) / 100) * maxBarHeight;
      const remainingWidth = maxBarHeight - usedWidth;
      
      // 한 줄로 배치 (세로로 나열)
      const y = barStartY + 30 + (index * (barWidth + barGap));
      const x = barStartX;
      
      // 회사명이 너무 길면 축약
      const displayCompany = company.company_name.length > 15 ? company.company_name.substring(0, 14) + '…' : company.company_name;
      
      // 사용량 막대 (빨간색) - 가로 방향으로 그리기 (사용률 기준)
      barChartSvg += `<rect x="${x}" y="${y}" width="${usedWidth}" height="${barWidth}" fill="#B85450" />`;
      
      // 잔여량 막대 (회색) - 가로 방향으로 그리기 (100% - 사용률)
      barChartSvg += `<rect x="${x + usedWidth}" y="${y}" width="${remainingWidth}" height="${barWidth}" fill="#E6E6E6" />`;
      
      // 회사명 라벨 (가로로 표시하여 가독성 향상)
      barChartSvg += `<text x="${x - 5}" y="${y + barWidth/2 + 4}" font-family="Arial" font-size="11" text-anchor="end">${displayCompany}</text>`;
      
      // 사용률(%) 라벨 추가 - 막대 오른쪽에 표시
      barChartSvg += `<text x="${x + maxBarHeight + 5}" y="${y + barWidth/2 + 4}" font-family="Arial" font-size="11" fill="#333333" font-weight="bold">${usageRate}%</text>`;
    });
    
    // 사용률 0% 안내 문구 제거
    
    barChartSvg += `</svg>`;
    
    // 서비스 부문별 파이 차트 SVG 생성 (세로 문서에 맞게 최적화)
    const pieChartWidth = 500;
    const pieChartHeight = 280;  // 높이 약간 줄임
    const pieRadius = 110;       // 반지름 약간 줄임
    const pieCenterX = 220;
    const pieCenterY = 140;      // 중심점 위로 이동
    
    // 파이 차트 색상 (이미지의 색상으로 변경)
    const pieColors = ['#7DD1D3', '#70B3F0', '#FACB70', '#F38A9B', '#9C8CDB'];
    
    // 파이 차트 SVG 생성 - 내부 제목 제거
    let pieChartSvg = `<svg width="${pieChartWidth}" height="${pieChartHeight}" xmlns="http://www.w3.org/2000/svg">`;
    
    // 카테고리별 색상 매핑 함수
    function getCategoryColorIndex(category) {
      if (category.includes('마케팅')) return 0;
      if (category.includes('게임') || category.includes('서비스')) return 1;
      if (category.includes('인프라')) return 2;
      if (category.includes('컨설팅')) return 3;
      return 4; // 기타
    }
    
    // 각 서비스 부문별 파이 조각 그리기
    let startAngle = 0;
    serviceCategoryStats.categories.forEach((category, index) => {
      const percentage = category.percentage / 100;
      const endAngle = startAngle + percentage * 2 * Math.PI;
      
      // 원의 호를 계산
      const x1 = pieCenterX + pieRadius * Math.cos(startAngle);
      const y1 = pieCenterY + pieRadius * Math.sin(startAngle);
      const x2 = pieCenterX + pieRadius * Math.cos(endAngle);
      const y2 = pieCenterY + pieRadius * Math.sin(endAngle);
      
      // 대호인지 소호인지 결정 (180도 초과면 대호)
      const largeArcFlag = percentage > 0.5 ? 1 : 0;
      
      // 카테고리에 맞는 색상 인덱스 가져오기
      const colorIndex = getCategoryColorIndex(category.category);
      
      // 파이 조각 그리기
      pieChartSvg += `<path d="M ${pieCenterX} ${pieCenterY} L ${x1} ${y1} A ${pieRadius} ${pieRadius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z" fill="${pieColors[colorIndex]}" />`;
      
      // 다음 조각의 시작 각도 설정
      startAngle = endAngle;
    });
    
    // 범례는 HTML로 표시하고, 여기서는 퍼센트만 표시
    const categoryLabels = {
      '마케팅': 0,
      '게임 서비스': 1,
      '인프라': 2,
      '컨설팅': 3,
      '기타': 4
    };
    
    // 파이 차트에 퍼센트 값 표시
    let angleStart = 0;
    serviceCategoryStats.categories.forEach((category, index) => {
      const percentage = category.percentage / 100;
      const angleEnd = angleStart + percentage * 2 * Math.PI;
      
      // 조각의 중간 각도 계산
      const midAngle = angleStart + (percentage * Math.PI);
      
      // 퍼센트 텍스트 위치 계산 (조각 중앙에 배치)
      const textDistance = pieRadius * 0.7; // 중심에서 70% 지점에 텍스트 배치
      const textX = pieCenterX + textDistance * Math.cos(midAngle);
      const textY = pieCenterY + textDistance * Math.sin(midAngle);
      
      // 퍼센트 값이 충분히 크면 (5% 이상) 텍스트 표시
      if (category.percentage >= 5) {
        // 카테고리에 맞는 색상 인덱스 가져오기
        const colorIdx = getCategoryColorIndex(category.category);
        
        // 컬러에 따라 텍스트 색상 결정 (밝은 색상에는 어두운 텍스트, 어두운 색상에는 밝은 텍스트)
        const textColor = (colorIdx === 2 || colorIdx === 0) ? "#333333" : "white"; // 노란색과 민트색에는 어두운 텍스트
        pieChartSvg += `<text x="${textX}" y="${textY}" font-family="Arial" font-size="13" fill="${textColor}" text-anchor="middle" font-weight="bold">${category.percentage.toFixed(0)}%</text>`;
      }
      
      // 다음 조각의 시작 각도 설정
      angleStart = angleEnd;
    });
    
    pieChartSvg += `</svg>`;
    
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>포인트 통계 보고서</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #4A568D; text-align: left; font-size: 24px; margin-bottom: 5px; }
        p { color: #666; margin-top: 0; margin-bottom: 20px; }
        table { 
          border-collapse: collapse; 
          width: 100%; 
          margin-bottom: 20px; 
          border: 1px solid #EEEEEE;
          border-radius: 4px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        th, td { 
          border: none; 
          border-bottom: 1px solid #EEEEEE; 
          padding: 10px; 
          text-align: left; 
        }
        th { 
          background-color: #F5F5F5; 
          color: #4A568D;
          font-weight: bold;
        }
        tr:nth-child(even) { background-color: #FAFAFA; }
        tr:hover { background-color: #F0F0F0; }
        .total { font-weight: bold; background-color: #f8f8f8; }
        .point-cards { display: flex; margin-bottom: 30px; }
        .point-card { 
          flex: 1; 
          padding: 15px; 
          margin: 0 5px; 
          color: white; 
          border-radius: 8px; 
          text-align: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .point-card h3 { 
          margin: 0 0 5px 0; 
          font-size: 18px;
        }
        .point-card p { 
          margin: 0; 
          font-size: 14px;
          color: #333333;
          opacity: 0.8;
        }
        .blue { 
          background-color: #7986CB; 
          color: white;
        }
        .blue p {
          color: rgba(255,255,255,0.9);
        }
        .red { background-color: #EF9A9A; }
        .red p {
          color: #333333;
        }
        .green { background-color: #A5D6A7; color: #333333; }
        .green p {
          color: #333333;
        }
        .yellow { background-color: #FFE082; color: #333333; }
        .yellow p {
          color: #333333;
        }
        .chart-container { 
          margin: 15px 0 30px;
        }
        .chart-container.full-width { width: 100%; overflow-x: auto; }
        .chart-section { margin-bottom: 20px; }
        h2 { 
          margin-top: 20px; 
          margin-bottom: 15px; 
          text-align: left; 
          color: #4A568D;
          padding-bottom: 5px;
          border-bottom: 1px solid #EEEEEE;
        }
        .page-break { page-break-before: always; }
        .section-divider {
          height: 1px;
          background-color: #EEEEEE;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <h1>포인트 통계 보고서</h1>
      <p>생성일: ${new Date().toLocaleString()}</p>
      
      <div id="page1">
        <h2>전체 포인트 현황</h2>
        <div class="point-cards">
          <div class="point-card blue">
            <h3>${totalPoints.toLocaleString()} P</h3>
            <p>총 배정 포인트</p>
          </div>
          <div class="point-card red">
            <h3>${usedPoints.toLocaleString()} P</h3>
            <p>총 사용 포인트</p>
          </div>
          <div class="point-card green">
            <h3>${remainingPoints.toLocaleString()} P</h3>
            <p>총 잔여 포인트</p>
          </div>
          <div class="point-card yellow">
            <h3>${usageRate}%</h3>
            <p>전체 사용률</p>
          </div>
        </div>
        
        <div style="margin-top: -10px;"></div>
        
        <div class="chart-section">
          <h2>서비스 부문별 포인트 사용 차트</h2>
          <div class="chart-container" style="text-align: center;">
            ${pieChartSvg}
          </div>
          <div style="text-align: center; margin-top: 10px; font-size: 11px;">
            ${serviceCategoryStats.categories.map((category, index) => {
              // 카테고리에 맞는 색상 인덱스 가져오기
              const colorIndex = getCategoryColorIndex(category.category);
              
              return `<span style="display: inline-block; margin: 0 5px;"><span style="display: inline-block; width: 8px; height: 8px; background-color: ${pieColors[colorIndex]}; margin-right: 3px;"></span> ${category.category}</span>`;
            }).join('')}
          </div>
        </div>
        
        <div class="section-divider"></div>
        
        <h2>서비스 부문별 포인트 사용 상세</h2>
        <table>
          <tr>
            <th>서비스 부문</th>
            <th>사용량</th>
            <th>비율</th>
          </tr>
          ${serviceCategoryStats.categories.map(category => `
            <tr>
              <td>${category.category}</td>
              <td>${category.amount.toLocaleString()} P</td>
              <td>${category.percentage.toFixed(1)}%</td>
            </tr>
          `).join('')}
        </table>
      </div>
      
      <div id="page2" class="page-break">
        <h2>게임사별 포인트 사용률 차트</h2>
        <div style="margin-bottom: 10px; font-size: 13px; color: #666; text-align: center;">전체 ${sortedCompanies.length}개 게임사 사용률 순 정렬</div>
        <div class="chart-container full-width" style="text-align: center;">
          ${barChartSvg}
        </div>
        
        <div class="section-divider"></div>
        
        <h2>게임사별 포인트 사용률 상세</h2>
        <table>
          <tr>
            <th>게임사</th>
            <th>총 포인트</th>
            <th>사용량</th>
            <th>사용률</th>
          </tr>
          ${sortedCompanies.map(company => `
            <tr>
              <td>${company.company_name}</td>
              <td>${company.total_points.toLocaleString()} P</td>
              <td>${company.used_points.toLocaleString()} P</td>
              <td>${((company.used_points / company.total_points) * 100).toFixed(1)}%</td>
            </tr>
          `).join('')}
        </table>
      </div>
      
      <!-- 사용률 0% 게임사 별도 페이지 제거 -->
    </body>
    </html>
    `;
    
    // Puppeteer를 사용하여 PDF 생성
    console.log('Puppeteer 브라우저 시작 중...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    // HTML 설정
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // PDF 생성 (세로 방향)
    console.log('PDF 생성 중...');
    const pdf = await page.pdf({
      format: 'A4',
      landscape: false,
      printBackground: true,
      margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
      preferCSSPageSize: true,
      scale: 0.95
    });
    
    // 생성된 PDF 파일을 디스크에 저장
    const fs = require('fs');
    const path = require('path');
    const pdfFilePath = path.join(__dirname, '../public/debug.pdf');
    fs.writeFileSync(pdfFilePath, pdf);
    console.log(`디버그 PDF 파일 저장됨: ${pdfFilePath}`);
    
    console.log(`PDF 생성 완료: ${pdf.length} 바이트`);
    
    await browser.close();
    console.log('브라우저 닫힘');
    
    // PDF 파일 제공
    const safeFileName = `statistics_${dateStr}.pdf`;
    console.log(`PDF 파일 제공: ${safeFileName}`);
    
    // 파일 전송
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${safeFileName}`);
    
    // 스트림으로 전송
    const fileStream = fs.createReadStream(pdfFilePath);
    fileStream.pipe(res);
    console.log('PDF 파일 스트림 전송 완료');
    
  } catch (error) {
    console.error('PDF 내보내기 에러:', error);
    res.status(500).render('error', {
      title: 'PDF 생성 오류',
      message: 'PDF 파일을 생성하는 중 오류가 발생했습니다.',
      error
    });
  }
});

// 데이터 동기화 기능
router.get('/sync', async (req, res) => {
  try {
    // 권한 체크가 이미 미들웨어에서 처리됨
    const result = await gameModel.syncWithGoogleSheet();
    res.redirect('/?sync=success');
  } catch (error) {
    console.error('동기화 에러:', error);
    res.status(500).render('error', {
      title: '동기화 오류',
      message: '구글 스프레드시트와 동기화 중 오류가 발생했습니다.',
      error
    });
  }
});

// 성과 현황 데이터 동기화 기능
router.get('/sync-performance', async (req, res) => {
  try {
    // 어드민만 사용 가능한 기능으로 제한
    if (req.session.user.role !== '어드민') {
      return res.status(403).render('error', {
        title: '접근 제한',
        message: '이 기능을 사용할 권한이 없습니다.',
        error: { status: 403 }
      });
    }
    
    // 성과 현황 데이터 동기화 실행
    const result = await statisticsModel.syncGamePerformanceData();
    
    // 성공 시 원래 페이지로 리다이렉트
    const redirectUrl = req.query.from ? req.query.from : '/?sync-performance=success';
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('성과 현황 데이터 동기화 에러:', error);
    res.status(500).render('error', {
      title: '성과 현황 데이터 동기화 오류',
      message: '성과 현황 데이터 동기화 중 오류가 발생했습니다.',
      error
    });
  }
});

// 성과 현황 데이터 동기화 기능 (POST 방식)
router.post('/sync-performance', async (req, res) => {
  try {
    // 어드민만 사용 가능한 기능으로 제한
    if (req.session.user && req.session.user.role !== '어드민') {
      return res.status(403).json({
        success: false,
        message: '이 기능을 사용할 권한이 없습니다.'
      });
    }
    
    // 로그 추가
    console.log(`어드민 사용자(${req.session.user ? req.session.user.email : 'API 호출'})가 성과 현황 데이터 동기화 요청`);
    
    // 성과 현황 데이터 동기화 실행
    const result = await statisticsModel.syncGamePerformanceData();
    
    // JSON 응답 반환
    res.json(result);
  } catch (error) {
    console.error('성과 현황 데이터 동기화 에러:', error);
    res.status(500).json({
      success: false,
      message: '성과 현황 데이터 동기화 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// PointUsageDB 업데이트 기능
router.get('/update-point-usage-db', async (req, res) => {
  try {
    // 어드민만 사용 가능한 기능으로 제한
    if (req.session.user.role !== '어드민') {
      return res.status(403).render('error', {
        title: '접근 제한',
        message: '이 기능을 사용할 권한이 없습니다.',
        error: { status: 403 }
      });
    }
    
    // PointUsageDB 업데이트 실행
    const result = await gameModel.updatePointUsageDB();
    
    // 성공 시 원래 페이지로 리다이렉트
    const redirectUrl = req.query.from ? req.query.from : '/?update=success';
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('PointUsageDB 업데이트 에러:', error);
    res.status(500).render('error', {
      title: 'PointUsageDB 업데이트 오류',
      message: 'PointUsageDB 업데이트 중 오류가 발생했습니다.',
      error
    });
  }
});

// PointUsageDB 업데이트 기능 (POST 방식)
router.post('/update-pointusagedb', async (req, res) => {
  try {
    // 어드민만 사용 가능한 기능으로 제한
    if (req.session.user && req.session.user.role !== '어드민') {
      return res.status(403).json({
        success: false,
        message: '이 기능을 사용할 권한이 없습니다.'
      });
    }
    
    // 로그 추가
    console.log(`어드민 사용자(${req.session.user ? req.session.user.email : 'API 호출'})가 PointUsageDB 업데이트 요청`);
    
    // PointUsageDB 업데이트 실행
    const result = await gameModel.updatePointUsageDB();
    
    // JSON 응답 반환
    res.json(result);
  } catch (error) {
    console.error('PointUsageDB 업데이트 에러:', error);
    res.status(500).json({
      success: false,
      message: 'PointUsageDB 업데이트 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router; 